import React from 'react';

import ConfigMixin from 'mixins/ConfigMixin';
import PureRenderWithRedirectedProps from 'mixins/PureRenderWithRedirectedProps';
import FluxMixin from 'mixins/FluxMixin';
import DataFetcherMixin from 'mixins/DataFetcherMixin';

import _map from 'lodash/map';
import _isEqual from 'lodash/isEqual';

import API from 'panoptes/API';
import SQL from 'panoptes/SQL';
import LRUCache from 'util/LRUCache';
import ErrorReport from 'panoptes/ErrorReporter';
import findBlocks from 'panoptes/genome/FindBlocks';
import PropertySelector from 'panoptes/PropertySelector';
import PropertyLegend from 'panoptes/PropertyLegend';

import ChannelWithConfigDrawer from 'panoptes/genome/tracks/ChannelWithConfigDrawer';
import FlatButton from 'material-ui/FlatButton';

import 'hidpi-canvas';
import {propertyColour, categoryColours} from 'util/Colours';

const HEIGHT = 50;

let PerRowIndicatorChannel = React.createClass({
  mixins: [
    PureRenderWithRedirectedProps({
      redirect: [
        'componentUpdate',
        'onClose'
      ],
      check: [
        'chromosome',
        'width',
        'sideWidth',
        'name',
        'table',
        'colourProperty'
      ]
    }),
    ConfigMixin,
    FluxMixin,
    DataFetcherMixin('chromosome', 'start', 'end', 'table', 'query', 'width', 'sideWidth', 'colourProperty')
  ],

  propTypes: {
    componentUpdate: React.PropTypes.func.isRequired,
    chromosome: React.PropTypes.string.isRequired,
    start: React.PropTypes.number.isRequired,
    end: React.PropTypes.number.isRequired,
    width: React.PropTypes.number.isRequired,
    sideWidth: React.PropTypes.number.isRequired,
    name: React.PropTypes.string,
    onClose: React.PropTypes.func,
    table: React.PropTypes.string.isRequired,
    query: React.PropTypes.string,
    colourProperty: React.PropTypes.string
  },

  getDefaultProps() {
    return {
      query: SQL.WhereClause.encode(SQL.WhereClause.Trivial())
    };
  },

  getInitialState() {
    return {
      knownValues: null
    }
  },

  componentWillMount() {
    this.positions = [];
  },

  componentDidUpdate() {
    this.draw();
  },

  //Called by DataFetcherMixin on componentWillReceiveProps
  fetchData(props, requestContext) {
    let {chromosome, start, end, width, sideWidth, table, query, colourProperty} = props;
    if (this.props.chromosome !== chromosome) {
      this.applyData(props, {});
    }
    if (width - sideWidth < 1) {
      return;
    }
    if (colourProperty && !this.config.tables[table].propertiesMap[colourProperty]) {
      ErrorReport(this.getFlux(), `Per ${table} channel: ${colourProperty} is not a valid property of ${table}`);
      return;
    }
    let [[block1Start, block1End], [block2Start, block2End]] = findBlocks(start, end);
    //If we already are at an acceptable block then don't change it!
    if (this.props.chromosome !== chromosome ||
        this.props.query !== query ||
        this.props.colourProperty !== colourProperty ||
        !((this.blockEnd === block1End && this.blockStart === block1Start) ||
          (this.blockEnd === block2End && this.blockStart === block2Start))) {
      //Current block was unacceptable so choose best one
      this.blockStart = block1Start;
      this.blockEnd = block1End;
      this.props.onChangeLoadStatus('LOADING');
      let tableConfig = this.config.tables[table];
      let columns = [tableConfig.primkey, tableConfig.positionField];
      if (colourProperty)
        columns.push(colourProperty);
      let columnspec = {};
      columns.forEach((column) => columnspec[column] = tableConfig.propertiesMap[column].defaultFetchEncoding);
      query = SQL.WhereClause.decode(query);
      let posQuery = SQL.WhereClause.AND([
        SQL.WhereClause.CompareFixed(tableConfig.chromosomeField, '=', chromosome),
        SQL.WhereClause.CompareFixed(tableConfig.positionField, '>=', this.blockStart),
        SQL.WhereClause.CompareFixed(tableConfig.positionField, '<', this.blockEnd)
      ]);
      if (!query.isTrivial)
        query = SQL.WhereClause.AND([posQuery, query]);
      let APIargs = {
        database: this.config.dataset,
        table: table,
        columns: columnspec,
        query: SQL.WhereClause.encode(query),
        transpose: false
      };

      requestContext.request((componentCancellation) =>
        LRUCache.get(
          'pageQuery' + JSON.stringify(APIargs),
          (cacheCancellation) =>
            API.pageQuery({cancellation: cacheCancellation, ...APIargs}),
          componentCancellation
        )).then((data) => {
          this.props.onChangeLoadStatus('DONE');
          this.applyData(this.props, data);
        })
        .catch((err) => {
          this.props.onChangeLoadStatus('DONE');
          throw err;
        })
        .catch(API.filterAborted)
        .catch(LRUCache.filterCancelled)
        .catch((error) => {
          this.applyData(this.props, {});
          ErrorReport(this.getFlux(), error.message, () => this.fetchData(props, requestContext));
        });
    }
    this.draw(props);
  },

  applyData(props, data) {
    let {table, colourProperty} = props;
    let tableConfig = this.config.tables[table];
    this.positions = data[tableConfig.positionField] || [];
    if (colourProperty && data[colourProperty]) {
      this.colourData = data[colourProperty];
      this.colourVals = _map(data[colourProperty], propertyColour(this.config.tables[table].propertiesMap[colourProperty]));
    } else {
      this.colourVals = null;
      this.colourData = null;
    }
    this.draw(props);
  },

  draw(props) {
    const {table, width, sideWidth, start, end, colourProperty} = props || this.props;
    const positions = this.positions;
    const colours = this.colourVals;
    const colourData = this.colourData;
    let drawnColourVals = new Set();
    const recordColours = colourProperty && this.config.tables[table].propertiesMap[colourProperty].isText;
    const canvas = this.refs.canvas;
    if (!canvas)
      return;
    const ctx = canvas.getContext('2d');
    const psy = (HEIGHT / 2) - 4;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.fillStyle = 'rgba(255,0,0,0.6)';
    for (let i = 0, l = positions.length; i < l; ++i) {
      const psx = ((width - sideWidth) / (end - start)) * (positions[i] - start);
      if (psx > -4 && psx < width + 4) {
        if (colours) {
          ctx.fillStyle = colours[i];
          if (recordColours) {
            drawnColourVals.add(colourData[i]);
          }
        }

        ctx.beginPath();
        ctx.moveTo(psx, psy);
        ctx.lineTo(psx + 6, psy + 12);
        ctx.lineTo(psx - 6, psy + 12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
    drawnColourVals = Array.from(drawnColourVals.values());
    if (recordColours) {
      if (!_isEqual(this.state.knownValues, drawnColourVals)) {
        this.setState({knownValues: drawnColourVals});
      }
    } else {
      this.setState({knownValues: null});
    }

    },

  render() {
    let {width, sideWidth, table, colourProperty} = this.props;
    const {knownValues} = this.state;
    return (
      <ChannelWithConfigDrawer
        width={width}
        sideWidth={sideWidth}
        height={HEIGHT}
        sideComponent={
          <div className="side-name">
            <span>{name || this.config.tables[table].tableCapNamePlural}</span>
            </div>
            }
        //Override component update to get latest in case of skipped render
        configComponent={<PerRowIndicatorControls {...this.props} componentUpdate={this.redirectedProps.componentUpdate} />}
        legendComponent={colourProperty ? <PropertyLegend table={table} property={colourProperty} knownValues={knownValues} /> : null}
        onClose={this.redirectedProps.onClose}
      >
        <canvas ref="canvas" width={width} height={HEIGHT}/>
      </ChannelWithConfigDrawer>);
  }
});

const PerRowIndicatorControls = React.createClass({
  mixins: [
    PureRenderWithRedirectedProps({
      check: [
        'colourProperty'
      ],
      redirect: ['componentUpdate']
    }),
    FluxMixin
  ],

  handleQueryPick(query) {
    this.getFlux().actions.session.modalClose();
    this.redirectedProps.componentUpdate({query});
  },

  render() {
    let {table, query, colourProperty} = this.props;
    let actions = this.getFlux().actions;
    return (
      <div className="channel-controls">
        <div className="control">
          <FlatButton label="Change Filter"
                      primary={true}
                      onClick={() => actions.session.modalOpen('containers/QueryPicker',
                        {
                          table: table,
                          initialQuery: query,
                          onPick: this.handleQueryPick
                        })}/>
        </div>
        <div className="control">
          <div className="label">Colour By:</div>
          <PropertySelector table={table}
                            value={colourProperty}
                            onSelect={(colourProperty) => this.redirectedProps.componentUpdate({colourProperty})} />
        </div>
      </div>
    );
  }

});

module.exports = PerRowIndicatorChannel;

