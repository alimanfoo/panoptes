import React from 'react';
import Immutable from 'immutable';
import getDisplayName from 'react-display-name';
import _map from 'lodash.map';
import _isString from 'lodash.isstring';
import _isFunction from 'lodash.isfunction';
import _isArray from 'lodash.isarray';

export default function serialiseComponent(component) {
  if (_isArray(component)) {
    throw Error('Attempted to serialise an array - need React component');
  }
  if (_isString(component)) {
    return component;
  }
  let displayName = getDisplayName(component.type);
  displayName = displayName.split('(');
  if (displayName.length > 1) {
    displayName = displayName[1].substr(0,displayName[1].length-1);
  } else {
    displayName = displayName[0];
  }
  if (displayName == 'Component') {
    throw Error('Attempted to serialise a non React component');
  }
  let {children, ...other} = component.props;
  const otherFiltered = {};
  _map(other, (val, key) => {
    if (!_isFunction(val)) {
      otherFiltered[key] = val;
    }
  });
  let props = {};
  if (children) {
    props = {children: React.Children.map(children, serialiseComponent),
      ...otherFiltered
    };
  } else {
    props = otherFiltered;
  }
  return Immutable.fromJS({
    type: displayName,
    props
  });
}
