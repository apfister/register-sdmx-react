import React, { Component } from 'react';

class CalciteGridColumn extends Component {
  render() {
    const className = this.props.className
      ? `column-${this.props.column} ${this.props.className}`
      : `column-${this.props.column}`;
    return <div className={className}>{this.props.children}</div>;
  }
}

export default CalciteGridColumn;
