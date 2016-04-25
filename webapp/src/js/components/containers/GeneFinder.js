import React from 'react';

// Lodash
import _map from 'lodash/map';

// Mixins
import PureRenderMixin from 'mixins/PureRenderMixin';
import FluxMixin from 'mixins/FluxMixin';
import ConfigMixin from 'mixins/ConfigMixin';

// Material UI
import {List, ListItem} from 'material-ui/List';
import Subheader from 'material-ui/Subheader';
import RaisedButton from 'material-ui/RaisedButton';
import FlatButton from 'material-ui/FlatButton';
import TextField from 'material-ui/TextField';

import Icon from 'ui/Icon';

// Panoptes
import GeneSearchResultsList from 'panoptes/GeneSearchResultsList';
import RegionGenesList from 'panoptes/RegionGenesList';
import API from 'panoptes/API';

const DEFAULT_MAX_POSITION = 1000000000;

let GeneFinder = React.createClass({
  mixins: [
    PureRenderMixin,
    FluxMixin,
    ConfigMixin
  ],

  getDefaultProps() {
    return {
      icon: 'bitmap:genomebrowser.png',
      initialPane: null,
      title: 'Find gene'
    };
  },

  getInitialState() {
    return {
      pane: this.props.initialPane,
      search: '',
      startPosition: 0,
      endPosition: 100000
    };
  },

  icon() {
    return this.props.icon;
  },

  title() {
    return this.props.title;
  },

  handleSwitchPane(pane) {
    this.setState({pane: pane});
  },

  handleSearchChange(event) {
    this.setState({'search': event.target.value});
  },

  handleChromChange(event) {
    this.setState({'chromosome': event.target.value});
  },

  handleStartPosChange(event) {
    this.setState({'startPosition': parseInt(event.target.value)});
  },

  handleEndPosChange(event) {
    this.setState({'endPosition': parseInt(event.target.value)});
  },

  handleSwitchModal(container, props) {
    this.getFlux().actions.session.modalClose();
    this.getFlux().actions.session.modalOpen(container, props);
  },

  handleSelectGene(geneId) {
    // Add selected geneId to list of recently found genes.
    this.getFlux().actions.session.geneFound(geneId);

    // Close the modal.
    this.getFlux().actions.session.modalClose();

    // Open the gene info popup.
    this.getFlux().actions.session.popupOpen('containers/Gene', {geneId: geneId});
  },

  render() {

    let {pane, search, chromosome, startPosition, endPosition} = this.state;

    let geneFinderContent = null;

    if (pane === null) {

      // Retrieve the list of recently found genes from the session.
      let {foundGenes} = this.getFlux().store('SessionStore').getState().toObject();

      let foundGenesList = null;

      if (foundGenes.size > 0) {

        let foundGenesListItems = [];

        foundGenes.map( (foundGene) => {

          let foundGenesListItem = (
            <ListItem key={foundGene}
                      primaryText={foundGene}
                      leftIcon={<div><Icon fixedWidth={true} name="bitmap:genomebrowser.png" /></div>}
                      onClick={() => this.handleSelectGene(foundGene)}
            />
          );

          foundGenesListItems.push(foundGenesListItem);

        });

        foundGenesList = (
          <List>
            <Subheader>Recently found genes:</Subheader>
            {foundGenesListItems}
          </List>
        );
      }

      // FIXME: The foundGenesList could get too long and cause problems (being modal)
      // Maybe wrap it in a scrollable.

      geneFinderContent = (
        <div>
          <List>
            <Subheader>Search by:</Subheader>
            <ListItem primaryText="Gene name / description"
                      leftIcon={<div><Icon fixedWidth={true} name="bitmap:genomebrowser.png" /></div>}
                      onClick={() => this.handleSwitchPane('search by name or description')}
            />
            <ListItem primaryText="Genomic region"
                      leftIcon={<div><Icon fixedWidth={true} name="bitmap:genomebrowser.png" /></div>}
                      onClick={() => this.handleSwitchPane('search by genomic region')}
            />
          </List>
          {foundGenesList}
          <div className="centering-container">
            <FlatButton label={<span>Cancel</span>}
                          primary={true}
                          onClick={() => this.getFlux().actions.session.modalClose()}
            />
          </div>
        </div>
      );

    } else if (pane === 'search by name or description') {
      // FIXME: this does not look like a good way to identify panes. Maybe use different components?

      let geneList = null;

      if (search.length <= 2) {

        geneList = (
          <p>Enter more than 2 characters.</p>
        );

      } else {

        geneList = (
          <GeneSearchResultsList
             search={search}
             onSelectGene={this.handleSelectGene}
             icon={this.icon()}
            />
        );

      }

      geneFinderContent = (
        <div className="stack vertical" style={{padding: '10px'}}>
          <div>
            <p>Search gene names and descriptions.</p>
          </div>
          <div className="search">
            <TextField fullWidth={true}
                       floatingLabelText="Search"
                       value={search}
                       onChange={this.handleSearchChange}
            />
          </div>
          <div>
            {geneList}
          </div>
          <div className="centering-container">
            <div style={{paddingRight: '10px'}}>
              <FlatButton label={<span>Cancel</span>}
                            primary={true}
                            onClick={() => this.getFlux().actions.session.modalClose()}
              />
            </div>
            <div>
              <RaisedButton label={<span>Previous</span>}
                            primary={true}
                            onClick={() => this.handleSwitchPane(null)}
              />
            </div>
          </div>
        </div>
      );


    } else if (pane === 'search by genomic region') {
      // FIXME: this does not look like a good way to identify panes. Maybe use different components?

      let geneList = null;

console.log('chromosome: ', chromosome);
console.log('startPosition: ', startPosition);
console.log('endPosition: ', endPosition);

      if (!chromosome || !startPosition || !endPosition) {

        geneList = (
          <p>Select the chromosome and enter the start and end positions.</p>
        );

      } else {

        geneList = (
          <RegionGenesList
            chromosome={chromosome}
            startPosition={startPosition}
            endPosition={endPosition}
            onSelectGene={this.handleSelectGene}
            icon={this.icon()}
          />
        );

      }

      let maxPosition = DEFAULT_MAX_POSITION;
      if (chromosome) {
        maxPosition = this.config.chromosomes[chromosome].len;
      }

      // TODO: Lay out inputs horizontally and allow collapse; give sensible widths.

      geneFinderContent = (
        <div className="stack vertical" style={{padding: '10px'}}>
          <div>
            <p>Search a genomic region.</p>
          </div>
          <div>
            <span>Chromosome</span>
            <span>: </span>
            <span>
              <select value={chromosome} onChange={this.handleChromChange}>
                {_map(this.config.chromosomes, (length, name) =>
                    <option key={name}
                            value={name}>
                      {name}
                    </option>
                )}
              </select>
            </span>
          </div>
          <div>
            <span>Start</span>
            <span>: </span>
            <span>
              <input value={parseInt(startPosition)}
                     onChange={this.handleStartPosChange}
                     min={0}
                     max={maxPosition}
                     type="number"
              />
            </span>
            <span> bp</span>
          </div>
          <div>
            <span>End</span>
            <span>: </span>
            <span>
              <input value={parseInt(endPosition)}
                     onChange={this.handleEndPosChange}
                     min={startPosition}
                     max={maxPosition}
                     type="number"
              />
            </span>
            <span> bp</span>
          </div>
          <div>
            {geneList}
          </div>
          <div className="centering-container">
            <div style={{paddingRight: '10px'}}>
              <FlatButton label={<span>Cancel</span>}
                            primary={true}
                            onClick={() => this.getFlux().actions.session.modalClose()}
              />
            </div>
            <div>
              <RaisedButton label={<span>Previous</span>}
                            primary={true}
                            onClick={() => this.handleSwitchPane(null)}
              />
            </div>
          </div>
        </div>
      );

    } else {
      console.error('Unhandled pane: ' + pane);

      // FIXME: Maybe raise exception? Or fallback to the initial / null pane.

      geneFinderContent = (
        <div>
          <p>Error: Unhandled pane</p>
        </div>
      );
    }

    return geneFinderContent;
  }
});

module.exports = GeneFinder;
