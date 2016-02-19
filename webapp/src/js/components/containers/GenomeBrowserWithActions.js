import React from 'react';
import Immutable from 'immutable';
import ImmutablePropTypes from 'react-immutable-proptypes';
import PureRenderMixin from 'mixins/PureRenderMixin';
import _transform from 'lodash/transform';
import _forEach from 'lodash/forEach';
import uid from 'uid';
import FluxMixin from 'mixins/FluxMixin';
import ConfigMixin from 'mixins/ConfigMixin';

import Sidebar from 'react-sidebar';
import SidebarHeader from 'ui/SidebarHeader';
import Icon from 'ui/Icon';
import GenomeBrowser from 'panoptes/genome/GenomeBrowser';

import FlatButton from 'material-ui/lib/flat-button';


let GenomeBrowserWithActions = React.createClass({
  mixins: [PureRenderMixin, FluxMixin, ConfigMixin],

  propTypes: {
    componentUpdate: React.PropTypes.func.isRequired,
    title: React.PropTypes.string,
    sidebar: React.PropTypes.bool,
    chromosome: React.PropTypes.string,
    start: React.PropTypes.number,
    end: React.PropTypes.number,
    components: ImmutablePropTypes.orderedMap
  },

  getDefaultProps() {
    return {
      componentUpdate: null,
      sidebar: true,
      chromosome: '',
      start: 0,
      end: 10000,
      components: Immutable.OrderedMap()
    };
  },

  componentWillMount() {
    this.channelGroups = Immutable.Map();
    //Normal summaries
    _forEach(this.config.summaryValues, (properties, groupId) => {
      this.channelGroups = this.channelGroups.set(groupId, Immutable.fromJS({
        name: groupId === '__reference__' ? 'Reference' : this.config.tables[groupId].tableCapNamePlural,
        icon: groupId === '__reference__' ? 'bitmap:genomebrowser.png' : this.config.tables[groupId].icon,
        items: _transform(properties, (result, prop) => result[prop.propid] = {
          name: prop.name,
          description: groupId === '__reference__' ? 'Description needs to be implemented' : prop.description,
          icon: prop.settings.isCategorical ? 'bar-chart' : 'line-chart',
          payload: prop.settings.isCategorical ? {
            channel: 'CategoricalChannel',
            props: {
              name: prop.name,
              group: groupId,
              track: prop.propid
            }
          } : {
            channel: 'NumericalChannel',
            props: {
              tracks: [{
                track: 'NumericalSummaryTrack',
                name: prop.name,
                props: {
                  group: groupId,
                  track: prop.propid
                }
              }]
            }
          }
        }, {})
      }));
    });
    //Per-row based summaries
    _forEach(this.config.tables, (table, tableId) => {
      if (table.tableBasedSummaryValues) {
        this.channelGroups = this.channelGroups.set(`per_${tableId}`, Immutable.fromJS({
          name: `Per ${table.tableCapNameSingle}`,
          icon: table.icon,
          items: _transform(table.tableBasedSummaryValues, (result, channel) => {
            result[channel.trackid] = {
              name: channel.trackname,
              description: 'Description needs to be implemented',
              icon: 'line-chart',
              payload: {
                channel: 'PerRowNumericalChannel',
                props: {
                  name: channel.trackname,
                  group: tableId,
                  track: channel.trackid
                }
              }
            };
          }, {})
        }));
      }
    });
  },


  icon() {
    return 'bitmap:genomebrowser.png';
  },

  title() {
    return this.props.title || 'Genome Browser';
  },

  handleChannelAdd(newChannels) {
    this.getFlux().actions.session.modalClose();
    this.props.componentUpdate(
      (props) => props.mergeIn(['channels'],
        newChannels.reduce(
          (reduction, item) => reduction.set(uid(10), item.get('payload')),
          Immutable.Map()
        )
      ));
  },

  render() {
    let actions = this.getFlux().actions;
    let {sidebar, componentUpdate, ...subProps} = this.props;
    let sidebarContent = (
      <div className="sidebar">
        <SidebarHeader icon={this.icon()}
                       description="A browser for exploring the reference genome and per-sample data including coverage and mapping qualities."/>
        <FlatButton label="Add Channels"
                    primary={true}
                    onClick={() => actions.session.modalOpen('containers/ItemPicker.js',
                      {
                        title: 'Pick channels to be added',
                        itemName: 'channel',
                        itemVerb: 'add',
                        groups: this.channelGroups,
                        onPick: this.handleChannelAdd
                      })}/>
      </div>
    );
    return (
      <Sidebar
        docked={sidebar}
        sidebar={sidebarContent}>
        <div className="vertical stack">
          <div className="top-bar">
            <Icon className="pointer icon"
                  name={sidebar ? 'arrow-left' : 'bars'}
                  onClick={() => componentUpdate({sidebar: !sidebar})}/>
            <span className="text">WTF</span>
          </div>
          <GenomeBrowser componentUpdate={componentUpdate} sideWidth={150} {...subProps} />
        </div>
      </Sidebar>
    );
  }
});

module.exports = GenomeBrowserWithActions;
