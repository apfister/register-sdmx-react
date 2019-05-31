// React
import React, { Component } from 'react';

// Redux
import { connect } from 'react-redux';

// esri/arcgis-rest-items
import { UserSession } from '@esri/arcgis-rest-auth';
import { createItem } from '@esri/arcgis-rest-items';
import { getItem } from '@esri/arcgis-rest-portal';
import { request as agoRequest } from '@esri/arcgis-rest-request';
import { Formik, Field } from 'formik';

// Components
import Panel, { PanelTitle } from 'calcite-react/Panel';
import ArcgisItemCard from 'calcite-react/ArcgisItemCard';
import TextField from 'calcite-react/TextField';
import Button from 'calcite-react/Button';
import Label from 'calcite-react/Label';
import Loader from 'calcite-react/Loader';
import Tabs, { TabNav, TabTitle, TabContents, TabSection } from 'calcite-react/Tabs';
import Form, { FormControl, FormControlLabel, FormHelperText } from 'calcite-react/Form';
import FileUploader from 'calcite-react/FileUploader';
import { CalciteP } from 'calcite-react/Elements';
import Alert from 'calcite-react/Alert';
import Radio from 'calcite-react/Radio';
import Switch from 'calcite-react/Switch';
import Table, { TableBody, TableRow, TableCell } from 'calcite-react/Table';
import Checkbox from 'calcite-react/Checkbox';
import TableIcon from 'calcite-ui-icons-react/TableIcon';

// import '@zippytech/react-toolkit/ComboBox/index.css';

// Import React Table
import ReactTable from 'react-table';
import 'react-table/react-table.css';

import styled from 'styled-components';

import {
  parseSDMXDataFile,
  getGeoJsonUrl,
  parseGeoJsonGeoFile,
  loadSDMXFromAPI,
  loadFeatureServiceFields,
  getGeoJsonByUniqueFieldValues,
  uploadGeoJSONToAzureBlob
} from '../services/sdmxRequest';

const RadioControlContainer = styled.div`
  max-height: 300px;
  overflow: scroll;
  border: 1px solid #cccccc;
`;

// Class
class SDMXItemPublisherForm extends Component {
  constructor(props) {
    super(props);

    this.state = {
      userAuth: UserSession.fromCredential(this.props.auth.user.portal.credential),
      itemSuccess: true,

      isLoadingFCFromAPI: false,
      isLoadingFSFromURL: false,
      isPublishingFeatureService: false,
      hideGeoTable: true,
      hideFCTable: true,

      hideFCFilters: true,
      hideGeoFilters: true,

      newItem: null,
      stashedGeographyField: '',
      stashedSDMXField: '',
      geoJsonGeographiesFields: [],
      formValues: {
        geographyField: '',
        sdmxField: '',
        sdmxdatajsonfile: null,
        geojsongeofile: null,
        prefixSDMX: '',
        prefixGeoJSON: '',
        loadGeoFromFSUrl:
          'https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/World_Countries_(Generalized)/FeatureServer/0',
        loadSDMXFromAPIUrl:
          'https://stats.spc.int/SeptemberDisseminateNSIService/Rest/data/SPC,DF_SDG,1.0/all/?startPeriod=2017&endPeriod=2018&dimensionAtObservation=AllDimensions'
      },
      isValidatingGeoJsonFile: false,
      isValidatingSDMXFile: false,
      activeSDMXTabIndex: 0,
      activeGeoTabIndex: 0,
      fc: {
        features: []
      },
      sdmxName: '',
      geoJsonName: 'myGeoJsonFile',
      geoJsonGeographies: {
        features: []
      },
      publishLog: []
    };

    this.onSDMXTabChange = this.onSDMXTabChange.bind(this);
    this.onGeoTabChange = this.onGeoTabChange.bind(this);
  }

  /**
   * Change event to switch tabs for SDMX section
   */
  onSDMXTabChange(index) {
    this.setState({ activeSDMXTabIndex: index });
  }

  /**
   * Change event to switch tabs for Geography section
   */
  onGeoTabChange(index) {
    this.setState({ activeGeoTabIndex: index });
  }

  /**
   * Load SDMX from a local file
   * @param file
   */
  onSDMXFileChange = async file => {
    this.setState({ isValidatingSDMXFile: true });

    let response;
    try {
      response = await parseSDMXDataFile(file);

      this.setState({
        isValidatingSDMXFile: false,
        fc: response,
        sdmxName: file.name.replace(/-/g, '_').replace('.json', '')
      });
    } catch (err) {
      console.log(err);
      this.setState({ isValidatingSDMXFile: false });
    }
  };

  /**
   * Load SDMX from an SDMX API URL endpoint
   * @param url
   */
  loadSDMXFromUrl = async url => {
    if (url && url !== '') {
      this.setState({ fc: { features: [] }, isLoadingFCFromAPI: true });

      const response = await loadSDMXFromAPI(url);

      try {
        this.setState({ fc: response.fc, sdmxName: response.sdmxName, isLoadingFCFromAPI: false });
      } catch (err) {
        console.log(err);
        this.setState({ isLoadingFCFromAPI: false });
      }
    }
  };

  /**
   * Load & Parse GeoJSON from a local file
   * @param file
   */
  onGeoJsonFileChange = async file => {
    this.setState({ isValidatingGeoJsonFile: true });

    let response;
    try {
      response = await parseGeoJsonGeoFile(file);
      this.setState({ geoJsonGeographies: response, geoJsonName: file.name, isValidatingGeoJsonFile: false });
    } catch (err) {
      console.log(err);
      this.setState({ isValidatingGeoJsonFile: false });
    }
  };

  loadGeoFieldsFromFeatureService = async url => {
    if (url && url !== '') {
      this.setState({ geoJsonGeographies: { features: [] }, isLoadingFSFromURL: true });

      const params = {
        httpMethod: 'GET',
        params: {
          f: 'json',
          token: this.state.userAuth.token
        }
      };

      let response;
      try {
        response = await loadFeatureServiceFields(url, params);
        if (response && response.fields && response.fields.length > 0) {
          this.setState({ geoJsonGeographiesFields: response.fields, isLoadingFSFromURL: false });
        }
      } catch (err) {
        console.log(err);
        this.setState({ isLoadingFSFromURL: false });
      }
    }
  };

  publishLayer = async (values, actions) => {
    actions.setSubmitting(true);

    this.setState({
      isPublishingFeatureService: true,
      publishLog: [...this.state.publishLog, { message: 'Querying for GeoJSON ...' }]
    });

    let gjToUpload = this.state.fc;

    if (this.state.geoJsonGeographies) {
      let fGeoJson = values.geographyField;
      let fSDMX = values.sdmxField;
      let pGeoJson = values.prefixGeoJSON || null;
      let pSDMX = values.prefixSDMX || null;

      const uniqueSDMXValues = Array.from(new Set(this.state.fc.features.map(feature => feature.properties[fSDMX])));
      const where = `${fGeoJson} IN ('${uniqueSDMXValues.join("','")}')`;
      // console.log(where);
      let uniqueGeoJson;

      try {
        uniqueGeoJson = await getGeoJsonByUniqueFieldValues(values.loadGeoFromFSUrl, where, this.state.userAuth.token);

        this.setState({ geoJsonGeographies: uniqueGeoJson });

        gjToUpload = this.joinSDMXtoGeoJson(uniqueGeoJson, this.state.fc, fGeoJson, pGeoJson, fSDMX, pSDMX);
      } catch (err) {
        console.log(err);
        this.setState({
          isPublishingFeatureService: false,
          publishLog: [
            ...this.state.publishLog,
            { isError: true, message: `Unable to query GeoJSON or join to SDMX:  ${JSON.stringify(err)}` }
          ]
        });
      }
    }

    this.setState({
      publishLog: [...this.state.publishLog, { message: 'Uploading GeoJson to temporary cloud storage ...' }]
    });

    const uploadResponse = await uploadGeoJSONToAzureBlob(gjToUpload);
    // console.log(uploadResponse);

    // START HERE! --
    this.setState({
      publishLog: [...this.state.publishLog, { message: 'Adding GeoJson Item to My Content in ArcGIS Online ... ' }]
    });
    // this.createGeoJsonItem(uploadResponse.blobUrl, actions);
  };

  joinSDMXtoGeoJson = (geojson, fc, gjField, pGeoJson, sdmxField, pSDMX) => {
    this.setState({ publishLog: [...this.state.publishLog, { message: 'Joining SDMX to GeoJson ...' }] });

    let tempCache = {};
    let foundGeom = null;

    fc.features.forEach(feature => {
      if (tempCache[feature.properties[sdmxField]]) {
        feature.geometry = tempCache[feature.properties[sdmxField]];
      } else {
        foundGeom = null;
        foundGeom = geojson.features.filter(gjFeature => {
          const gjValue = gjFeature.properties[gjField];
          const sdmxValue = feature.properties[sdmxField];
          if (pGeoJson && pSDMX) {
            return `${pGeoJson}${gjValue}` === `${pSDMX}${sdmxValue}`;
          } else if (pGeoJson) {
            return `${pGeoJson}${gjValue}` === sdmxValue;
          } else if (pSDMX) {
            return gjValue === `${pSDMX}${sdmxValue}`;
          } else {
            return gjValue === sdmxValue;
          }
        })[0];
        if (foundGeom && foundGeom.geometry) {
          tempCache[feature.properties[sdmxField]] = foundGeom.geometry;
          feature.geometry = foundGeom.geometry;
        }
      }
    });

    tempCache = {};

    return fc;
  };

  createGeoJsonItem = (url, actions) => {
    const item = {
      title: this.state.sdmxName,
      type: 'GeoJson'
    };

    const params = {
      dataUrl: url,
      overwrite: true,
      async: true
    };

    createItem({
      item,
      params,
      authentication: this.state.userAuth
    }).then(
      response => {
        console.log(response);
        if (response.success) {
          const itemId = response.id;
          const timer = setInterval(() => this.checkAddItemStatus(itemId, actions), 1000);
          this.setState({ timer: timer });
        }
      },
      error => {
        this.setState({
          isSuccess: false,

          isPublishingFeatureService: false,
          publishLog: [...this.state.publishLog, { isError: true, message: error.message }]
        });
        actions.setSubmitting(false);
      }
    );
  };

  checkAddItemStatus = (itemId, actions) => {
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
        console.log('checkAddItemStatus', response);
        if (response.status === 'completed') {
          clearInterval(this.state.timer);
          this.setState({ timer: null });
          this.publishItemAsLayer(response.itemId, actions);
        }
      })
      .catch(error => {
        console.log(error);
        this.setState({
          isSuccess: false,

          isPublishingFeatureService: false,
          publishLog: [...this.state.publishLog, { isError: true, message: error.message }]
        });

        actions.setSubmitting(false);
      });
  };

  checkRelatedItems = itemId => {
    const user = this.props.auth.user.username;
    const portalUrl = this.props.auth.user.portal.restUrl;
    const token = this.props.auth.user.portal.credential.token;
    // https://www.arcgis.com/sharing/rest/content/items/<>/relatedItems?f=json&relationshipType=Service2Data&direction=reverse
    const url = `${portalUrl}/content/items/${itemId}/relatedItems`;

    return agoRequest(url, {
      httpMethod: 'GET',
      params: {
        relationshipType: 'Service2Data',
        f: 'json',
        token: token,
        direction: 'reverse'
      }
    });
  };

  publishItemAsLayer = (itemId, actions) => {
    this.setState({
      publishLog: [...this.state.publishLog, { message: 'Publishing GeoJson as a Hosted Feature Service ...' }]
    });

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
        overwrite: false,
        publishParameters: {
          hasStaticData: true,
          name: this.state.sdmxName,
          maxRecordCount: 10000,
          layerInfo: {
            capabilities: 'Query'
          }
        }
      }
    })
      .then(response => {
        // debugger;
        const itemId = response.services[0].serviceItemId;
        const timer = setInterval(() => this.checkPublishItemStatus(itemId, actions), 1000);
        this.setState({ timer: timer });
      })
      .catch(error => {
        console.log(error);

        // PUB_0047 - "User cant overwrite this service, using this data, as this data is already referring to another service."
        if (error.code === 'PUB_0047') {
          this.checkRelatedItems(itemId)
            .then(response => {
              if (response && response.relatedItems && response.relatedItems.length > 0) {
                const relatedItem = response.relatedItems[0];
                // const checkUrl = `${portalUrl}/content/users/${user}/items/${itemId}/status`;
                const portal = this.props.auth.user.portal;
                const portalUrlKey = portal.url.replace('www', `${portal.urlKey}.maps`);
                const checkUrl = `${portalUrlKey}/home/item.html?id=${relatedItem.id}`;
                this.setState({
                  publishLog: [
                    ...this.state.publishLog,
                    { isError: true, message: `View related item here, ${checkUrl}` }
                  ]
                });
              }
            })
            .catch(error => {
              debugger;
              console.log(error);
            });
        }

        this.setState({
          isSuccess: false,

          isPublishingFeatureService: false,
          publishLog: [...this.state.publishLog, { isError: true, message: error.message }]
        });
        actions.setSubmitting(false);
      });
  };

  checkPublishItemStatus = (itemId, actions) => {
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
        console.log('checkPublishItemStatus', response);
        if (response.status === 'completed') {
          clearInterval(this.state.timer);
          this.setState({ timer: null });

          const newId = response.itemId;

          getItem(newId, { authentication: this.state.userAuth })
            .then(response => {
              // all done!
              this.setState({
                isPublishingFeatureService: false,

                newItem: response,
                isSuccess: true,
                publishLog: []
              });
              actions.setSubmitting(false);
            })
            .catch(error => {
              console.log(error);
              actions.setSubmitting(false);
            });
        } else if (response.status === '') {
          clearInterval(this.state.timer);
          this.setState({ timer: null });
          this.setState({
            isSuccess: false,

            isPublishingFeatureService: false,
            publishLog: [...this.state.publishLog, { isError: true, message: response.statusMessage }]
          });
        }
      })
      .catch(error => {
        console.log(error);
        this.setState({
          isSuccess: false,

          isPublishingFeatureService: false,
          publishLog: [...this.state.publishLog, { isError: true, message: error.message }]
        });
        actions.setSubmitting(false);
      });
  };

  getSDMXStatusReport = () => {
    if (this.state.isLoadingFCFromAPI || this.state.isValidatingSDMXFile) {
      return (
        <Loader className="text-left" sizeRatio={0.5}>
          {this.state.isValidatingSDMXFile ? 'Loading ...' : 'Querying ...'}
        </Loader>
      );
    } else if (this.state.fc.features.length > 0) {
      return <Label>{this.state.fc.features.length} features found</Label>;
    } else {
      return null;
    }
  };

  getFSUrlStatusReport = () => {
    if (this.state.isLoadingFSFromURL) {
      return (
        <Loader className="text-left" sizeRatio={0.5}>
          Querying ...
        </Loader>
      );
    } else if (this.state.geoJsonGeographies.features.length > 0) {
      return <Label>{this.state.geoJsonGeographies.features.length} features found</Label>;
    } else if (this.state.fc.features.length === 0) {
      return <CalciteP className="margin-left-2">Please Select an SDMX source first</CalciteP>;
    } else {
      return null;
    }
  };

  getGeoJsonFileUploadStatusReport = () => {
    if (this.state.isValidatingGeoJsonFile) {
      return (
        <Loader className="text-left" sizeRatio={0.5}>
          {this.state.isValidatingGeoJsonFile ? 'Loading ...' : 'Querying ...'}
        </Loader>
      );
    } else if (this.state.geoJsonGeographies.features.length > 0) {
      return <Label>{this.state.geoJsonGeographies.features.length} features found</Label>;
    } else if (this.state.fc.features.length === 0) {
      return <CalciteP className="column-8 margin-left-2">Please Select an SDMX source first</CalciteP>;
    } else {
      return null;
    }
  };

  getPublishStatusReport = () => {
    if (this.state.isPublishingFeatureService) {
      return <Loader className="text-left" sizeRatio={0.5} />;
    } else {
      return null;
    }
  };

  onRadioChange = e => {
    console.log(e.target.name, e.target.value);
  };

  previewDataTable = tblName => {
    if (tblName === 'fc' && this.state.fc.features.length > 0) {
      this.setState({ hideFCTable: !this.state.hideFCTable });
    } else if (tblName === 'geo' && this.state.geoJsonGeographies.features.length > 0) {
      this.setState({ hideGeoTable: !this.state.hideGeoTable });
    }
  };

  toggleDataTableFilters = tblName => {
    if (tblName === 'fc' && this.state.fc.features.length > 0) {
      this.setState({ hideFCFilters: !this.state.hideFCFilters });
    } else if (tblName === 'geo' && this.state.geoJsonGeographies.features.length > 0) {
      this.setState({ hideGeoFilters: !this.state.hideGeoFilters });
    }
  };

  /**
   * Return AGS Item Card
   * @return ArcgisItemCard
   */
  getItemCard() {
    return <ArcgisItemCard item={this.state.newItem} />;
  }

  /**
   * Return AGS Item Card
   */
  onItemCardClick = () => {
    const item = this.state.newItem;
    const portal = this.props.auth.user.portal;
    const portalUrlKey = portal.url.replace('www', `${portal.urlKey}.maps`);
    const url = `${portalUrlKey}/home/item.html?id=${item.id}`;

    window.open(url, '_blank');
  };

  render() {
    return (
      <div className="grid-container leader-1">
        <Formik initialValues={this.state.formValues} onSubmit={this.publishLayer}>
          {({ values, errors, touched, handleSubmit, isSubmitting }) => (
            <Form onSubmit={handleSubmit}>
              <Panel className="column-24 text-left">
                <PanelTitle>Step 1. Upload an SDMX JSON file or URL that returns an SDMX JSON file</PanelTitle>
                <Tabs onTabChange={this.onSDMXTabChange} activeTabIndex={this.state.activeSDMXTabIndex}>
                  <TabNav>
                    <TabTitle>JSON File Upload</TabTitle>
                    <TabTitle>SDMX API URL</TabTitle>
                  </TabNav>
                  <TabContents>
                    <TabSection>
                      <FormControl
                        success={touched.sdmxdatajsonfile && !errors.sdmxdatajsonfile ? true : false}
                        error={touched.sdmxdatajsonfile && errors.sdmxdatajsonfile ? true : false}>
                        <FormControlLabel>Upload a JSON File</FormControlLabel>
                        <div className="grid-container">
                          <Field
                            className="column-8"
                            component={FileUploader}
                            name="sdmxdatajsonfile"
                            accept="text/json"
                            onChange={e => {
                              const file = e.currentTarget.files[0];
                              this.onSDMXFileChange(file);
                            }}
                          />
                          {/* {this.state.fc.features.length > 0 ? (
                            <div className="column-8 leader-half">
                              <Label className="margin-left-2">{this.state.fc.features.length} data points found</Label>{' '}
                            </div>
                          ) : null} */}
                          <div className="column-1 leader-half">
                            <div className="margin-left-2">{this.getSDMXStatusReport()}</div>
                          </div>
                        </div>
                        <FormHelperText>{(touched.sdmxdatajsonfile && errors.sdmxdatajsonfile) || null}</FormHelperText>
                      </FormControl>
                    </TabSection>
                    <TabSection>
                      <FormControl
                        success={touched.loadSDMXFromAPIUrl && !errors.loadSDMXFromAPIUrl ? true : false}
                        error={touched.loadSDMXFromAPIUrl && errors.loadSDMXFromAPIUrl ? true : false}>
                        <FormControlLabel>Enter in a Url to an SDMX API Endpoint</FormControlLabel>
                        <div className="grid-container">
                          <div className="column-12">
                            <Field
                              disabled={this.state.isLoadingFCFromAPI}
                              component={TextField}
                              type="text"
                              name="loadSDMXFromAPIUrl"
                              placeholder="hello world"
                              rightAdornment={
                                <Button
                                  disabled={this.state.isLoadingFCFromAPI}
                                  onClick={() => this.loadSDMXFromUrl(values.loadSDMXFromAPIUrl)}>
                                  {this.state.isLoadingFCFromAPI ? 'Querying SDMX API ...' : 'Load'}
                                </Button>
                              }
                            />
                          </div>
                          <div className="column-1 leader-half">{this.getSDMXStatusReport()}</div>
                        </div>
                        <FormHelperText>
                          {(touched.loadSDMXFromAPIUrl && errors.loadSDMXFromAPIUrl) || null}
                        </FormHelperText>
                      </FormControl>
                    </TabSection>
                  </TabContents>
                </Tabs>
                {this.state.fc.features.length > 0 ? (
                  <div className="leader-1">
                    <Button
                      className="margin-left-1"
                      icon={<TableIcon size={12} />}
                      iconPosition="before"
                      transparent
                      small
                      onClick={() => this.previewDataTable('fc')}>
                      Toggle Data Preview
                    </Button>
                    <div className={this.state.hideFCTable ? 'hide leader-1' : 'leader-1'}>
                      <Checkbox onChange={() => this.toggleDataTableFilters('fc')}> Use Filters?</Checkbox>
                    </div>
                    <ReactTable
                      className={
                        this.state.hideFCTable ? 'leader-1 -striped -highlight hide' : 'leader-1 -striped -highlight'
                      }
                      filterable={!this.state.hideFCFilters}
                      data={this.state.fc.features}
                      columns={
                        this.state.fc && this.state.fc.features.length > 0
                          ? Object.keys(this.state.fc.features[0].properties).map(key => {
                              return { Header: key, accessor: `properties.${key}` };
                            })
                          : []
                      }
                      defaultPageSize={10}
                    />
                  </div>
                ) : null}
              </Panel>
              <Panel className="column-24 text-left leader-1">
                <PanelTitle>Step 2. Add Geography (optional)</PanelTitle>

                <Tabs onTabChange={this.onGeoTabChange} activeTabIndex={this.state.activeGeoTabIndex}>
                  <TabNav>
                    <TabTitle>From GeoJSON File</TabTitle>
                    <TabTitle>From a Feature Service URL</TabTitle>
                    <TabTitle>From a Shapefile</TabTitle>
                  </TabNav>
                  <TabContents>
                    <TabSection>
                      <FormControl
                        success={touched.geojsongeofile && !errors.geojsongeofile ? true : false}
                        error={touched.geojsongeofile && errors.geojsongeofile ? true : false}>
                        <FormControlLabel>Upload a GeoJSON File</FormControlLabel>
                        <div className="grid-container">
                          <Field
                            className="column-8"
                            disabled={this.state.fc.features.length === 0}
                            component={FileUploader}
                            name="geojsongeofile"
                            accept="text/json"
                            onChange={e => {
                              const file = e.currentTarget.files[0];
                              this.onGeoJsonFileChange(file);
                            }}
                          />
                          <div className="column-1 leader-half">
                            <div className="margin-left-2">{this.getGeoJsonFileUploadStatusReport()}</div>
                          </div>
                        </div>
                        <FormHelperText>{(touched.geojsongeofile && errors.geojsongeofile) || null}</FormHelperText>
                      </FormControl>
                    </TabSection>
                    <TabSection>
                      <FormControl
                        success={touched.loadGeoFromFSUrl && !errors.loadGeoFromFSUrl ? true : false}
                        error={touched.loadGeoFromFSUrl && errors.loadGeoFromFSUrl ? true : false}>
                        <FormControlLabel>Enter in a Url to a Feature Service</FormControlLabel>
                        <div className="grid-container">
                          <div className="column-12">
                            <Field
                              disabled={this.state.isLoadingFSFromURL || this.state.fc.features.length === 0}
                              component={TextField}
                              type="text"
                              name="loadGeoFromFSUrl"
                              placeholder="hello world"
                              rightAdornment={
                                <Button
                                  disabled={this.state.isLoadingFSFromURL || this.state.fc.features.length === 0}
                                  onClick={() => this.loadGeoFieldsFromFeatureService(values.loadGeoFromFSUrl)}>
                                  {this.state.isLoadingFSFromURL ? 'Querying Feature Service ...' : 'Load'}
                                </Button>
                              }
                            />
                          </div>
                          <div className="leader-half">{this.getFSUrlStatusReport()}</div>
                        </div>
                        <FormHelperText>{(touched.loadGeoFromFSUrl && errors.loadGeoFromFSUrl) || null}</FormHelperText>
                      </FormControl>
                    </TabSection>
                    <TabSection>TODO >></TabSection>
                  </TabContents>
                </Tabs>
                {this.state.geoJsonGeographies.features.length > 0 ? (
                  <div className="leader-1">
                    <Button
                      className="margin-left-1"
                      icon={<TableIcon size={12} />}
                      iconPosition="before"
                      transparent
                      extraSmall
                      onClick={() => this.previewDataTable('geo')}>
                      Toggle Data Preview
                    </Button>
                    <div className={this.state.hideGeoTable ? 'hide leader-1' : 'leader-1'}>
                      <Checkbox onChange={() => this.toggleDataTableFilters('geo')}> Use Filters?</Checkbox>
                    </div>
                    <ReactTable
                      className={
                        this.state.hideGeoTable ? 'leader-1 -striped -highlight hide' : 'leader-1 -striped -highlight'
                      }
                      filterable={!this.state.hideGeoFilters}
                      data={this.state.geoJsonGeographies.features}
                      columns={
                        this.state.geoJsonGeographies && this.state.geoJsonGeographies.features.length > 0
                          ? Object.keys(this.state.geoJsonGeographies.features[0].properties).map(key => {
                              return { Header: key, accessor: `properties.${key}` };
                            })
                          : []
                      }
                      defaultPageSize={10}
                    />
                  </div>
                ) : null}
                {this.state.geoJsonGeographiesFields.length > 0 && this.state.fc.features.length > 0 ? (
                  <Panel white className="leader-1">
                    <PanelTitle>Match Fields</PanelTitle>
                    <div className="grid-container join-field">
                      <div className="column-6 text-left">
                        <div className="leader-1 trailer-1">
                          <Label>Add Prefix to Geography Field?</Label>
                          <Field component={TextField} type="text" name="prefixGeoJSON" />
                        </div>
                        <FormControlLabel htmlFor="geographyField">Select Geography field:</FormControlLabel>
                        <RadioControlContainer>
                          <FormControl
                            success={touched.geographyField && !errors.geographyField ? true : false}
                            error={touched.geographyField && errors.geographyField ? true : false}>
                            {this.state.geoJsonGeographiesFields.map((field, index) => (
                              <Field
                                key={index}
                                component={Radio}
                                name="geographyField"
                                value={field.name}
                                onChange={this.onRadioChange}>
                                {field.name}
                              </Field>
                            ))}
                            <FormHelperText>{(touched.geographyField && errors.geographyField) || null}</FormHelperText>
                          </FormControl>
                        </RadioControlContainer>
                      </div>
                      <div className="column-6 text-left">
                        <div className="leader-1 trailer-1">
                          <Label>Add Prefix to SDMX Field?</Label>
                          <Field component={TextField} type="text" name="prefixSDMX" />
                        </div>
                        <FormControlLabel htmlFor="sdmxField">Select SDMX field:</FormControlLabel>
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
                      </div>
                    </div>
                  </Panel>
                ) : null}
              </Panel>
              <Panel className="column-24 text-left leader-1 trailer-2">
                <PanelTitle className="text-left">Step 3. Publish as Hosted Feature Service</PanelTitle>
                <div className="grid-container">
                  <div className="column-2">
                    <Button extraLarge disabled={isSubmitting} type="submit">
                      {isSubmitting ? 'Publishing ...' : 'Publish'}
                    </Button>
                  </div>
                  <div className="column-1 leader-half">{this.getPublishStatusReport()}</div>
                </div>
                <br />
                {this.state.publishLog.length > 0 ? (
                  <Table className="leader-1 column-14">
                    <TableBody>
                      {this.state.publishLog.map((item, index) => {
                        const isError = item.isError;
                        return (
                          <TableRow key={index}>
                            <TableCell>
                              {isError ? (
                                <Alert fullWidth red>
                                  {item.message}
                                </Alert>
                              ) : (
                                item.message
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : null}
              </Panel>
              {/* <pre>
                {JSON.stringify(values, null, 2)}
                {JSON.stringify(this.state, null, 2)}
              </pre> */}
              {this.state.isSuccess ? (
                <Panel className="column-24 text-left leader-1 trailer-2">
                  <PanelTitle>New Item in ArcGIS Online</PanelTitle>
                  <ArcgisItemCard
                    className="success-panel column-16"
                    item={this.state.newItem}
                    onClick={this.onItemCardClick}
                  />
                </Panel>
              ) : null}
            </Form>
          )}
        </Formik>
      </div>
    );
  }
}

const mapStateToProps = state => ({
  auth: state.auth,
  config: state.config,
  isSuccess: state.isSuccess
});

export default connect(mapStateToProps)(SDMXItemPublisherForm);
