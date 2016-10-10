import React from 'react';
import PureRenderMixin from 'mixins/PureRenderMixin';
import Immutable from 'immutable';
import ImmutablePropTypes from 'react-immutable-proptypes';
import classNames from 'classnames';
import Highlight from 'react-highlighter';

import TextField from 'material-ui/TextField';
import RaisedButton from 'material-ui/RaisedButton';
import {List, ListItem} from 'material-ui/List';
import _map from 'lodash/map';

import Icon from 'ui/Icon';


let GroupedItemPicker = React.createClass({
  mixins: [
    PureRenderMixin,
  ],

  propTypes: {
    groups: ImmutablePropTypes.mapOf(ImmutablePropTypes.map),
    initialPick: ImmutablePropTypes.listOf(React.PropTypes.string),
    onPick: React.PropTypes.func,
    title: React.PropTypes.string
  },

  getDefaultProps() {
    return {
      groups: Immutable.Map(),
      initialPick: Immutable.List(),
      title: 'Pick items'
    };
  },

  getInitialState() {
    return {
      picked: this.props.initialPick.toSet(),
      search: ''
    };
  },

  componentWillMount() {
  },

  icon() {
    return 'check-square-o';
  },
  title() {
    return this.props.title;
  },

  handleEnter() {
    this.handlePick();
  },

  handleAdd(propId) {
    if (this.state.picked.has(propId))
      this.setState({picked: this.state.picked.delete(propId)});
    else
      this.setState({picked: this.state.picked.add(propId)});
  },
  handleAddAll(groupId) {
    let toAdd = this.props.groups.getIn([groupId, 'properties']).map((prop) => prop.get('id'));
    this.setState({picked: this.state.picked.union(toAdd)});
  },
  handleRemove(propId) {
    this.setState({picked: this.state.picked.delete(propId)});
  },
  handleRemoveAll(groupId) {
    let toRemove = this.props.groups.getIn([groupId, 'properties']).map((prop) => prop.get('id'));
    this.setState({picked: this.state.picked.subtract(toRemove)});
  },
  handleSearchChange(event) {
    this.setState({'search': event.target.value});
  },

  handlePick() {
    let result = Immutable.List();
    this.props.groups.forEach((group) => {
      group.get('properties').forEach((prop) => {
        if (this.state.picked.has(prop.get('id'))) {
          result = result.push(prop.get('id'));
        }
      });
    }
    );
    this.props.onPick(result);
  },

  render() {
    let {picked, search} = this.state;
    let {groups} = this.props;
    let count = groups.map((group) => group.get('properties').size).reduce((sum, v) => sum + v, 0);
    //"toJS" needed due to https://github.com/facebook/immutable-js/issues/554
    return (
      <div className="large-modal item-picker">
        <div className="horizontal stack">
          <div className="grow stack vertical scroll-within">
            <div>
              <div className="header">{count} Column{count != 1 ? 's' : null} Available</div>
              <div className="search">
                <TextField floatingLabelText="Search" value={search} onChange={this.handleSearchChange}/>
              </div>
            </div>
            <div style={{overflow: 'auto'}}>
              <List>
                {
                  _map(groups.toJS(), (group) => {
                    let {id, name, properties} = group;
                    let subItems = properties.map((prop) => {
                      let {name, description, id,  icon} = prop;
                      return (`${name}#${(description || '')}`).toLowerCase().indexOf(search.toLowerCase()) > -1 ? (
                            <ListItem className={classNames({picked: !picked.includes(id)})}
                                      key={id}
                                      primaryText={<div><Highlight search={search}>{name}</Highlight></div>}
                                      secondaryText={<div><Highlight search={search}>{description}</Highlight></div>}
                                      leftIcon={<div><Icon fixedWidth={true} name={icon} /></div>}
                                      onClick={() => this.handleAdd(id)}
                              />) : null;
                    }
                      );
                    return subItems.filter((i) => i).length > 0 ? (
                      <ListItem primaryText={name}
                                key={id}
                                initiallyOpen={true}
                                //leftIcon={<div><Icon fixedWidth={true} name="plus"/></div>}
                                onClick={() => this.handleAddAll(id)}
                                nestedItems={subItems}
                        />

                    ) : null;
                  })
                }
              </List>
            </div>
          </div>
          <div className="grow stack vertical">
            <div>
              <div className="header">{picked.size ? picked.size : 'No'} Column{picked.size != 1 ? 's' : null} Selected</div>
            </div>
            <div className="scroll-within">
              <List>
                {
                  _map(groups.toJS(), (group) => {
                    let {id, name, properties} = group;
                    return ( picked.intersect(properties.map((prop) => prop.id)).size > 0 ?
                        <ListItem primaryText={name}
                                  key={id}
                                  initiallyOpen={true}
                                  onClick={() => this.handleRemoveAll(id)}
                                  nestedItems={
                      properties.map((prop) => {
                        let {name, description, id, icon} = prop;
                        return picked.includes(id) ? (
                            <ListItem key={id}
                                      secondaryText={description}
                                      primaryText={name}
                                      leftIcon={<div><Icon fixedWidth={true} name={icon}/></div>}
                                      onClick={() => this.handleRemove(id)}/>
                          ) : null;
                      }
                      )
                    }
                          /> : null
                    );
                  })
                }

              </List>
            </div>
            <div className="centering-container">
              <RaisedButton label="Use" primary={true} onClick={this.handlePick}/>
            </div>
          </div>
        </div>
      </div>
    );
  }

});

module.exports = GroupedItemPicker;
