import React from 'react';
import _isEmpty from 'lodash/isEmpty';
import SQL from 'panoptes/SQL';
import withAPIData from 'hoc/withAPIData';
import LegendElement from 'panoptes/LegendElement';
import {propertyColour} from 'util/Colours';

let ColourPropertyLegend = React.createClass({

  propTypes: {
    table: React.PropTypes.string.isRequired,
    labelProperty: React.PropTypes.string,
    maxLegendItems: React.PropTypes.number,
    colourProperty: React.PropTypes.string.isRequired,
    config: React.PropTypes.object, // This will be provided via withAPIData
    data: React.PropTypes.array // This will be provided via withAPIData
  },

  getDefaultProps() {
    return {
      query: SQL.nullQuery
    };
  },

  render() {
    let {table, labelProperty, maxLegendItems, colourProperty, config, data} = this.props;

    // NOTE: render() is still called when isRequired props are undefined.

    if (data === undefined || data === null) {
      return null;
    }

    // If a labelProperty has not been provided, then use the table's primKey.
    labelProperty = labelProperty === undefined ? config.tablesById[table].primKey : labelProperty;

    const labelPropConfig = config.tablesById[table].propertiesById[labelProperty];
    const colourPropConfig = config.tablesById[table].propertiesById[colourProperty];
    const colourFunc = propertyColour(colourPropConfig);

    // Translate the apiData data into legendElements.
    let legendElements = [];

    for (let i = 0; i < data.length; i++) {

      let label = data[i][labelProperty];
      let colour = data[i][colourProperty];

      let legendElement = <LegendElement key={'LegendElement_' + i} name={label !== null ? label : 'NULL'} colour={colourFunc(colour)} />;

      legendElements.push(legendElement);

    }

    if (_isEmpty(legendElements)) {
      return null;
    }

    return <div className="legend">
      <div className="legend-element">{labelPropConfig.name}:</div>
      {maxLegendItems === undefined || (maxLegendItems !== undefined && legendElements.length < maxLegendItems) ?
        legendElements
      : legendElements.slice(0, maxLegendItems).concat([<div key="more" className="legend-element">+{legendElements.length - maxLegendItems} more</div>])
      }
    </div>;
  }
});

ColourPropertyLegend = withAPIData(ColourPropertyLegend, ({config, props}) => {

  let {table, colourProperty, labelProperty, query} = props;

  let columns = [colourProperty, (labelProperty === undefined ? config.tablesById[table].primKey : labelProperty)];

  return {
    data: {
      method: 'query',
      args: {
        database: config.dataset,
        table,
        columns,
        query,
        transpose: true
      }
    }
  };
});

export default ColourPropertyLegend;