import React from 'react';
import scrollbarSize from 'scrollbar-size';
import Sidebar from 'react-sidebar';

// Mixins
import PureRenderMixin from 'mixins/PureRenderMixin';
import ConfigMixin from 'mixins/ConfigMixin';
import FluxMixin from 'mixins/FluxMixin';

// Panoptes UI
import SidebarHeader from 'ui/SidebarHeader';
import Icon from 'ui/Icon';

// Panoptes
import PivotTableView from 'panoptes/PivotTableView';
import PropertySelector from 'panoptes/PropertySelector';
import FilterButton from 'panoptes/FilterButton';
import SQL from 'panoptes/SQL';
import QueryString from 'panoptes/QueryString';


let PivotTableWithActions = React.createClass({
  mixins: [
    PureRenderMixin,
    FluxMixin,
    ConfigMixin
  ],

  propTypes: {
    setProps: React.PropTypes.func.isRequired,
    title: React.PropTypes.string,
    sidebar: React.PropTypes.bool,
    table: React.PropTypes.string,
    query: React.PropTypes.string,
    columnProperty: React.PropTypes.string,
    rowProperty: React.PropTypes.string,
  },

  getDefaultProps() {
    return {
      query: SQL.nullQuery,
      setProps: null,
      sidebar: true
    };
  },

  icon() {
    return 'table';
  },

  title() {
    return this.props.title || `Pivot ${this.tableConfig().namePlural}`;
  },

  render() {
    const {sidebar, table, query, columnProperty, rowProperty, setProps} = this.props;

    let sidebarContent = (
      <div className="sidebar pivot-sidebar">
        <SidebarHeader icon={this.icon()} description={`Summary and aggregates of the ${this.tableConfig().namePlural} table`}/>
        <div className="pivot-controls vertical stack">
          <FilterButton table={table} query={query} onPick={(query) => this.props.setProps({query})}/>
          <PropertySelector table={table}
                            key="columnProperty"
                            value={this.config.tablesById[table].propertiesById[columnProperty] ? columnProperty : null}
                            label="Column"
                            allowNull={true}
                            filter={(prop) => prop.isCategorical || prop.isBoolean || prop.isText}
                            onSelect={(v) => setProps({columnProperty: v})}/>
          <PropertySelector table={table}
                            key="rowProperty"
                            value={this.config.tablesById[table].propertiesById[rowProperty] ? rowProperty : null}
                            label="Row"
                            allowNull={true}
                            filter={(prop) => prop.isCategorical || prop.isBoolean || prop.isText}
                            onSelect={(v) => setProps({rowProperty: v})}/>
        </div>
      </div>
    );
    return (
      <Sidebar
        docked={sidebar}
        styles={{sidebar: {paddingRight: `${scrollbarSize()}px`}}}
        sidebar={sidebarContent}>
        <div className="vertical stack">
          <div className="top-bar">
            <Icon className="pointer icon"
                  name={sidebar ? 'arrows-h' : 'bars'}
                  title={sidebar ? 'Expand' : 'Sidebar'}
                  onClick={() => setProps({sidebar: !sidebar})}/>
            <span className="text"><QueryString prepend="Filter:" table={table} query={query}/></span>
          </div>
          <div className="grow">
            <PivotTableView {...this.props}/>
          </div>
        </div>
      </Sidebar>
    );
  }
});

module.exports = PivotTableWithActions;
