import React from 'react';

// Mixins
import ConfigMixin from 'mixins/ConfigMixin';
import DataFetcherMixin from 'mixins/DataFetcherMixin';
import FluxMixin from 'mixins/FluxMixin';

// Panoptes
import API from 'panoptes/API';
import CalcMapBounds from 'util/CalcMapBounds';
import ComponentMarker from 'Map/ComponentMarker/Widget';
import ErrorReport from 'panoptes/ErrorReporter';
import FeatureGroup from 'Map/FeatureGroup/Widget';
import LRUCache from 'util/LRUCache';
import SQL from 'panoptes/SQL';

let TableMarkersLayer = React.createClass({

  mixins: [
    FluxMixin,
    ConfigMixin,
    DataFetcherMixin('highlight', 'locationDataTable', 'primKey', 'query', 'table')
  ],

  //NB: layerContainer and map might be provided as props rather than context (e.g. <Map><GetsProps><GetsContext /></GetsProps></Map>
  // in which case, we copy those props into context. Props override context.

  contextTypes: {
    layerContainer: React.PropTypes.object,
    map: React.PropTypes.object,
    changeLayerStatus: React.PropTypes.func
  },
  propTypes: {
    highlight: React.PropTypes.string,
    layerContainer: React.PropTypes.object,
    locationDataTable: React.PropTypes.string,
    map: React.PropTypes.object,
    primKey: React.PropTypes.string, // if not specified then all locationDataTable records are used
    query: React.PropTypes.string,
    table: React.PropTypes.string // An alias for locationDataTable
  },
  childContextTypes: {
    layerContainer: React.PropTypes.object,
    map: React.PropTypes.object,
    onClickMarker: React.PropTypes.func
  },

  getChildContext() {
    return {
      layerContainer: this.props.layerContainer !== undefined ? this.props.layerContainer : this.context.layerContainer,
      map: this.props.map !== undefined ? this.props.map : this.context.map,
      onClickMarker: this.handleClickMarker
    };
  },

  getInitialState() {
    return {
      markers: []
    };
  },

  // Event handlers
  handleClickMarker(e, marker) {
    const middleClick =  e.originalEvent.button == 1 || e.originalEvent.metaKey || e.originalEvent.ctrlKey;
    if (!middleClick) {
      e.originalEvent.stopPropagation();
    }
    this.getFlux().actions.panoptes.dataItemPopup({table: marker.table, primKey: marker.primKey, switchTo: !middleClick});
  },

  getDefinedQuery() {
    let definedQuery = this.props.query;
    if (definedQuery === undefined) {
      definedQuery = this.tableConfig().defaultQuery !== undefined ? this.tableConfig().defaultQuery : SQL.nullQuery;
    }
    return definedQuery;
  },

  fetchData(props, requestContext) {

    let {highlight, locationDataTable, primKey, table} = props;

    let {changeLayerStatus} = this.context;

    changeLayerStatus({loadStatus: 'loading'});

    // NB: The locationDataTable prop is named to distinguish it from the chartDataTable.
    // Either "table" or "locationDataTable" can be used in templates,
    // with locationDataTable taking preference when both are specfied.
    if (locationDataTable === undefined && table !== undefined) {
      locationDataTable = table;
    }

    let locationTableConfig = this.config.tablesById[locationDataTable];
    if (locationTableConfig === undefined) {
      console.error('locationTableConfig === undefined');
      return null;
    }
    // Check that the table specified for locations has geographic coordinates.
    if (locationTableConfig.hasGeoCoord === false) {
      console.error('locationTableConfig.hasGeoCoord === false');
      return null;
    }

    let locationPrimKeyProperty = locationTableConfig.primKey;

    // TODO: support lngProperty and latProperty props, to specify different geo columns.
    // If specified, use the lat lng properties from the props.
    // Otherwise, use the lat lng properties from the config.
    // let locationLongitudeProperty = lngProperty ? lngProperty : locationTableConfig.longitude;
    // let locationLatitudeProperty = latProperty ? latProperty : locationTableConfig.latitude;

    let locationLongitudeProperty = locationTableConfig.longitude;
    let locationLatitudeProperty = locationTableConfig.latitude;

    let locationColumns = [locationPrimKeyProperty, locationLongitudeProperty, locationLatitudeProperty];

    // If no highlight has been specified, but a primKey has beem then convert primKey to a highlight.
    if (highlight === undefined && primKey !== undefined) {
      highlight =  locationPrimKeyProperty + ':' + primKey;
    }

    // TODO: check highlight looks like "highlightField:highlightValue"
    if (highlight !== undefined && typeof highlight === 'string' && highlight !== '') {
      let [highlightField] = highlight.split(':');
      if (highlightField !== undefined) {
        if (locationTableConfig.propertiesById[highlightField] === undefined) {
          console.error('The specified highlight field ' + highlightField + ' was not found in the table ' + locationDataTable);
        } else {
          locationColumns.push(highlightField);
        }
      }
    }

    requestContext.request(
      (componentCancellation) => {

        // Get all markers using the specified table.
        let locationAPIargs = {
          columns: locationColumns,
          database: this.config.dataset,
          query: this.getDefinedQuery(),
          table: locationTableConfig.id,
          transpose: true
        };

        return LRUCache.get(
          'query' + JSON.stringify(locationAPIargs), (cacheCancellation) =>
            API.query({
              cancellation: cacheCancellation,
              ...locationAPIargs
            }),
          componentCancellation
        );

      })
      .then((data) => {

        let markers = [];

        // Translate the fetched locationData into markers.
        let locationTableConfig = this.config.tablesById[locationDataTable];
        let locationPrimKeyProperty = locationTableConfig.primKey;

        let highlightField, highlightValue = null;

        // TODO: check highlight looks like "highlightField:highlightValue"
        if (highlight !== undefined && typeof highlight === 'string' && highlight !== '') {
          [highlightField, highlightValue] = highlight.split(':');
        }

        for (let i = 0; i < data.length; i++) {

          let locationDataPrimKey = data[i][locationPrimKeyProperty];

          let isHighlighted = false;
          if (highlightField !== null && highlightValue !== null) {
            isHighlighted = (data[i][highlightField] === highlightValue ? true : false);
          }

          markers.push({
            isHighlighted: isHighlighted,
            table: locationDataTable,
            lat: parseFloat(data[i][locationTableConfig.latitude]),
            lng: parseFloat(data[i][locationTableConfig.longitude]),
            primKey: locationDataPrimKey,
            title: locationDataPrimKey,
          });

        }

        this.setState({markers});
        changeLayerStatus({loadStatus: 'loaded', bounds: CalcMapBounds.calcMapBounds(markers)});
      })
      .catch(API.filterAborted)
      .catch(LRUCache.filterCancelled)
      .catch((error) => {
        ErrorReport(this.getFlux(), error.message, () => this.fetchData(props));
        changeLayerStatus({loadStatus: 'error'});
      });
  },

  render() {

    let {layerContainer, map} = this.context;
    let {markers} = this.state;

    if (!markers.length) {
      return null;
    }

    let markerWidgets = [];

    for (let i = 0, len = markers.length; i < len; i++) {

      let marker = markers[i];

      if (marker.isHighlighted || len === 1) {

        markerWidgets.push(
          <ComponentMarker
            key={i}
            position={{lat: marker.lat, lng: marker.lng}}
            title={marker.title}
            onClick={(e) => this.handleClickMarker(e, marker)}
          />
        );

      } else {

        markerWidgets.push(
          <ComponentMarker
            key={i}
            position={{lat: marker.lat, lng: marker.lng}}
            title={marker.title}
            onClick={(e) => this.handleClickMarker(e, marker)}
          >
            <svg height="12" width="12">
              <circle cx="6" cy="6" r="5" stroke="#1E1E1E" strokeWidth="1" fill="#3D8BD5" />
            </svg>
          </ComponentMarker>
        );

      }

    }

    return (
      <FeatureGroup
        children={markerWidgets}
        layerContainer={layerContainer}
        map={map}
      />
    );

  }

});

module.exports = TableMarkersLayer;
