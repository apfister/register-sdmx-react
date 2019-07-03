import React, { Component } from 'react';

class CalciteGridContainer extends Component {
  render() {
    const className = this.props.className ? `grid-container ${this.props.className}` : 'grid-container';
    return <div className={className}>{this.props.children}</div>;
  }
}

export default CalciteGridContainer;
