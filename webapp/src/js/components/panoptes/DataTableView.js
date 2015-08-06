const React = require('react');
const Immutable = require('immutable');
const ImmutablePropTypes = require('react-immutable-proptypes');
const classNames = require('classnames');

const PureRenderMixin = require('mixins/PureRenderMixin');
const FluxMixin = require('mixins/FluxMixin');
const ConfigMixin = require('mixins/ConfigMixin');
const SetSizeToParent = require('mixins/SetSizeToParent');

const API = require('panoptes/API');
const ErrorReport = require('panoptes/ErrorReporter');
const SQL = require('panoptes/SQL');

const {Table, Column} = require('fixed-data-table');
import 'fixed-data-table/dist/fixed-data-table.css';

const Loading = require('ui/Loading');
const Icon = require('ui/Icon');

let DataTableView = React.createClass({
  mixins: [
    PureRenderMixin,
    FluxMixin,
    ConfigMixin,
    SetSizeToParent
  ],

  propTypes: {
    table: React.PropTypes.string.isRequired,
    query: React.PropTypes.string.isRequired,
    order: React.PropTypes.string,
    ascending: React.PropTypes.bool,
    start: React.PropTypes.number,
    columns: ImmutablePropTypes.listOf(React.PropTypes.string),
    columnWidths: ImmutablePropTypes.mapOf(React.PropTypes.number),
    onColumnResize: React.PropTypes.func,
    onOrderChange: React.PropTypes.func
  },

  getDefaultProps() {
    return {
      table: null,
      query: SQL.WhereClause.encode(SQL.WhereClause.Trivial()),
      order: null,
      ascending: true,
      start: 0,
      columns: Immutable.List(),
      columnWidths: Immutable.Map()
    };
  },

  getInitialState() {
    return {
      rows: [],
      loadStatus: 'loaded',
      size: {
        width: 0,
        height: 0
      }
    };
  },

  componentDidMount() {
    this.getDataIfNeeded({}, this.props);
  },
  componentWillReceiveProps(nextProps) {
    this.getDataIfNeeded(this.props, nextProps);
  },

  getDataIfNeeded(lastProps, nextProps) {
    let queryKeys = ['table', 'query', 'columns', 'order', 'ascending', 'start'];
    let update_needed = false;
    queryKeys.forEach((key) => {
      if (!Immutable.is(lastProps[key], nextProps[key]))
        update_needed = true;
    });
    if (update_needed)
      this.fetchData(nextProps);
  },

  fetchData(props) {
    let { table, query, className, columns, order, ascending } = props;
    let tableConfig = this.config.tables[table];
    this.setState({loadStatus: 'loading'});
    let columnspec = {};
    columns.map(column => columnspec[column] = tableConfig.propertiesMap[column].defaultFetchEncoding);

    API.pageQuery({
      database: this.config.dataset,
      table: table,
      columns: columnspec,
      order: order,
      ascending: ascending,
      query: SQL.WhereClause.decode(query)
    })
      .then((data) => {
        this.setState({loadStatus: 'loaded'});
        this.setState({rows: data});
      })
      .catch((error) => {
        ErrorReport(this.getFlux(), error.message, () => this.fetchData(props));
        this.setState({loadStatus: 'error'});
      });

  },

  headerData(column) {
    return {
      ascending: this.props.order == column && this.props.ascending,
      descending: this.props.order == column && !this.props.ascending
    }
  },

  handleColumnResize(width, column) {
    if (this.props.onColumnResize)
      this.props.onColumnResize(column, width);
    //So that "isResizing" on FDT gets set back to false, force an update
    this.forceUpdate();
  },

  handleOrderChange(column) {
    let ascending = true;
    if (this.props.order == column)
      if (this.props.ascending)
        ascending = false;
      else
        column = null;
    if (this.props.onOrderChange) {
      this.props.onOrderChange(column, ascending)
    }
  },

  renderHeader(headerData, cellDataKey, columnData, rowData, width) {
    let {ascending, descending} = headerData;
    let {description} = columnData;
    console.log(columnData);
    return <div className={classNames({
                              "pointer": true,
                              "table-row-header": true,
                              "sort-column-ascending": ascending,
                              "sort-column-descending": descending
                                    })}
                style={{width:width}}
                onClick={() => this.handleOrderChange(columnData.propid)}>
      {(ascending || descending) ?
        <Icon className="sort" name={ascending ? "sort-amount-asc" : "sort-amount-desc"}/> :
        null}
      <span className="label">{columnData.name}</span>
      {description ? <Icon className="info" name="info-circle"/> : null}
    </div>
  },

  renderCell(cellData, cellDataKey, rowData, rowIndex, columnData, width) {
    return <div className="table-cell"
                style={{textAlign:columnData.alignment, width:width}}>
      {cellData}
    </div>
  },

  render() {
    let { query, className, columns, columnWidths } = this.props;
    let { loadStatus, rows, width, height } = this.state;
    let tableConfig = this.config.tables[this.props.table];
    if (!tableConfig) {
      console.log(`Table ${this.props.table} doesn't exist'`);
      return null;
    }
    return (
      <div className={classNames("datatable", className)}>
        <Table
          rowHeight={30}
          rowGetter={(index) => rows[index]}
          rowsCount={rows.length}
          width={width}
          height={height}
          headerHeight={50}
          headerDataGetter={this.headerData}
          onColumnResizeEndCallback={this.handleColumnResize}
          isColumnResizing={false}
          >
          {columns.map(column => {
            if (!tableConfig.propertiesMap[column]) {
              console.log(`Column ${column} doesn't exist on ${this.props.table}.`);
              return;
            }
            let columnData = tableConfig.propertiesMap[column];
            let {propid} = columnData;
            return <Column
              //TODO Better default column widths
              width={columnWidths.get(column,150)}
              dataKey={propid}
              key={propid}
              allowCellsRecycling={true}
              cellRenderer={this.renderCell}
              headerRenderer={this.renderHeader}
              columnData={columnData}
              isResizable={true}
              minWidth={50}
              />
          })
          }
        </Table>
        <Loading status={loadStatus}/>
      </div>
    );
  }

});

module.exports = DataTableView;
