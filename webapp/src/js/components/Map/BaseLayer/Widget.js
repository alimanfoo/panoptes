import React from 'react';

import {LayersControl} from 'react-leaflet';
const {BaseLayer} = LayersControl;

// Mixins
import FluxMixin from 'mixins/FluxMixin';

import filterChildren from 'util/filterChildren';

const ALLOWED_CHILDREN = [
  'TileLayerWidget',
  'FeatureGroupWidget',
];

let BaseLayerWidget = React.createClass({

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
    addBaseLayer: React.PropTypes.func,
    checked: React.PropTypes.bool,
    children: React.PropTypes.node,
    layerContainer: React.PropTypes.object,
    map: React.PropTypes.object,
    name: React.PropTypes.string.isRequired
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
      name: 'Base Layer'
    };
  },

  render() {
    let {addBaseLayer, checked, children, name} = this.props;
    children = filterChildren(this, children, ALLOWED_CHILDREN);

    let checkedBoolean = null;
    if (
      (typeof checked === 'string' && checked.toLowerCase() === 'true')
      || (typeof checked === 'boolean' && checked === true)
    ) {
      checkedBoolean = true;
    } else {
      checkedBoolean = false;
    }

    if (checkedBoolean === null) {
      console.error('BaseLayerWidget could not determine checked status');
    }

    return (
      <BaseLayer
        checked={checkedBoolean}
        name={name}
        children={React.Children.only(children)}
        addBaseLayer={addBaseLayer}
      />
    );

  }

});

module.exports = BaseLayerWidget;
