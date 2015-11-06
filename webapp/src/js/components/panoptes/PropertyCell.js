const React = require('react');
const PureRenderMixin = require('mixins/PureRenderMixin');

const Formatter = require('panoptes/Formatter');
const Icon = require('ui/Icon');
const FluxMixin = require('mixins/FluxMixin');


let PropertyCell = React.createClass({
  mixins: [
    PureRenderMixin,
    FluxMixin
  ],

  propTypes: {
    prop: React.PropTypes.object
    //value: ANY
  },

  handleClick() {
    let actions = this.getFlux().actions.session;
    let {prop, value} = this.props;
    actions.popupOpen('containers/DataItem', {table:prop.tableid, primKey: value.toString()});
  },

  render() {
    let { prop, value, ...other } = this.props;
    let text = Formatter(prop, value);
    if (prop.externalUrl) {
      let refs = value.split(';');
      return (<span className="prop">
        {_.map(refs, (ref, index) => (
          <span key={index}>
          <a href={prop.externalUrl.replace("{value}", ref)}>
            {ref}
          </a>
            {index < refs.length - 1 ? "," : null}
        </span>
        ))}
      </span>);
    } else if (prop.dispDataType == "Boolean" && value !== '') {
      let val = (value == '1');
      return <Icon className={(val ? "prop bool true" : "prop bool false")}
                   fixedWidth={true}
                   name={val ? "check" : "times"}/>
    } else if (prop.isPrimKey) {
      return <span className="prop internal-link"
            onClick={this.handleClick}>
      {text}
    </span>
    }
    return <span className="prop">
      {text}
    </span>;
  }

});

module.exports = PropertyCell;
