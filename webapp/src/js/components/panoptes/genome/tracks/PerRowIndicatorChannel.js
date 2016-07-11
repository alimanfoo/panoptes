import React from 'react';

import ConfigMixin from 'mixins/ConfigMixin';
import PureRenderWithRedirectedProps from 'mixins/PureRenderWithRedirectedProps';
import FluxMixin from 'mixins/FluxMixin';
import DataFetcherMixin from 'mixins/DataFetcherMixin';
import Color from 'color';

import _map from 'lodash/map';
import _isEqual from 'lodash/isEqual';
import _transform from 'lodash/transform';
import _filter from 'lodash/filter';

import SQL from 'panoptes/SQL';
import {findBlock, regionCacheGet} from 'util/PropertyRegionCache';
import ErrorReport from 'panoptes/ErrorReporter';
import PropertySelector from 'panoptes/PropertySelector';
import PropertyLegend from 'panoptes/PropertyLegend';
import API from 'panoptes/API';
import LRUCache from 'util/LRUCache';

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
        'colourProperty',
        'query'
      ]
    }),
    FluxMixin,
    ConfigMixin,
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
    };
  },

  componentWillMount() {
    this.positions = [];
    this.tooBigBlocks = [];
    this.blocks = [];
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
    if (colourProperty && !this.config.tablesById[table].propertiesById[colourProperty]) {
      ErrorReport(this.getFlux(), `Per ${table} channel: ${colourProperty} is not a valid property of ${table}`);
      return;
    }
    const {blockLevel, blockIndex, needNext} = findBlock({start, end});
    //If we already at this block then don't change it!
    if (this.props.chromosome !== chromosome ||
        this.props.query !== query ||
        this.props.colourProperty !== colourProperty ||
        !(this.blockLevel === blockLevel
        && this.blockIndex === blockIndex
        && this.needNext === needNext)) {
      //Current block was unacceptable so choose best one
      this.blockLevel = blockLevel;
      this.blockIndex = blockIndex;
      this.needNext = needNext;
      this.props.onChangeLoadStatus('LOADING');
      let tableConfig = this.config.tablesById[table];
      let columns = [tableConfig.primKey, tableConfig.position];
      if (colourProperty)
        columns.push(colourProperty);
      let columnspec = {};
      columns.forEach((column) => columnspec[column] = tableConfig.propertiesById[column].defaultFetchEncoding);
      query = SQL.WhereClause.decode(query);
      query = SQL.WhereClause.AND([SQL.WhereClause.CompareFixed(tableConfig.chromosome, '=', chromosome),
        query]);
      let APIargs = {
        database: this.config.dataset,
        table,
        columns: columnspec,
        query,
        transpose: false,
        regionField: tableConfig.position,
        start,
        end,
        blockLimit: 1000
      };
      requestContext.request((componentCancellation) =>
        regionCacheGet(APIargs, componentCancellation)
          .then((blocks) => {
            this.props.onChangeLoadStatus('DONE');
            this.applyData(this.props, blocks);
          }))
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

  combineBlocks(blocks, property) {
    return _transform(blocks, (sum, block) =>
      Array.prototype.push.apply(sum, block[property] || []),
    []);
  },

  applyData(props, blocks) {
    let {table, colourProperty} = props;
    let tableConfig = this.config.tablesById[table];
    this.blocks = blocks;
    this.positions = this.combineBlocks(blocks, tableConfig.position);
    if (colourProperty) {
      this.colourData = this.combineBlocks(blocks, colourProperty);
      this.colourVals = _map(this.colourData,
        propertyColour(this.config.tablesById[table].propertiesById[colourProperty]));
      this.colourVals = _map(this.colourVals, (colour) => Color(colour).clearer(0.2).rgbString());
      this.colourValsTranslucent = _map(this.colourVals, (colour) => Color(colour).clearer(0.4).rgbString());
    } else {
      this.colourVals = null;
      this.colourData = null;
    }
    //Filter out big blocks and merge neighbouring ones.
    this.tooBigBlocks = _transform(_filter(blocks, {_tooBig: true}), (merged, block) => {
      const lastBlock = merged[merged.length - 1];
      //if (lastBlock) console.log(lastBlock._blockStart + lastBlock._blockSize, block._blockStart);
      if (lastBlock && lastBlock._blockStart + lastBlock._blockSize === block._blockStart) {
        //Copy to avoid mutating the cache
        merged[merged.length - 1] = {...lastBlock, _blockSize: lastBlock._blockSize + block._blockSize};
      } else {
        merged.push(block);
      }
    });
    this.draw(props);
  },

  hatchRect(ctx, x1, y1, dx, dy, delta) {
    ctx.rect(x1, y1, dx, dy);
    ctx.save();
    ctx.clip();
    let majorAxis = Math.max(dx, dy);
    ctx.beginPath();
    for (let n = -1 * (majorAxis) ; n < majorAxis; n += delta) {
      ctx.moveTo(n + x1, y1);
      ctx.lineTo(dy + n + x1, y1 + dy);
    }
    ctx.stroke();
    ctx.restore();
  },

  draw(props) {
    const {table, width, sideWidth, start, end, colourProperty} = props || this.props;
    const positions = this.positions;
    const colours = this.colourVals;
    const coloursTranslucent = this.colourValsTranslucent;
    const colourData = this.colourData;
    let drawnColourVals = new Set();
    const recordColours = colourProperty && this.config.tablesById[table].propertiesById[colourProperty].isText;
    const canvas = this.refs.canvas;
    if (!canvas)
      return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '14px Roboto';
    let psy = (HEIGHT / 2) - 12;
    const scaleFactor = ((width - sideWidth) / (end - start));
    this.tooBigBlocks.forEach((block) => {
      const pixelStart = scaleFactor * (block._blockStart - start);
      const pixelSize = scaleFactor * ( block._blockSize);
      const textPos = (pixelStart < 0 && pixelStart + pixelSize > width - sideWidth) ? (width - sideWidth) / 2 : pixelStart + (pixelSize / 2);
      this.hatchRect(ctx, pixelStart, psy, pixelSize, 24, 8);
      if (pixelSize > 100) {
        ctx.save();
        ctx.fillStyle = 'black';
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 6;
        ctx.lineJoin = 'miter'; //Prevent letters with tight angles making spikes
        ctx.miterLimit = 2;
        ctx.strokeText('Zoom in', textPos, psy + 12);
        ctx.fillText('Zoom in', textPos, psy + 12);
        ctx.restore();
      }
    });
    ctx.restore();
    //Triangles/Lines
    psy = (HEIGHT / 2) - 6;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillStyle = 'rgba(214, 39, 40, 0.6)';
    const numPositions = positions.length;
    const triangleMode = numPositions < (width - sideWidth);
    for (let i = 0, l = numPositions; i < l; ++i) {
      const psx = scaleFactor * (positions[i] - start);
      if (psx > -6 && psx < width + 6) {
        if (colours) {
          if (triangleMode) {
            ctx.fillStyle = coloursTranslucent[i];
          } else {
            ctx.strokeStyle = colours[i];
          }
          if (recordColours) {
            drawnColourVals.add(colourData[i]);
          }
        }
        ctx.beginPath();
        ctx.moveTo(psx, psy);
        if (triangleMode) {
          ctx.lineTo(psx + 6, psy + 12);
          ctx.lineTo(psx - 6, psy + 12);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.lineTo(psx, psy + 12);
          ctx.stroke();
        }
      }
    }
    //Record drawn values for legend
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
            <span>{name || this.config.tablesById[table].capNamePlural}</span>
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
        'colourProperty',
        'query'
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

    let filterButtonLabel = 'Change Filter';
    let decodedQuery = SQL.WhereClause.decode(query);
    if (!query || decodedQuery.isTrivial) filterButtonLabel = 'Add Filter';

    return (
      <div className="channel-controls">
        <div className="control">
          <FlatButton label={filterButtonLabel}
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
