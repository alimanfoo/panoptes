import React from 'react';

import {WMSTileLayer} from 'react-leaflet';

// Mixins
import FluxMixin from 'mixins/FluxMixin';

/* To use Weather Map Service Tile Layer in templates:

  <p>WMS Tile Layer:</p>
  <div style="width:300px;height:300px">
  <Map center="[37, -97]" zoom="2"><TileLayer /><WMSTileLayer /></Map>
  </div>

*/

let WMSTileLayerWidget = React.createClass({

  mixins: [
    FluxMixin
  ],

  //NB: layerContainer and map might be provided as props rather than context (e.g. <Map><GetsProps><GetsContext /></GetsProps></Map>
  // in which case, we copy those props into context. Props override context.

  contextTypes: {
    layerContainer: React.PropTypes.object,
    map: React.PropTypes.object
  },
  propTypes: {
    attribution: React.PropTypes.string,
    format: React.PropTypes.string,
    layerContainer: React.PropTypes.object,
    layers: React.PropTypes.string,
    map: React.PropTypes.object,
    transparent: React.PropTypes.bool,
    url: React.PropTypes.string.isRequired
  },
  childContextTypes: {
    layerContainer: React.PropTypes.object,
    map: React.PropTypes.object
  },

  getChildContext() {
    return {
      layerContainer: this.props.layerContainer !== undefined ? this.props.layerContainer : this.context.layerContainer,
      map: this.props.map !== undefined ? this.props.map : this.context.map
    };
  },
  getDefaultProps() {
    return {
      attribution: 'Weather data © 2012 IEM Nexrad',
      format: 'image/png',
      layers: 'nexrad-n0r-900913',
      transparent: true,
      url: 'http://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0r.cgi'
    };
  },

  render() {
    let {attribution, format, layers, transparent, url} = this.props;
console.log('WMSTileLayerWidget props: %o', this.props);
    // FIXME: How to handle double quotes inside double quotes inside single quotes (!) in descriptions in templates.

    return (
      <WMSTileLayer
        attribution={attribution}
        children={undefined}
        format={format}
        layers={layers}
        transparent={transparent}
        url={url}
      />
    );

  }

});

module.exports = WMSTileLayerWidget;
