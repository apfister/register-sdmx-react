// Copyright 2019 Esri
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//     http://www.apache.org/licenses/LICENSE-2.0
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.​

// React
import React, { Component } from 'react';
import { Redirect, NavLink, Route } from 'react-router-dom';

// Redux
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { actions as mapActions } from '../redux/reducers/map';
import { actions as authActions } from '../redux/reducers/auth';

// Components
import TopNav, { TopNavBrand, TopNavTitle, TopNavList, TopNavLink, TopNavActionsList } from 'calcite-react/TopNav';

import LoadScreen from './LoadScreen';
import UserAccount from './UserAccount';

import logo from '../styles/images/sdmx-ago-logo.png';

// Styled Components
import styled from 'styled-components';

import MyContent from './MyContent';
import AddItem from './AddItem';
import AddItemFS from './AddItemFS';
import Home from './Home';
import { StyledTopNavLink } from 'calcite-react/TopNav/TopNav-styled';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  position: absolute;
  width: 100%;
  height: 100%;
  text-align: center;
`;

const BodyWrapper = styled.div`
  width: 100%;
  height: 100%;
  position: relative;
  z-index: 0;
`;

const Logo = styled(TopNavBrand)`
  justify-content: center;
  & img {
    height: 55px;
  }
`;

const Nav = styled(TopNav)`
  background-color: ${props => props.theme.palette.offWhite};
  z-index: 5;
`;

const NavList = styled(TopNavList)`
  text-align: left;
`;

const StyledTopNavActionLink = styled(StyledTopNavLink)`
  font-size: 14px;
`;

const StyledLink = styled(NavLink)``;

const HeaderNavLink = styled(StyledLink)`
  text-decoration: none !important;
  ${StyledLink}:hover & {
    text-decoration: none !important;
  }
`;

// Class
class Main extends Component {
  signIn = () => {
    this.props.checkAuth('https://www.arcgis.com');
  };

  signOut = () => {
    this.props.logout();
  };

  render() {
    const isLoggedIn = this.props.auth.loggedIn;

    return (
      <Container>
        <LoadScreen isLoading={this.props.mapLoaded} />
        <Nav>
          <Logo href="/" src={logo} />
          <TopNavTitle href="#">Register SDMX in ArcGIS</TopNavTitle>
          <NavList>
            <TopNavLink active={this.props.currentLocation === '/mycontent'}>
              <HeaderNavLink to="/mycontent">My SDMX Content</HeaderNavLink>
            </TopNavLink>
            <TopNavLink active={this.props.currentLocation === '/add-fs'}>
              <HeaderNavLink to="/add-fs">Add Item as Feature Service</HeaderNavLink>
            </TopNavLink>
            {/* <TopNavLink active={this.props.currentLocation === '/add-live'}>
              <HeaderNavLink to="/add-live">Add Item as Live API Link</HeaderNavLink>
            </TopNavLink> */}
          </NavList>
          <TopNavActionsList>
            <StyledTopNavActionLink href="https://www.github.com/apfister/register-sdmx-react" target="_blank">
              Project Home
            </StyledTopNavActionLink>
            <StyledTopNavActionLink href="https://www.github.com/apfister/register-sdmx-react/issues" target="_blank">
              Report an Issue
            </StyledTopNavActionLink>
          </TopNavActionsList>
          <UserAccount
            user={this.props.auth.user}
            portal={this.props.auth.user ? this.props.auth.user.portal : null}
            loggedIn={this.props.auth.loggedIn}
            signIn={this.signIn}
            signOut={this.signOut}
          />
        </Nav>

        <BodyWrapper>
          <Route exact path="/" render={() => <Redirect to="/mycontent" />} />

          <Route
            path="/mycontent"
            render={props =>
              isLoggedIn ? (
                <MyContent {...props} />
              ) : (
                <Redirect to={{ pathname: '/home', state: { from: props.location } }} />
              )
            }
          />

          <Route
            path="/add-fs"
            render={props =>
              isLoggedIn ? (
                <AddItemFS {...props} />
              ) : (
                <Redirect to={{ pathname: '/home', state: { from: props.location } }} />
              )
            }
          />

          <Route
            path="/add-live"
            render={props =>
              isLoggedIn ? (
                <AddItem {...props} />
              ) : (
                <Redirect to={{ pathname: '/home', state: { from: props.location } }} />
              )
            }
          />

          <Route
            path="/home"
            render={props =>
              isLoggedIn ? (
                <Redirect to={{ pathname: '/mycontent', state: { from: props.location } }} />
              ) : (
                <Home {...props} />
              )
            }
          />

          {/* <Route path="/home" component={Home} /> */}
          {/* <Route exact path="/" render={() => <Redirect to="/mycontent" />} />
          <Route path="/add-live" component={AddItem} />
          <Route path="/add-fs" component={AddItemFS} />
          <Route path="/mycontent" component={MyContent} /> */}
        </BodyWrapper>
      </Container>
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
)(Main);
