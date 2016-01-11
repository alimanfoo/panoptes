const React = require('react');
const PureRenderMixin = require('mixins/PureRenderMixin');

import "loading.scss";

let Loading = React.createClass({
  mixins: [PureRenderMixin],

  propTypes: {
    status: React.PropTypes.string.isRequired,
  },

  render() {
    let {status, customContent, ...other} = this.props;
    if (status == 'loading')
      return (
        <div className="loading-container show">
          <div className="spinner" />
        </div>
      );

    if (status == 'error')
      return (
        <div className="loading-container show">
          <div className="error" />
        </div>
      );

    if (status == 'custom')
      return (
        <div className="loading-container show">
          <div className="custom">{this.props.children}</div>
        </div>
      );

    return (
      <div className="loading-container">
        <div className="spinner" />
      </div>
    );

  }

});

module.exports = Loading;