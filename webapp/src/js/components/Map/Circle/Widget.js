import React from 'react';
import {Circle} from 'react-leaflet';

// Mixins
import FluxMixin from 'mixins/FluxMixin';

let CircleWidget = React.createClass({

  mixins: [
    FluxMixin
  ],

  propTypes: {
    center: React.PropTypes.oneOfType([React.PropTypes.string, React.PropTypes.array]),
    radius: React.PropTypes.oneOfType([React.PropTypes.string, React.PropTypes.number]),
  },

  render() {

    let {center, radius} = this.props;

    let adaptedProps = {};

    if (center instanceof Array) {
      adaptedProps.center = center;
    }
    if (typeof center === 'string') {
      // TODO: check the string looks like "[0, 0]" before trying to parse.
      let centerArrayFromString = JSON.parse(center);
      if (centerArrayFromString instanceof Array) {
        adaptedProps.center = centerArrayFromString;
      }
    }

    if (typeof radius === 'number') {
      adaptedProps.radius = radius;
    }
    if (typeof radius === 'string') {
      // TODO: check the string looks like "0" before trying to parse.
      let radiusNumberFromString = Number(radius);
      if (typeof radiusNumberFromString === 'number') {
        adaptedProps.radius = radiusNumberFromString;
      }
    }

    if (adaptedProps.center === undefined || adaptedProps.center === null) {
      console.error('CircleWidget failed to determine center');
    }

    if (adaptedProps.radius === undefined || adaptedProps.radius === null) {
      console.error('CircleWidget failed to determine radius');
    }

    return (
      <Circle
        children={null}
        {...adaptedProps}
      />
    );

  }

});

module.exports = CircleWidget;