// React
import React, { Component } from 'react';

// Redux
import { connect } from 'react-redux';

// esri/arcgis-rest-items
import { UserSession } from '@esri/arcgis-rest-auth';
import { createItem } from '@esri/arcgis-rest-items';
import { request as agoRequest } from '@esri/arcgis-rest-request';

// Components
import Panel, { PanelTitle } from 'calcite-react/Panel';
import ArcgisItemCard from 'calcite-react/ArcgisItemCard';
import TextField from 'calcite-react/TextField';
import Button from 'calcite-react/Button';
import Tooltip from 'calcite-react/Tooltip';
import { CalciteA } from 'calcite-react/Elements';
import Label from 'calcite-react/Label';
import Loader from 'calcite-react/Loader';
import InformationIcon from 'calcite-ui-icons-react/InformationIcon';

import ComboBox from '@zippytech/react-toolkit/ComboBox';
import '@zippytech/react-toolkit/ComboBox/index.css';

import styled from 'styled-components';
import { fetch } from 'whatwg-fetch';

const Separator = styled.hr`
  width: 75%;
`;

// Class
class SDMXItemBuilder extends Component {
  constructor(props) {
    super(props);

    const defaultKoopProviderUrl = 'https://sdmx-koop-provider.azurewebsites.net/sdmx/unicef';
    const defaultSdmxDataFlowUrl = 'https://api.data.unicef.org/sdmx/Rest/dataflow/UNICEF/CME_DF/1.0/?references=all';
    this.state = {
      koopProviderUrl: defaultKoopProviderUrl,
      sdmxDataflowUrl: defaultSdmxDataFlowUrl,
      itemSuccess: true,
      newItem: null,
      isLoading: false,
      isQuerying: false,
      isLoadingOptions: false,
      outputUrl: '',
      keysWithPossibleValues: [],
      outputUrlIndicators: [],
      outputUrlComponents: {
        baseUrl: '',
        keyParts: [],
        suffix: 'FeatureServer/0'
      },
      numRecords: '',
      itemInfo: {
        title: 'default',
        description: 'Data provider: ',
        type: 'Feature Service',
        typeKeywords: 'Data, Service, Feature Service, ArcGIS Server, Feature Access, SDMX',
        tags: 'SDMX',
        url: '',
        data: {},
        thumbnail: ''
      }
    };
  }

  componentDidUpdate(prevProps, prevState) {
    if (
      prevState.selectedValue !== this.state.selectedValue &&
      prevState.selectedCategory !== this.state.selectedCategory
    ) {
      // do previous click handler stuff
      console.log('go!');
    }
  }

  updateKoopProviderValue = e => {
    this.setState({ koopProviderUrl: e.target.value });
  };

  updateSdmxValue = e => {
    this.setState({ sdmxDataflowUrl: e.target.value });
  };

  getItemCard() {
    return <ArcgisItemCard item={this.state.newItem} />;
  }

  onItemCardClick = () => {
    const item = this.state.newItem;
    const portal = this.props.auth.user.portal;
    const portalUrlKey = portal.url.replace('www', `${portal.urlKey}.maps`);
    const url = `${portalUrlKey}/home/item.html?id=${item.id}`;

    window.open(url, '_blank');
  };

  showOptions = () => {
    this.setState({ isLoadingOptions: true, isSuccess: false, numRecords: '' });

    const requestUrl = this.state.koopProviderUrl;

    fetch(requestUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.sdmx.structure+json;version=1.0'
      }
    })
      .then(response => {
        return response.json();
      })
      .then(json => {
        this.setState({ isLoadingOptions: false });

        const keysWithPossibleValues = json.data.keysWithPossibleValues;
        let outputUrlKeys = keysWithPossibleValues.map(key => key.possibleValues[0].id);

        this.setState({
          keysWithPossibleValues: keysWithPossibleValues,
          outputUrl: `${this.state.koopProviderUrl}/${outputUrlKeys.join('.')}/FeatureServer/0`,
          outputUrlIndicators: keysWithPossibleValues.map(key => key.id),
          outputUrlKeys: outputUrlKeys
        });

        const urlPieces = new URL(this.state.outputUrl);
        const pathnames = urlPieces.pathname.split('/');
        const agency = pathnames[2];
        const sdmxQueryStrings = pathnames[3].split('.');
        const possibleKeys = json.data.keysWithPossibleValues;

        let itemInfo = {
          title: 'default',
          description: `Data provider: ${agency}`,
          type: 'Feature Service',
          typeKeywords: 'Data, Service, Feature Service, ArcGIS Server, Feature Access',
          tags: 'test',
          url: this.state.outputUrl,
          data: {}
        };

        sdmxQueryStrings.forEach((part, i) => {
          if (part !== '') {
            const foundLookup = possibleKeys[i];
            if (foundLookup.id === json.data.indicatorKey) {
              // eslint-disable-next-line prettier/prettier
              const foundInd = foundLookup.possibleValues.filter(pv => pv.id === part)[0];
              itemInfo.title = foundInd.description;
            }
          }
        });

        this.setState({ itemInfo: itemInfo });
      })
      .catch(error => {
        console.log(error);
        this.setState({ isLoadingOptions: false });
      });
  };

  zChange = (value, cId) => {
    // console.log(`onChange from ${cid}--> ${value}`);

    let currentKeys = this.state.outputUrlKeys;
    let indexToChange = this.state.outputUrlIndicators.indexOf(cId);

    if (value === null) {
      currentKeys[indexToChange] = '';
    } else {
      // this is a hack to get the combobox to always show the Label and not the id
      const kpvs = this.state.keysWithPossibleValues.filter(key => key.id === cId)[0];
      let newValues = [];
      value.forEach(inVal => {
        for (let i = 0; i < kpvs.possibleValues.length; i++) {
          const pv = kpvs.possibleValues[i];
          if (pv.name === inVal) {
            newValues.push(pv.id);
          }
          if (newValues.length === value.length) {
            break;
          }
        }
      });

      const newItems = newValues.join('+');
      currentKeys[indexToChange] = newItems;
    }

    const fsUrl = `${this.state.koopProviderUrl}/${currentKeys.join('.')}/FeatureServer/0`;
    this.setState({
      outputUrl: fsUrl,
      outputUrlKeys: currentKeys
    });

    let itemInfo = this.state.itemInfo;
    itemInfo.url = fsUrl;
    this.setState({ itemInfo: itemInfo });
  };

  getFeatureCount = () => {
    this.setState({ isQuerying: true });

    const queryUrl = `${this.state.outputUrl}/query?where1=1&returnCountOnly=true`;
    agoRequest(queryUrl).then(
      response => {
        this.setState({ isQuerying: false, numRecords: `${response.count} records found` });
      },
      error => {
        this.setState({ isQuerying: false, numRecords: 'unable to get feature count' });
      }
    );
  };

  registerUrl = e => {
    this.setState({ isSuccess: false, isLoading: true });

    const itemInfo = this.state.itemInfo;

    const credential = this.props.auth.user.portal.credential;
    const authentication = UserSession.fromCredential(credential);

    createItem({
      item: itemInfo,
      authentication
    }).then(
      response => {
        agoRequest(`https://www.arcgis.com/sharing/rest/content/items/${response.id}`, {
          f: 'json',
          httpMethod: 'GET',
          authentication
        }).then(response => {
          this.setState({ isSuccess: true, isLoading: false, newItem: response });
        });
      },
      error => {
        this.setState({ isSuccess: false, isLoading: false });
      }
    );
  };

  render() {
    return (
      <div>
        <div className="leader-1 trailer-1 padding-left-3 padding-right-3 text-left">
          <Panel>
            <PanelTitle>
              Enter your Koop-SDMX Provider URL
              <Tooltip title="Click Me for more information">
                <CalciteA href="http://www.esri.com" target="_blank">
                  <InformationIcon size={18} color="blue" />
                </CalciteA>
              </Tooltip>
            </PanelTitle>
            <div className="grid-container">
              <TextField
                className="column-16"
                defaultValue="https://sdmx-koop-provider.azurewebsites.net/sdmx/unicef/"
                onChange={this.updateKoopProviderValue}
              />
              <Button className="column-4 margin-left-1" onClick={this.showOptions}>
                Show Options
              </Button>
            </div>
          </Panel>
          <Separator className="column-18 center-column" />

          {this.state.isLoadingOptions ? (
            <Loader />
          ) : (
            <Panel>
              <div className="grid-container">
                <div className="column-18">
                  {this.state.keysWithPossibleValues.map((item, index) => {
                    const sectionIndex = `section_${index}`;
                    const options = item.possibleValues.map((subItem, subIndex) => {
                      return {
                        id: subItem.name,
                        label: subItem.name
                      };
                    });

                    return (
                      <div className="trailer-1" key={sectionIndex}>
                        <span>{item.id}</span>
                        <ComboBox
                          style={{ width: 500 }}
                          multiple
                          defaultValue={[options[0].id]}
                          dataSource={options}
                          // for some reason, including an onChange event will cause a bug where the id of an item will be shown rather than the label
                          // hack fix is in the onChange event
                          onChange={value => this.zChange(value, item.id)}
                          // onChange={this.zChange}
                          // onItemClick={this.zItemClick}
                          // onTagClick={this.zTagClick}
                          // onActiveItemChange={this.zActiveItemChange}
                          // onActiveTagChange={this.zActiveTagChange}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </Panel>
          )}
          <div className="grid-container">
            <Separator className="column-18 center-column" />
            <TextField className="column-18 center-column" value={this.state.outputUrl} />
            <div className="column-18 center-column leader-1">
              <Button small clear onClick={this.getFeatureCount} className="column-8">
                Show Number of Records
              </Button>
              <div className="column-10">
                {this.state.isQuerying ? (
                  <Loader sizeRatio={0.7} />
                ) : this.state.numRecords !== '' ? (
                  <Label blue className="margin-left-2">
                    {this.state.numRecords}
                  </Label>
                ) : (
                  <br />
                )}
              </div>
            </div>
            <div className="column-18 center-column leader-1">
              <Button className="column-18 center-column" onClick={this.registerUrl}>
                Register Item in ArcGIS Online
              </Button>
            </div>
            <div className="column-18 center-column leader-1">
              {this.state.isLoading ? <Loader text="Loading ..." /> : null}
              {this.state.isSuccess ? (
                <ArcgisItemCard className="success-panel" item={this.state.newItem} onClick={this.onItemCardClick} />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // zActiveChange = activeItem => {
  //   const foundItem = this.dataSource.filter(i => i.id === activeItem)[0];
  //   console.log(`onActiveItemChange --> ${activeItem}`, foundItem);
  // };

  zItemClick = item => {
    // const foundItem = this.dataSource.filter(i => i.id === item.item.value)[0];
    console.log(`onItemClick --> ${item}`);
  };

  zTagClick = item => {
    // const foundItem = this.dataSource.filter(i => i.id === item.item.value)[0];
    console.log(`onTagClick --> ${item}`);
  };

  zActiveItemChange = item => {
    // const foundItem = this.dataSource.filter(i => i.id === item.item.value)[0];
    console.log(`onActiveItemChange --> ${item}`);
  };

  zActiveTagChange = item => {
    // const foundItem = this.dataSource.filter(i => i.id === item.item.value)[0];
    console.log(`onActiveTagChange --> ${item}`);
  };
}

const mapStateToProps = state => ({
  auth: state.auth,
  config: state.config,
  isSuccess: state.isSuccess
});

export default connect(mapStateToProps)(SDMXItemBuilder);
