import React from 'react';
import classNames from 'classnames';
// import Color from 'color';
import _uniq from 'lodash/uniq';

// Mixins
import PureRenderMixin from 'mixins/PureRenderMixin';
import FluxMixin from 'mixins/FluxMixin';
import ConfigMixin from 'mixins/ConfigMixin';
import DataFetcherMixin from 'mixins/DataFetcherMixin';

import {Table, Column} from 'fixed-data-table';
import 'fixed-data-table/dist/fixed-data-table.css';

// Panoptes components
import API from 'panoptes/API';
import LRUCache from 'util/LRUCache';
import ErrorReport from 'panoptes/ErrorReporter';
import SQL from 'panoptes/SQL';
import PropertyCell from 'panoptes/PropertyCell';
import PropertyHeader from 'panoptes/PropertyHeader';

// UI components
import Loading from 'ui/Loading';
import DetectResize from 'utils/DetectResize';

// Constants in this component
// const MAX_COLOR = Color('#44aafb');
const ROW_HEIGHT = 30;
const HEADER_HEIGHT = 50;
// const SCROLLBAR_HEIGHT = 15;
const COLUMN_WIDTH = 100;

let PivotTableView = React.createClass({
  mixins: [
    PureRenderMixin,
    FluxMixin,
    ConfigMixin,
    DataFetcherMixin('table', 'query', 'columnProperty', 'rowProperty')
  ],

  propTypes: {
    table: React.PropTypes.string.isRequired,
    query: React.PropTypes.string,
    columnProperty: React.PropTypes.string,
    rowProperty: React.PropTypes.string,
    className: React.PropTypes.string
  },


  getDefaultProps() {
    return {
      query: SQL.nullQuery,
    };
  },

  getInitialState() {
    return {
      uniqueColumns: [],
      uniqueRows: [],
      loadStatus: 'loaded',
      width: 0,
      height: 0,
    };
  },

  //Called by DataFetcherMixin
  fetchData(props, requestContext) {
    let {table, query, columnProperty, rowProperty} = props;
    let tableConfig = this.config.tablesById[table];
    let columns = [
      {expr: ['count', ['*']], as: 'count'}
    ];
    let groupBy = [];
    if (columnProperty) {
      columns.push(columnProperty);
      groupBy.push(columnProperty);
    }
    if (rowProperty) {
      columns.push(rowProperty);
      groupBy.push(rowProperty);
    }
    columns = _uniq(columns);
    groupBy = _uniq(groupBy);
    this.setState({loadStatus: 'loading', dataByColumnRow: null, uniqueColumns: [], uniqueRows: []});

    let queryAPIargs = {
      database: this.config.dataset,
      table: tableConfig.fetchTableName,
      columns: columns,
      query: query,
      groupBy,
      start: 0,
      stop: 1000,
      transpose: false
    };

    requestContext.request((componentCancellation) =>
        LRUCache.get(
          'query' + JSON.stringify(queryAPIargs),
          (cacheCancellation) =>
            API.query({cancellation: cacheCancellation, ...queryAPIargs}),
          componentCancellation
        )
    )
    .then((data) => {
      let columnData = data[columnProperty];
      let rowData = data[rowProperty];
      let countData = data['count'];
      let uniqueColumns = ['_all_'].concat(columnData ? _uniq(columnData.array) : []);
      let uniqueRows = ['_all_'].concat(rowData ? _uniq(rowData.array) : []);
      let dataByColumnRow = {};
      uniqueColumns.forEach((columnValue) => dataByColumnRow[columnValue] = {'_all_': 0});
      dataByColumnRow['_all_'] = {};
      uniqueRows.forEach((rowValue) => dataByColumnRow['_all_'][rowValue] = 0);
      for (let i = 0; i < countData.shape[0]; ++i) {
        dataByColumnRow['_all_']['_all_'] += countData.array[i];
        if (columnProperty) {
          dataByColumnRow[columnData.array[i]]['_all_'] += countData.array[i];
        }
        if (rowProperty) {
          dataByColumnRow['_all_'][rowData.array[i]] += countData.array[i];
        }
        if (columnProperty && rowProperty) {
          dataByColumnRow[columnData.array[i]][rowData.array[i]] = countData.array[i];
        }
      }
      this.setState({
        loadStatus: 'loaded',
        uniqueRows,
        uniqueColumns,
        dataByColumnRow
      });
    })
    .catch(API.filterAborted)
    .catch(LRUCache.filterCancelled)
    .catch((xhr) => {
      ErrorReport(this.getFlux(), API.errorMessage(xhr), () => this.fetchData(this.props));
      this.setState({loadStatus: 'error'});
    })
    .done();
  },

  handleResize(size) {
    this.setState(size);
  },

  onClickHeader(ev,property,primKey) {
  	let tableConfig = this.tableConfig();
  	if ( typeof tableConfig.propertiesById[property].relation == 'undefined' ) return false ;
  	let r = tableConfig.propertiesById[property].relation ;
	ev.stopPropagation();
	this.getFlux().actions.panoptes.dataItemPopup({table: r.tableId, primKey: primKey.toString(), switchTo: false});
  	return false ;
  },

  render() {
    let {className, columnProperty, rowProperty} = this.props;
    let {loadStatus, uniqueRows, uniqueColumns, dataByColumnRow, width, height} = this.state;
    let tableConfig = this.tableConfig();
    if (!tableConfig) {
      console.error(`Table ${this.props.table} doesn't exist'`);
      return null;
    }
    if (!dataByColumnRow)
      return null;

	let distinctValuesCol = {} ;
	if ( typeof tableConfig.propertiesById[columnProperty].distinctValues != 'undefined' ) {
		distinctValuesCol = JSON.parse ( tableConfig.propertiesById[columnProperty].distinctValues ) ;
	}

    return (
      <DetectResize onResize={this.handleResize}>
        <div className={classNames('datatable', className)}>
          <Table
            rowHeight={ROW_HEIGHT}
            rowsCount={uniqueRows.length}
            width={width}
            height={height}
            headerHeight={HEADER_HEIGHT}
            //headerDataGetter={this.headerData}
            //onColumnResizeEndCallback={this.handleColumnResize}
            isColumnResizing={false}
          >
            <Column
              //TODO Better default column widths
              width={COLUMN_WIDTH}
              allowCellsRecycling={true}
              isFixed={true}
              isResizable={false}
              minWidth={50}
              header=""
              cell={({rowIndex}) =>
                  <div className="table-row-cell"
                       style={{
                         textAlign: uniqueRows[rowIndex] == '_all_' ? 'center' : tableConfig.propertiesById[rowProperty].alignment,
                         width: COLUMN_WIDTH,
                         height: ROW_HEIGHT + 'px',
                         //background: background
                       }}>
                    {
                       uniqueRows[rowIndex] == '_all_' ? 'All' :
                      	(

                        <PropertyHeader 
                        	name={uniqueRows[rowIndex]} 
                        	html={(distinctValuesCol[uniqueRows[rowIndex]]||{}).html} 
                        	description={((distinctValuesCol[uniqueRows[rowIndex]]||{}).description)} 
                        	onClick={(e) => this.onClickHeader(e, rowProperty, uniqueRows[rowIndex])}
                        	tooltipPlacement={"right"} />
                        )
                    }
                  </div>
                }
            />
            {uniqueColumns.map((columnValue) => <Column
                //TODO Better default column widths
                width={COLUMN_WIDTH}
                key={columnValue}
                allowCellsRecycling={true}
                isResizable={false}
                minWidth={50}
                header={
                    <div className="table-row-cell"
                         style={{
                           textAlign: columnValue == '_all_' ? 'center' : tableConfig.propertiesById[columnProperty].alignment,
                           width: COLUMN_WIDTH,
                           height: HEADER_HEIGHT + 'px',
                           background: ((distinctValuesCol[columnValue]||{})['header-background']||'inherit')
                         }}>
                      {
                       columnValue == '_all_' ? 'All' :
                      	(
                        <PropertyHeader 
                        	name={columnValue} 
                        	html={(distinctValuesCol[columnValue]||{}).html} 
                        	description={((distinctValuesCol[columnValue]||{}).description)} 
                        	onClick={(e) => this.onClickHeader(e, columnProperty, columnValue)}
                        	tooltipPlacement={"right"} />
                        )
                    	}
                    </div>
                }
                cell={({rowIndex}) =>
                    <div className="table-row-cell"
                         style={{
                           textAlign: 'right',
                           width: COLUMN_WIDTH,
                           height: ROW_HEIGHT + 'px',
                           background: ((distinctValuesCol[columnValue]||{})['cell-background']||'inherit')
                         }}>
                      {(dataByColumnRow[columnValue][uniqueRows[rowIndex]] || '').toLocaleString()}
                    </div>
                  }
              />)
            }
          </Table>
          <Loading status={loadStatus}/>
        </div>
      </DetectResize>
      );
  }

});

module.exports = PivotTableView;
