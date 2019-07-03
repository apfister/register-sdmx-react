// React
import React, { Component } from 'react';

// Redux
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { actions as mapActions } from '../redux/reducers/map';
import { actions as authActions } from '../redux/reducers/auth';

// Import React Table
import ReactTable from 'react-table';
import 'react-table/react-table.css';

import CalciteGridContainer from './CalciteGridContainer';
import CalciteGridColumn from './CalciteGridColumn';

import { queryForSDMXItems } from '../services/sdmxRequest';

// Class
class MyContent extends Component {
  constructor(props) {
    super(props);

    this.state = {
      tableData: [],
      tableColumns: [
        { Header: 'Name', accessor: 'title' },
        {
          Header: 'Created',
          accessor: 'created',
          Cell: props => {
            return new Date(props.value).toLocaleString();
          }
        },
        { Header: 'Type', accessor: 'type' },
        {
          Header: 'Link',
          accessor: 'portalLink',
          Cell: props => (
            <a href={props.value} target="_blank" rel="noopener noreferrer">
              View in ArcGIS
            </a>
          )
        }
      ]
    };

    const userName = this.props.auth.user.username;
    const orgId = this.props.auth.user.portal.id;
    const token = this.props.auth.user.portal.credential.token;

    const portal = this.props.auth.user.portal;
    const portalUrlKey = portal.url.replace('www', `${portal.urlKey}.maps`);

    queryForSDMXItems(userName, orgId, token).then(response => {
      const results = response.results;
      results.forEach(item => {
        item.portalLink = `${portalUrlKey}/home/item.html?id=${item.id}`;
      });
      this.setState({ tableData: results });
    });
  }

  render() {
    return (
      <CalciteGridContainer className="leader-1">
        <CalciteGridColumn column="24">
          <ReactTable
            data={this.state.tableData}
            columns={this.state.tableColumns}
            defaultSorted={[
              {
                id: 'created',
                desc: true
              }
            ]}
          />
        </CalciteGridColumn>
      </CalciteGridContainer>
    );
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
)(MyContent);
