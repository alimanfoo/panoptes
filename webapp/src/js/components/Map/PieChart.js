import React from 'react';

// Mixins
import FluxMixin from 'mixins/FluxMixin';

// Panoptes components
import Map from 'Map/Map';
import FeatureGroup from 'Map/FeatureGroup';
import TileLayer from 'Map/TileLayer';
import PieChartMarkersLayer from 'Map/PieChartMarkersLayer';

let PieChartMap = React.createClass({

  mixins: [
    FluxMixin
  ],

  propTypes: { // NB: componentColumns is not easy enough to supply via template
    chartDataTable: React.PropTypes.string,
    center: React.PropTypes.object,
    componentColumns: React.PropTypes.array,
    setProps: React.PropTypes.func,
    locationDataTable: React.PropTypes.string,
    locationNameProperty: React.PropTypes.string,
    locationSizeProperty: React.PropTypes.string,
    primKey: React.PropTypes.string,
    table: React.PropTypes.string,
    title: React.PropTypes.string,
    zoom: React.PropTypes.number
  },

  title() {
    return this.props.title || 'Pie Chart Map';
  },

  render() {

    let {
      center,
      chartDataTable,
      componentColumns,
      setProps,
      locationDataTable,
      locationNameProperty,
      locationSizeProperty,
      primKey,
      table,
      zoom,
    } = this.props;

    // NB: The table prop is passed by Panoptes, e.g. DataItem
    // The chartDataTable prop is named to distinguish it from the locationDataTable.
    // Either "table" or "chartDataTable" can be used in templates,
    // with chartDataTable taking preference when both are specfied.
    if (chartDataTable === undefined && table !== undefined) {
      chartDataTable = table;
    }

    return (
      <Map
        center={center}
        setProps={setProps}
        style={{height: '100%'}}
        zoom={zoom}
      >
        <FeatureGroup>
          <TileLayer />
          <PieChartMarkersLayer
            locationDataTable={locationDataTable}
            chartDataTable={chartDataTable}
            componentColumns={componentColumns}
            locationNameProperty={locationNameProperty}
            locationSizeProperty={locationSizeProperty}
            primKey={primKey}
          />
        </FeatureGroup>
      </Map>
    );

  }

});

export default PieChartMap;