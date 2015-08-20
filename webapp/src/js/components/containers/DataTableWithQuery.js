const React = require('react');
const Immutable = require('immutable');
const ImmutablePropTypes = require('react-immutable-proptypes');
const PureRenderMixin = require('mixins/PureRenderMixin');

const FluxMixin = require('mixins/FluxMixin');
const ConfigMixin = require('mixins/ConfigMixin');
const StoreWatchMixin = require('mixins/StoreWatchMixin');

const Sidebar = require('react-sidebar');
const SidebarHeader = require('ui/SidebarHeader');
const Icon = require('ui/Icon');
const DataTableView = require('panoptes/DataTableView');
const QueryString = require('panoptes/QueryString');

const mui = require('material-ui');
const {FlatButton} = mui;

//For mock data:
const SQL = require('panoptes/SQL');
const shallowEqual = require('shallow-equals');

let DataTableWithQuery = React.createClass({
  mixins: [PureRenderMixin, FluxMixin, ConfigMixin],

  propTypes: {
    componentUpdate: React.PropTypes.func.isRequired,
    title: React.PropTypes.string,
    table: React.PropTypes.string.isRequired,
    query: React.PropTypes.string,
    order: React.PropTypes.string,
    ascending: React.PropTypes.bool,
    columns: ImmutablePropTypes.listOf(
      React.PropTypes.string
    ),
    columnWidths: ImmutablePropTypes.mapOf(React.PropTypes.number),
    start: React.PropTypes.number,
    sidebar: React.PropTypes.bool
  },

  getDefaultProps() {
    return {
      componentUpdate: null,
      table: null,
      query: SQL.WhereClause.encode(SQL.WhereClause.Trivial()),
      order: null,
      ascending: true,
      columns: Immutable.List(),
      columnWidths: Immutable.Map(),
      start: 0,
      sidebar: true
    };
  },

  componentWillMount() {
    this.config = this.config.tables[this.props.table];
  },

  icon() {
    return this.config.icon;
  },

  title() {
    return this.props.title || this.config.tableCapNamePlural;
  },

  handleQueryPick(query) {
    this.getFlux().actions.session.modalClose();
    this.props.componentUpdate({query: query});
  },

  handleColumnResize(column, size) {
    this.props.componentUpdate({columnWidths:{[column]:size}});
  },

  handleOrderChange(column, ascending) {
    this.props.componentUpdate({order:column, ascending: ascending});
  },

  render() {
    let actions = this.getFlux().actions;
    let {table, query, columns, columnWidths, order, ascending, sidebar, componentUpdate} = this.props;
    let {icon, description} = this.config;

    let sidebar_content = (
      <div className="sidebar">
        <SidebarHeader icon={icon} description={description}/>
        <FlatButton label="Change Filter"
                    primary={true}
                    onClick={() => actions.session.modalOpen('containers/QueryPicker',
                      {
                        table: table,
                        initialQuery: query,
                        onPick: this.handleQueryPick
                      })}/>
      </div>
    );
//Column stuff https://github.com/cggh/panoptes/blob/1518c5d9bfab409a2f2dfbaa574946aa99919334/webapp/scripts/Utils/MiscUtils.js#L37
    //https://github.com/cggh/DQX/blob/efe8de44aa554a17ab82f40c1e421b93855ba83a/DataFetcher/DataFetchers.js#L573
    return (
      <Sidebar
        docked={sidebar}
        sidebar={sidebar_content}>
        <div className="vertical stack">
          <div className="top-bar">
            <Icon className='pointer icon'
                  name={sidebar ? 'arrow-left' : 'bars'}
                  onClick={() => componentUpdate({sidebar: !sidebar})}/>
            <QueryString className='text' prepend='Filter:' table={table} query={query}/>
            <span className='text'>Sort: {order ? this.config.propertiesMap[order].name : "None"} {order ? (ascending ? 'ascending' : 'descending') : null}</span>

          </div>
          <DataTableView className='grow'
                         table={table}
                         query={query}
                         order={order}
                         ascending={ascending}
                         columns={columns}
                         columnWidths={columnWidths}
                         onColumnResize={this.handleColumnResize}
                         onOrderChange={this.handleOrderChange}
            />
        </div>
      </Sidebar>
    );
  }
});

module.exports = DataTableWithQuery;
