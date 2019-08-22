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

/**
 * This is an example component used to showcase authentication
 * @type {Class}
 */

// React
import React, { Component } from 'react';

// Components
import TopNavActionsList from 'calcite-react/TopNav/TopNavActionsList';
import ArcgisAccount from 'calcite-react/ArcgisAccount';
import ArcgisAccountMenuItem from 'calcite-react/ArcgisAccount/ArcgisAccountMenuItem';
import Button from 'calcite-react/Button';

// Class
class UserAccount extends Component {
  menuItemClick = item => {
    const portal = this.props.portal;
    const portalUrlKey = portal.url.replace('www', `${portal.urlKey}.maps`);
    let url = `${portalUrlKey}`;

    if (item === 'profile') {
      url = `${url}/home/user.html`;
    }

    window.open(url, '_blank');
  };

  render() {
    const signedInActionsComponent = this.props.user ? (
      <TopNavActionsList style={{ padding: 0 }}>
        <ArcgisAccount
          hideSwitchAccount={true}
          user={this.props.user}
          portal={this.props.portal}
          onRequestSwitchAccount={() => console.log('switch account clicked')}
          onRequestSignOut={this.props.signOut}>
          <ArcgisAccountMenuItem onClick={() => this.menuItemClick('profile')}>
            Profile &amp; Settings
          </ArcgisAccountMenuItem>
          {/* <ArcgisAccountMenuItem onClick={() => console.log('My Esri clicked')}>My Esri</ArcgisAccountMenuItem> */}
          {/* <ArcgisAccountMenuItem onClick={() => console.log('Training clicked')}>Training</ArcgisAccountMenuItem> */}
          {/* <ArcgisAccountMenuItem onClick={() => console.log('Community & Forums clicked')}>
            Community &amp; Forums
          </ArcgisAccountMenuItem> */}
          <ArcgisAccountMenuItem onClick={() => this.menuItemClick('ago')}>ArcGIS Online</ArcgisAccountMenuItem>
        </ArcgisAccount>
      </TopNavActionsList>
    ) : null;

    const signedOutActionsComponent = (
      <TopNavActionsList>
        <Button clear onClick={this.props.signIn}>
          Sign In
        </Button>
      </TopNavActionsList>
    );

    let outputComponent = this.props.loggedIn ? signedInActionsComponent : signedOutActionsComponent;

    return <div>{outputComponent}</div>;
  }
}

export default UserAccount;
