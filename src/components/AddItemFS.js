// React
import React, { Component } from 'react';

// Redux
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { actions as mapActions } from '../redux/reducers/map';
import { actions as authActions } from '../redux/reducers/auth';

import SDMXItemPublisherForm from './SDMXItemPublisherForm';

// Class
class AddItemFS extends Component {
  render() {
    return <SDMXItemPublisherForm />;
  }
}

const mapStateToProps = state => ({
  map: state.map,
  auth: state.auth,
  config: state.config
});

const mapDispatchToProps = function(dispatch) {
  return bindActionCreators(
    {
      ...mapActions,
      ...authActions
    },
    dispatch
  );
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(AddItemFS);
