// React
import React, { Component } from 'react';

// Redux
import { connect } from 'react-redux';

// esri/arcgis-rest-items
import { UserSession } from '@esri/arcgis-rest-auth';
import { createItem } from '@esri/arcgis-rest-items';
import { request as agoRequest } from '@esri/arcgis-rest-request';
import { Formik, Field } from 'formik';

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
import Tabs, { TabNav, TabTitle, TabContents, TabSection } from 'calcite-react/Tabs';
import Form, { FormControl, FormControlLabel, FormHelperText, Fieldset, Legend } from 'calcite-react/Form';
import FileUploader from 'calcite-react/FileUploader';
import List, { ListItem, ListHeader, ListItemTitle, ListItemSubtitle } from 'calcite-react/List';
import Alert from 'calcite-react/Alert';
import Radio from 'calcite-react/Radio';

import ComboBox from '@zippytech/react-toolkit/ComboBox';
import '@zippytech/react-toolkit/ComboBox/index.css';

import styled from 'styled-components';
import { fetch } from 'whatwg-fetch';
import { parse } from 'path';

import {
  getSDMXDataFlowsFromFile,
  parseSDMXDataFile,
  uploadString,
  getGeoJsonUrl,
  parseGeoJsonGeoFile
} from '../services/sdmxRequest';
import { debug } from 'util';

const Separator = styled.hr`
  width: 75%;
`;

const RadioControlContainer = styled.div`
  max-height: 300px;
  overflow: scroll;
  border: 1px solid #cccccc;
`;

// Class
class SDMXItemBuilderFS extends Component {
  constructor(props) {
    super(props);

    this.formikSDMX = React.createRef();

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
      },

      sdmxDFDoc: null,
      sdmxDataFlows: [],
      selectedDataFlow: '',

      activeTabIndex: 0,
      activeGeoTabIndex: 0,
      fc: {
        features: []
      },
      geoJsonGeographies: {
        features: []
      },
      publishLog: []
    };

    this.onTabChange = this.onTabChange.bind(this);
    this.onGeoTabChange = this.onGeoTabChange.bind(this);
  }

  onTabChange(index) {
    this.setState({ activeTabIndex: index });
  }

  onGeoTabChange(index) {
    this.setState({ activeGeoTabIndex: index });
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

  onSubmit = (values, actions) => {
    setTimeout(() => {
      const file = values.dfjsonfile[0];
      getSDMXDataFlowsFromFile(file)
        .then(response => {
          // debugger;

          this.setState({ sdmxDataFlows: response });
          this.setState({ sdmxDataFlowsDefaultValue: [response[0].id] });
        })
        .catch(error => {
          console.log(error);
        })
        .finally(() => {
          actions.setSubmitting(false);
        });
    }, 1000);
  };

  onValidateSDMXDataFlow = values => {
    const errors = {};
    const file = values.dfjsonfile[0];
    const reader = new FileReader();

    reader.onload = event => {
      const dfjson = JSON.parse(event.target.result);
      if (!dfjson || !dfjson.data || dfjson.data.dataflows.length === 0) {
        errors.dfjson = 'unable to find data flows in json file';
      }
    };
    reader.onerror = e => {
      errors.dfjsonfile = 'unable to parse json file';
    };

    reader.readAsText(file);

    return errors;
  };

  onDataFileSubmit = (values, actions) => {
    setTimeout(() => {
      const file = values.dfjsonfile[0];
      this.setState({ rawFile: file });

      parseSDMXDataFile(file)
        .then(response => {
          // debugger;
          console.log(response);
          this.setState({ fc: response });
        })
        .catch(error => {
          console.log(error);
        })
        .finally(() => {
          actions.setSubmitting(false);
        });
    }, 1000);
  };

  isPublishDisabled = () => {
    return this.state.fc.features.length === 0 ? true : false;
  };

  publishLayer = () => {
    this.setState({ publishLog: [{ message: 'Uploading GeoJson to temp storage in Azure ...' }] });

    uploadString('test', 'testfc.geojson', JSON.stringify(this.state.fc)).then(
      response => {
        const blobUrl = getGeoJsonUrl('test', 'testfc.geojson');
        this.createGeoJsonItem(blobUrl);
      },
      error => {
        console.log(error);
        this.setState({ publishLog: [...this.state.publishLog, { isError: true, message: error.message }] });
      }
    );
  };

  checkAddItemStatus = itemId => {
    const user = this.props.auth.user.username;
    const portalUrl = this.props.auth.user.portal.restUrl;
    const token = this.props.auth.user.portal.credential.token;
    const url = `${portalUrl}/content/users/${user}/items/${itemId}/status`;

    agoRequest(url, {
      httpMethod: 'GET',
      params: {
        f: 'json',
        token: token
      }
    })
      .then(response => {
        if (response.status === 'completed') {
          clearInterval(this.state.timer);
          this.setState({ timer: null });
          this.publishItemAsLayer(response.itemId);
        }
      })
      .catch(error => {
        console.log(error);
        this.setState({ publishLog: [...this.state.publishLog, { isError: true, message: error.message }] });
      });
  };

  checkPublishItemStatus = itemId => {
    const user = this.props.auth.user.username;
    const portalUrl = this.props.auth.user.portal.restUrl;
    const token = this.props.auth.user.portal.credential.token;
    const url = `${portalUrl}/content/users/${user}/items/${itemId}/status`;

    agoRequest(url, {
      httpMethod: 'GET',
      params: {
        f: 'json',
        token: token
      }
    })
      .then(response => {
        if (response.status === 'completed') {
          clearInterval(this.state.timer);
          this.setState({ timer: null });

          // all done!
          this.setState({ publishLog: [...this.state.publishLog, { message: 'Publishing Completed' }] });
        }
      })
      .catch(error => {
        console.log(error);
        this.setState({ publishLog: [...this.state.publishLog, { isError: true, message: error.message }] });
      });
  };

  createGeoJsonItem = url => {
    this.setState({ publishLog: [...this.state.publishLog, { message: 'Creating GeoJson Item ... ' }] });

    const item = {
      title: 'test from app',
      type: 'GeoJson'
    };

    const params = {
      dataUrl: url,
      overwrite: true,
      async: true
    };

    const authentication = UserSession.fromCredential(this.props.auth.user.portal.credential);

    createItem({
      item,
      params,
      authentication
    }).then(
      response => {
        console.log(response);
        if (response.success) {
          const itemId = response.id;
          const timer = setInterval(() => this.checkAddItemStatus(itemId), 1000);
          this.setState({ timer: timer });
        }
      },
      error => {
        this.setState({ isSuccess: false, isLoading: false });
        this.setState({ publishLog: [...this.state.publishLog, { isError: true, message: error.message }] });
      }
    );
  };

  publishItemAsLayer = itemId => {
    this.setState({
      publishLog: [...this.state.publishLog, { message: 'Publishing GeoJson as a Hosted Feature Service ...' }]
    });

    // const itemId = response.id;
    const user = this.props.auth.user.username;
    const portalUrl = this.props.auth.user.portal.restUrl;
    const token = this.props.auth.user.portal.credential.token;
    const url = `${portalUrl}/content/users/${user}/publish`;

    agoRequest(url, {
      httpMethod: 'POST',
      params: {
        itemId: itemId,
        f: 'json',
        token: token,
        filetype: 'geojson',
        overwrite: true,
        publishParameters: {
          hasStaticData: true,
          name: 'goejson to glory',
          maxRecordCount: 10000,
          layerInfo: {
            capabilities: 'Query'
          }
        }
      }
    })
      .then(response => {
        const itemId = response.id;
        const timer = setInterval(() => this.checkPublishItemStatus(itemId), 1000);
        this.setState({ timer: timer });
      })
      .catch(error => {
        console.log(error);
        this.setState({ publishLog: [...this.state.publishLog, { isError: true, message: error.message }] });
      });
  };

  onGeoJsonFileSubmit = (values, actions) => {
    setTimeout(() => {
      const file = values.geojsongeofile[0];
      parseGeoJsonGeoFile(file)
        .then(response => {
          // debugger;
          console.log(response);
          this.setState({ geoJsonGeographies: response });
        })
        .catch(error => {
          console.log(error);
        })
        .finally(() => {
          actions.setSubmitting(false);
        });
    }, 1000);
  };

  getGeoJsonFields = () => {
    const fields = Object.keys(this.geoJsonGeographies.features[0].properties).map((field, index) => {
      return (
        <Field key={index} component={Radio} name="geojsonfieldradio" value={field}>
          {field}
        </Field>
      );
    });
    return fields;
  };

  getSDMXFields = () => {};

  render() {
    return (
      <div className="grid-container leader-1">
        <Panel>
          <PanelTitle className="text-left">
            Step 1. Upload an SDMX JSON file or URL that returns an SDMX JSON file
          </PanelTitle>
          <Tabs onTabChange={this.onTabChange} activeTabIndex={this.state.activeTabIndex}>
            <TabNav>
              <TabTitle>JSON File Upload</TabTitle>
              <TabTitle>SDMX URL</TabTitle>
            </TabNav>
            <TabContents>
              <TabSection>
                <Formik
                  initialValues={this.state.sdmxDFDoc}
                  // validate={this.onValidateSDMXDataFlow}
                  onSubmit={this.onDataFileSubmit}>
                  {({ values, errors, touched, handleSubmit, isSubmitting }) => (
                    <Form onSubmit={handleSubmit}>
                      <FormControl
                        success={touched.dfjsonfile && !errors.dfjsonfile ? true : false}
                        error={touched.dfjsonfile && errors.dfjsonfile ? true : false}>
                        <FormControlLabel>Upload a JSON File</FormControlLabel>
                        <Field className="column-6" component={FileUploader} name="dfjsonfile" accept="text/json" />
                        <FormHelperText>{(touched.dfjsonfile && errors.dfjsonfile) || null}</FormHelperText>
                      </FormControl>
                      <FormControl>
                        <div className="grid-container">
                          <Button className="column-8" type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Reading file ...' : 'Parse SDMX Data File'}
                          </Button>
                          {this.state.fc.features.length === 0 ? null : (
                            <div className="margin-left-2 column-2">
                              <Label>{this.state.fc.features.length} features found</Label>
                            </div>
                          )}
                        </div>
                      </FormControl>
                    </Form>
                  )}
                </Formik>
              </TabSection>
              <TabSection>TODO >></TabSection>
            </TabContents>
          </Tabs>
        </Panel>

        <Formik initialValues={{ sdmxField: null }}>
          <Panel className="leader-1">
            <PanelTitle className="text-left">Step 2. Add Geography (optional)</PanelTitle>
            <Tabs onTabChange={this.onGeoTabChange} activeTabIndex={this.state.activeGeoTabIndex}>
              <TabNav>
                <TabTitle>From GeoJSON File</TabTitle>
                <TabTitle>From a Feature Service URL</TabTitle>
                <TabTitle>From a Shapefile</TabTitle>
              </TabNav>
              <TabContents>
                <TabSection>
                  <Formik initialValues={this.state.sdmxDFDoc} onSubmit={this.onGeoJsonFileSubmit}>
                    {({ values, errors, touched, handleSubmit, isSubmitting }) => (
                      <Form onSubmit={handleSubmit}>
                        <FormControl
                          success={touched.geojsongeofile && !errors.geojsongeofile ? true : false}
                          error={touched.geojsongeofile && errors.geojsongeofile ? true : false}>
                          <FormControlLabel>Upload a GeoJSON File</FormControlLabel>
                          <Field
                            className="column-6"
                            component={FileUploader}
                            name="geojsongeofile"
                            accept="text/json"
                          />
                          <FormHelperText>{(touched.geojsongeofile && errors.geojsongeofile) || null}</FormHelperText>
                        </FormControl>
                        <FormControl>
                          <div className="grid-container">
                            <Button className="column-8" type="submit" disabled={isSubmitting}>
                              {isSubmitting ? 'Reading file ...' : 'Upload a GeoJson File'}
                            </Button>
                            {this.state.geoJsonGeographies.features.length === 0 ? null : (
                              <div className="margin-left-2 column-2">
                                <Label>{this.state.geoJsonGeographies.features.length} features found</Label>
                              </div>
                            )}
                          </div>
                        </FormControl>
                      </Form>
                    )}
                  </Formik>
                  {this.state.geoJsonGeographies.features.length > 0 && this.state.fc.features.length > 0 ? (
                    <div className="grid-container join-field">
                      <div className="column-8 text-left">
                        <Formik initialValues={{ geoJsonField: null }}>
                          {({ values, errors, touched, handleSubmit, isSubmitting }) => (
                            <Form>
                              <FormControlLabel htmlFor="geoJsonField">geoJsonField Type:</FormControlLabel>
                              <RadioControlContainer>
                                <FormControl
                                  success={touched.geoJsonField && !errors.geoJsonField ? true : false}
                                  error={touched.geoJsonField && errors.geoJsonField ? true : false}>
                                  {Object.keys(this.state.geoJsonGeographies.features[0].properties).map(
                                    (field, index) => (
                                      <Field key={index} component={Radio} name="geoJsonField" value={field}>
                                        {field}
                                      </Field>
                                    )
                                  )}
                                  <FormHelperText>
                                    {(touched.geoJsonField && errors.geoJsonField) || null}
                                  </FormHelperText>
                                </FormControl>
                              </RadioControlContainer>
                              <pre>{JSON.stringify(values, null, 2)}</pre>
                            </Form>
                          )}
                        </Formik>
                      </div>
                      <div className="column-8 text-left">
                        {({ values, errors, touched, handleSubmit, isSubmitting }) => (
                          <Form>
                            <FormControlLabel htmlFor="sdmxField">sdmxField Type:</FormControlLabel>
                            <RadioControlContainer>
                              <FormControl
                                success={touched.sdmxField && !errors.sdmxField ? true : false}
                                error={touched.sdmxField && errors.sdmxField ? true : false}>
                                {Object.keys(this.state.fc.features[0].properties).map((field, index) => (
                                  <Field key={index} component={Radio} name="sdmxField" value={field}>
                                    {field}
                                  </Field>
                                ))}
                                <FormHelperText>{(touched.sdmxField && errors.sdmxField) || null}</FormHelperText>
                              </FormControl>
                            </RadioControlContainer>
                            <pre>{JSON.stringify(values, null, 2)}</pre>
                          </Form>
                        )}
                      </div>
                    </div>
                  ) : null}
                </TabSection>
                <TabSection>TODO >></TabSection>
                <TabSection>TODO >></TabSection>
              </TabContents>
            </Tabs>
          </Panel>
        </Formik>
        <Panel className="leader-1 text-left">
          <PanelTitle className="text-left">Step 3. Publish as Hosted Feature Service</PanelTitle>
          <Button disabled={this.isPublishDisabled()} onClick={this.publishLayer}>
            Publish!
          </Button>
          <br />
          {this.state.publishLog.length > 0 ? (
            <List className="leader-1 column-14">
              {this.state.publishLog.map((item, index) => {
                const listItem = item.isError ? (
                  <ListItemTitle>
                    <Alert fullWidth red>
                      {item.message}
                    </Alert>
                  </ListItemTitle>
                ) : (
                  <ListItemTitle>{item.message}</ListItemTitle>
                );
                return <ListItem key={index}>{listItem}</ListItem>;
              })}
            </List>
          ) : null}
        </Panel>
      </div>
    );
  }
}

const mapStateToProps = state => ({
  auth: state.auth,
  config: state.config,
  isSuccess: state.isSuccess
});

export default connect(mapStateToProps)(SDMXItemBuilderFS);
