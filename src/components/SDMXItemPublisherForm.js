// React
import React, { Component } from 'react';

// Redux
import { connect } from 'react-redux';

// esri/arcgis-rest-items
import { UserSession } from '@esri/arcgis-rest-auth';
import { getItem } from '@esri/arcgis-rest-portal';
import axios from 'axios';
import { Formik, Field } from 'formik';

// Components
import Panel, { PanelTitle } from 'calcite-react/Panel';
import ArcgisItemCard from 'calcite-react/ArcgisItemCard';
import TextField from 'calcite-react/TextField';
import Button, { ButtonGroup } from 'calcite-react/Button';
import Label from 'calcite-react/Label';
import Loader from 'calcite-react/Loader';
import Tabs, { TabNav, TabTitle, TabContents, TabSection } from 'calcite-react/Tabs';
import Form, { FormControl, FormControlLabel, FormHelperText } from 'calcite-react/Form';
import FileUploader from 'calcite-react/FileUploader';
import Alert from 'calcite-react/Alert';
import Radio from 'calcite-react/Radio';
import Switch from 'calcite-react/Switch';

import Table, { TableBody, TableRow, TableCell } from 'calcite-react/Table';

import { Progress } from 'react-sweet-progress';
import 'react-sweet-progress/lib/style.css';

// Import React Table
import ReactTable from 'react-table';
import 'react-table/react-table.css';

import CalciteGridContainer from './CalciteGridContainer';
import CalciteGridColumn from './CalciteGridColumn';

import styled from 'styled-components';

import {
  parseSDMXDataFile,
  parseGeoJsonGeoFile,
  loadSDMXFromAPI,
  loadFeatureServiceFields
} from '../services/sdmxRequest';
import { select } from '@redux-saga/core/effects';

const RadioControlContainer = styled.div`
  max-height: 300px;
  overflow: scroll;
  border: 1px solid #cccccc;
`;

const BaseGridContainer = styled(CalciteGridContainer)`
  margin-left: 10px;
  margin-right: 10px;
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
        newItemName: '',
        loadGeoFromFSUrl:
          'https://services3.arcgis.com/7pxWboj3YvCWYdcm/ArcGIS/rest/services/1270055001_ste_2016_aust_shape/FeatureServer/0',
        loadSDMXFromAPIUrl:
          'http://cambodgia-statvm1.eastasia.cloudapp.azure.com/SeptemberDisseminateNSIService/rest/data/KH_NIS,DF_PRODUCTION,1.1/.........A/?startPeriod=2016&endPeriod=2018&dimensionAtObservation=AllDimensions'
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
      publishLog: [],
      percentProgress: 0,
      progressError: null,
      hasSDMX: false,
      hasGeography: false,
      sdmxObservationCount: 0,
      geographiesCount: 0,
      sdmxFields: [],
      sdmxDataFile: null,
      geoJsonDataFile: null,
      selectedResponseFormat: 1,
      useGeography: false
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
        sdmxDataFile: response.sdmxDataFile,
        hasSDMX: true,
        isValidatingSDMXFile: false,
        sdmxObservationCount: response.count,
        sdmxFields: response.sdmxFields,
        sdmxName: file.name.replace(/-/g, '_').replace('.json', '')
      });
    } catch (err) {
      console.log(err);
      this.setState({ sdmxDataFile: null, hasSDMX: false, isValidatingSDMXFile: false });
    }
  };

  /**
   * Load SDMX from an SDMX API URL endpoint
   * @param url
   */
  loadSDMXFromUrl = async url => {
    if (url && url !== '') {
      this.setState({ isLoadingFCFromAPI: true });

      const returnJson = this.state.selectedResponseFormat === 1 ? true : false;
      try {
        const response = await loadSDMXFromAPI(url, returnJson);
        this.setState({
          hasSDMX: true,
          sdmxObservationCount: response.count,
          sdmxFields: response.sdmxFields,
          sdmxName: response.sdmxName,
          isLoadingFCFromAPI: false
        });
      } catch (err) {
        console.log(err);
        this.setState({ isLoadingFCFromAPI: false });
      }
    }
  };

  /**
   * Load SDMX from an SDMX API URL endpoint
   * @param url
   */
  loadSDMXFromUrl_o = async url => {
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
      const geoFields = Object.keys(response.geoJsonData.features[0].properties);
      this.setState({
        geoJsonDataFile: response.geoJsonData,
        geoJsonGeographiesFields: geoFields,
        hasGeography: true,
        geoJsonName: file.name,
        isValidatingGeoJsonFile: false
      });
    } catch (err) {
      console.log(err);
      this.setState({ hasGeography: false, geoJsonDataFile: null, isValidatingGeoJsonFile: false });
    }
  };

  loadGeoFieldsFromFeatureService = async url => {
    if (url && url !== '') {
      this.setState({ geoJsonGeographiesFields: [], isLoadingFSFromURL: true });

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
          const geoFields = response.fields.map(field => field.name);
          this.setState({ hasGeography: true, geoJsonGeographiesFields: geoFields, isLoadingFSFromURL: false });
        }
      } catch (err) {
        console.log(err);
        this.setState({ hasGeography: false, isLoadingFSFromURL: false });
      }
    }
  };

  appendSDMXSource = (source, data, requestOptions) => {
    if (source === 'file') {
      let formData = new FormData();
      formData.append('myfile[]', data);
      requestOptions.data = formData;
    } else {
      requestOptions.params.sdmxApi = data;
    }

    return requestOptions;
  };

  appendGeoSource = (source, data, requestOptions) => {
    if (source === 'file') {
      requestOptions.data.append('myfile[]', data);
    } else {
      requestOptions.params.geoApi = data;
    }

    return requestOptions;
  };

  publishLayer = async (values, actions) => {
    actions.setSubmitting(true);

    const user = this.props.auth.user.username;
    const portalUrl = this.props.auth.user.portal.restUrl;
    const token = this.props.auth.user.portal.credential.token;

    const userContentUrl = `${portalUrl}/content/users/${user}`;

    this.setState({
      isSuccess: false,
      newItem: null,
      isPublishingFeatureService: true,
      percentProgress: 0,
      publishLog: []
    });

    // collect parameters
    // const host = 'http://localhost:3000';
    const host = 'https://sdmx-express.azurewebsites.net';
    const requestUrl = `${host}/publishSDMX`;

    let requestOptions = {
      url: requestUrl,
      method: 'post',
      responseType: 'json',
      params: {
        title: values.newItemName,
        token,
        userContentUrl: userContentUrl,
        sdmxApiFormat: this.state.selectedResponseFormat === 1 ? 'json' : 'xml'
      }
    };

    if (this.state.activeSDMXTabIndex === 1) {
      if (values.sdmxdatajsonfile && values.sdmxdatajsonfile[0]) {
        let fd = new FormData();
        fd.append('sdmxFile', values.sdmxdatajsonfile[0]);
        requestOptions.data = fd;
      }
    } else {
      requestOptions.params.sdmxApi = values.loadSDMXFromAPIUrl;
    }

    if (this.state.useGeography) {
      if (this.state.activeGeoTabIndex === 1) {
        if (values.geojsongeofile && values.geojsongeofile[0]) {
          if (requestOptions.data) {
            requestOptions.data.append('geoFile', values.geojsongeofile[0]);
          } else {
            let fd = new FormData();
            fd.append('geoFile', values.geojsongeofile[0]);
            requestOptions.data = fd;
          }
        }
      } else {
        requestOptions.params.geographiesFeatureServiceUrl = values.loadGeoFromFSUrl;
      }
      requestOptions.params.geoField = values.geographyField;
      requestOptions.params.sdmxField = values.sdmxField;
      requestOptions.params.joinToGeographies = true;
    }

    try {
      const response = await axios(requestOptions);
      if (response.data && response.data.checkJobStatusUrl) {
        const timer = setInterval(async () => {
          let checkResponse = null;
          try {
            checkResponse = await axios.get(response.data.checkJobStatusUrl);
          } catch (error) {
            clearInterval(timer);
            this.logError(`unable to get status check from server :: ${response.data.checkJobStatusUrl}`, actions);
            return;
          }

          if (checkResponse.data.isCompleted && checkResponse.data !== null) {
            clearInterval(timer);

            actions.setSubmitting(false);

            this.setState({
              publishLog: [],
              isPublishingFeatureService: false
            });

            const publishedItemId = checkResponse.data.data.itemId;
            const itemInfo = await getItem(publishedItemId, { authentication: this.state.userAuth });

            this.setState({
              newItem: itemInfo,
              isSuccess: true
            });
          } else if (!checkResponse.data.isCompleted && !checkResponse.data.isFailed && !checkResponse.data.error) {
            this.setState({ percentProgress: parseInt(checkResponse.data.progress) });
          } else if (checkResponse.data.isFailed || checkResponse.data.error) {
            clearInterval(timer);
            this.logError(`Failure processing. ${checkResponse.data.failedReason}`, actions);
          }
        }, 1000);
      }
    } catch (error) {
      this.logError(`Unable to connect to server. ${requestUrl} may be unreachable.`, actions);
    }
  };

  getSDMXStatusReport = () => {
    if (this.state.isLoadingFCFromAPI || this.state.isValidatingSDMXFile) {
      return (
        <Loader className="text-left" sizeRatio={0.5}>
          {this.state.isValidatingSDMXFile ? 'Loading ...' : 'Querying ...'}
        </Loader>
      );
    } else if (this.state.sdmxObservationCount > 0) {
      return <Label>{this.state.sdmxObservationCount} observations found</Label>;
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
    } else if (this.state.geographiesCount > 0) {
      return <Label>{this.state.geographiesCount} geographies found</Label>;
    } else if (this.state.sdmxObservationCount === 0) {
      // return <CalciteP className="margin-left-2">Please Select an SDMX source first</CalciteP>;
      return null;
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
    } else if (this.state.geographiesCount > 0) {
      return <Label>{this.state.geographiesCount} features found</Label>;
    } else if (this.state.sdmxObservationCount === 0) {
      // return <CalciteP className="column-8 margin-left-2">Please Select an SDMX source first</CalciteP>;
      return null;
    } else {
      return null;
    }
  };

  getPublishStatusReport = () => {
    if (this.state.isPublishingFeatureService) {
      // return <Loader className="text-left" sizeRatio={0.5} />;
      const percComplete = this.state.percentProgress;
      return (
        <Progress
          status={this.state.progressError}
          theme={{
            error: {
              symbol: percComplete + '%',
              trailColor: 'pink',
              color: 'red'
            },
            default: {
              symbol: percComplete + '%',
              trailColor: 'lightblue',
              color: 'blue'
            },
            active: {
              symbol: percComplete + '%',
              trailColor: 'yellow',
              color: 'orange'
            },
            success: {
              symbol: percComplete + '%',
              trailColor: 'lime',
              color: 'green'
            }
          }}
          percent={percComplete}
        />
      );
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

  /**
   * Log any errors
   */
  logError = (message, actions) => {
    console.log(message);
    this.setState({
      isSuccess: false,
      isPublishingFeatureService: false,
      percentProgress: 0,
      progressError: 'error',
      publishLog: [...this.state.publishLog, { isError: true, message: message }]
    });

    if (actions) {
      actions.setSubmitting(false);
    }
  };

  selectResponseFormatButton(selected) {
    this.setState({
      selectedResponseFormat: selected
    });
  }

  validateIt = values => {
    const errors = {};

    if (this.state.activeSDMXTabIndex === 0) {
      if (!this.state.hasSDMX) {
        errors.loadSDMXFromAPIUrl = 'Please validate the SDMX URL by clicking the Check URL button';
      } else if (values.loadSDMXFromAPIUrl === '') {
        errors.loadSDMXFromAPIUrl = 'SDMX API Url can not be blank.';
      }
    } else {
      if (values.sdmxdatajsonfile === null) {
        errors.sdmxdatajsonfile = 'Please select a JSON file.';
      }
    }

    if (this.state.useGeography) {
      if (this.state.activeGeoTabIndex === 0) {
        if (!this.state.hasGeography) {
          errors.loadGeoFromFSUrl = 'Please validate the Feature Service URL by clicking the Check URL button';
        } else if (values.loadGeoFromFSUrl === '') {
          errors.loadSDMXFromAPIUrl = 'Feature Service Url can not be blank.';
        }
      } else {
        if (values.geojsongeofile === null) {
          errors.geojsongeofile = 'Please select a GeoJSON file.';
        }
      }
    }

    if (values.newItemName === '') {
      errors.newItemName = 'Please enter in a name.';
    }

    return errors;
  };

  render() {
    return (
      <CalciteGridContainer className="leader-1">
        <Formik initialValues={this.state.formValues} onSubmit={this.publishLayer} validate={this.validateIt}>
          {({ values, errors, touched, handleSubmit, isSubmitting }) => (
            <Form onSubmit={handleSubmit}>
              <CalciteGridColumn column="24">
                <Panel className="text-left">
                  <PanelTitle>Step 1. Select your SDMX Source</PanelTitle>
                  <Tabs onTabChange={this.onSDMXTabChange} activeTabIndex={this.state.activeSDMXTabIndex}>
                    <TabNav>
                      <TabTitle>SDMX API URL</TabTitle>
                      <TabTitle>JSON File Upload</TabTitle>
                    </TabNav>
                    <TabContents>
                      <TabSection>
                        <FormControl
                          success={touched.loadSDMXFromAPIUrl && !errors.loadSDMXFromAPIUrl ? true : false}
                          error={touched.loadSDMXFromAPIUrl && errors.loadSDMXFromAPIUrl ? true : false}>
                          <CalciteGridColumn column="14">
                            <FormControlLabel>Enter in a Url to an SDMX API Endpoint</FormControlLabel>
                          </CalciteGridColumn>
                          <CalciteGridColumn column="18 trailer-1">
                            <Field
                              disabled={this.state.isLoadingFCFromAPI}
                              component={TextField}
                              type="textarea"
                              name="loadSDMXFromAPIUrl"
                            />
                            <FormHelperText>
                              {(touched.loadSDMXFromAPIUrl && errors.loadSDMXFromAPIUrl) || null}
                            </FormHelperText>
                          </CalciteGridColumn>
                          <CalciteGridColumn column="18">
                            <CalciteGridColumn column="3">
                              <FormControlLabel>Response Format</FormControlLabel>
                            </CalciteGridColumn>
                            <CalciteGridColumn column="5">
                              <ButtonGroup isToggle>
                                <Button
                                  extraSmall
                                  clear={this.state.selectedResponseFormat !== 1}
                                  onClick={() => {
                                    this.selectResponseFormatButton(1);
                                  }}>
                                  JSON
                                </Button>
                                <Button
                                  extraSmall
                                  clear={this.state.selectedResponseFormat !== 2}
                                  onClick={() => {
                                    this.selectResponseFormatButton(2);
                                  }}>
                                  XML
                                </Button>
                              </ButtonGroup>
                            </CalciteGridColumn>
                          </CalciteGridColumn>
                          <CalciteGridColumn column="18">
                            <CalciteGridColumn column="2">
                              <Button
                                disabled={this.state.isLoadingFCFromAPI}
                                onClick={() => this.loadSDMXFromUrl(values.loadSDMXFromAPIUrl)}>
                                {this.state.isLoadingFCFromAPI ? 'Checking ...' : 'Check URL'}
                              </Button>
                            </CalciteGridColumn>
                            <CalciteGridColumn column="1" className="leader-quarter">
                              {this.getSDMXStatusReport()}
                            </CalciteGridColumn>
                          </CalciteGridColumn>
                        </FormControl>
                      </TabSection>
                      <TabSection>
                        <FormControl
                          success={touched.sdmxdatajsonfile && !errors.sdmxdatajsonfile ? true : false}
                          error={touched.sdmxdatajsonfile && errors.sdmxdatajsonfile ? true : false}>
                          <FormControlLabel>Upload a JSON File</FormControlLabel>
                          <CalciteGridColumn column="8">
                            <Field
                              component={FileUploader}
                              name="sdmxdatajsonfile"
                              accept="text/json"
                              onChange={e => {
                                const file = e.currentTarget.files[0];
                                this.onSDMXFileChange(file);
                              }}
                            />
                          </CalciteGridColumn>
                          <CalciteGridColumn column="1" className="leader-half">
                            <div className="margin-left-2">{this.getSDMXStatusReport()}</div>
                          </CalciteGridColumn>
                          <FormHelperText>
                            {(touched.sdmxdatajsonfile && errors.sdmxdatajsonfile) || null}
                          </FormHelperText>
                        </FormControl>
                      </TabSection>
                    </TabContents>
                  </Tabs>
                </Panel>
              </CalciteGridColumn>
              <CalciteGridColumn column="24">
                <Panel className="text-left leader-1">
                  <PanelTitle>
                    Step 2. Add Geography
                    <div className="margin-left-quarter" style={{ display: 'inline-block' }}>
                      <Switch
                        checked={this.state.useGeography}
                        onChange={() => {
                          this.setState({
                            useGeography: !this.state.useGeography
                          });
                        }}
                      />
                    </div>
                  </PanelTitle>
                  <Tabs
                    className={this.state.useGeography ? null : 'geo-tab-disabled'}
                    onTabChange={this.onGeoTabChange}
                    activeTabIndex={this.state.activeGeoTabIndex}>
                    <TabNav>
                      <TabTitle>From a Feature Service URL</TabTitle>
                      <TabTitle>From GeoJSON File</TabTitle>
                      {/* <TabTitle>From a Shapefile</TabTitle> */}
                    </TabNav>
                    <TabContents>
                      <TabSection>
                        <FormControl
                          success={touched.loadGeoFromFSUrl && !errors.loadGeoFromFSUrl ? true : false}
                          error={touched.loadGeoFromFSUrl && errors.loadGeoFromFSUrl ? true : false}>
                          <CalciteGridColumn column="14">
                            <FormControlLabel>Enter in a Url to a Feature Service</FormControlLabel>
                          </CalciteGridColumn>
                          <CalciteGridColumn column="18 trailer-1">
                            <Field component={TextField} type="textarea" name="loadGeoFromFSUrl" />
                            <FormHelperText>
                              {(touched.loadGeoFromFSUrl && errors.loadGeoFromFSUrl) || null}
                            </FormHelperText>
                          </CalciteGridColumn>
                          <CalciteGridColumn column="18">
                            <CalciteGridColumn column="2">
                              <Button onClick={() => this.loadGeoFieldsFromFeatureService(values.loadGeoFromFSUrl)}>
                                {this.state.isLoadingFSFromURL ? 'Checking Feature Service ...' : 'Check URL'}
                              </Button>
                            </CalciteGridColumn>
                            <CalciteGridColumn column="1">
                              <div className="leader-quarter">{this.getFSUrlStatusReport()}</div>
                            </CalciteGridColumn>
                          </CalciteGridColumn>
                        </FormControl>
                      </TabSection>
                      <TabSection>
                        <FormControl
                          success={touched.geojsongeofile && !errors.geojsongeofile ? true : false}
                          error={touched.geojsongeofile && errors.geojsongeofile ? true : false}>
                          <FormControlLabel>Upload a GeoJSON File</FormControlLabel>
                          <CalciteGridColumn column="8">
                            <Field
                              component={FileUploader}
                              name="geojsongeofile"
                              accept="text/json"
                              onChange={e => {
                                const file = e.currentTarget.files[0];
                                this.onGeoJsonFileChange(file);
                              }}
                            />
                          </CalciteGridColumn>
                          <CalciteGridColumn column="1" className="leader-half">
                            <div className="margin-left-2">{this.getGeoJsonFileUploadStatusReport()}</div>
                          </CalciteGridColumn>
                          <FormHelperText>{(touched.geojsongeofile && errors.geojsongeofile) || null}</FormHelperText>
                        </FormControl>
                      </TabSection>
                      {/* <TabSection>TODO >></TabSection> */}
                    </TabContents>
                  </Tabs>
                  {this.state.hasGeography && this.state.hasSDMX ? (
                    <Panel white className="leader-1">
                      <PanelTitle>Match Fields</PanelTitle>
                      <CalciteGridColumn column="6" className="join-field text-left">
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
                                value={field}
                                onChange={this.onRadioChange}>
                                {field}
                              </Field>
                            ))}
                            <FormHelperText>{(touched.geographyField && errors.geographyField) || null}</FormHelperText>
                          </FormControl>
                        </RadioControlContainer>
                      </CalciteGridColumn>
                      <CalciteGridColumn column="6" className="join-field text-left">
                        <FormControlLabel htmlFor="sdmxField">Select SDMX field:</FormControlLabel>
                        <RadioControlContainer>
                          <FormControl
                            success={touched.sdmxField && !errors.sdmxField ? true : false}
                            error={touched.sdmxField && errors.sdmxField ? true : false}>
                            {this.state.sdmxFields.map((field, index) => (
                              <Field key={index} component={Radio} name="sdmxField" value={field}>
                                {field}
                              </Field>
                            ))}
                            <FormHelperText>{(touched.sdmxField && errors.sdmxField) || null}</FormHelperText>
                          </FormControl>
                        </RadioControlContainer>
                      </CalciteGridColumn>
                    </Panel>
                  ) : null}
                </Panel>
              </CalciteGridColumn>
              <CalciteGridColumn column="24">
                <Panel className=" text-left leader-1 trailer-2">
                  <PanelTitle className="text-left">Step 3. Publish as Hosted Feature Service</PanelTitle>
                  <FormControl
                    success={touched.newItemName && !errors.newItemName ? true : false}
                    error={touched.newItemName && errors.newItemName ? true : false}>
                    <CalciteGridContainer>
                      <CalciteGridColumn column="10">
                        <Field
                          disabled={this.state.isLoadingFCFromAPI}
                          component={TextField}
                          type="text"
                          name="newItemName"
                        />
                        <FormHelperText>{(touched.newItemName && errors.newItemName) || null}</FormHelperText>
                      </CalciteGridColumn>
                      <CalciteGridColumn column="3">
                        <Button extraLarge disabled={isSubmitting} type="submit">
                          {isSubmitting ? 'Publishing ...' : 'Publish'}
                        </Button>
                      </CalciteGridColumn>
                    </CalciteGridContainer>
                    <CalciteGridColumn column="6" className="leader-half">
                      {this.getPublishStatusReport()}
                    </CalciteGridColumn>
                  </FormControl>
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
              </CalciteGridColumn>
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
      </CalciteGridContainer>
    );
  }
}

const mapStateToProps = state => ({
  auth: state.auth,
  config: state.config,
  isSuccess: state.isSuccess
});

export default connect(mapStateToProps)(SDMXItemPublisherForm);
