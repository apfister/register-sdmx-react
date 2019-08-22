// React
import React, { Component } from 'react';

// Redux
import { connect } from 'react-redux';

// esri/arcgis-rest-items
import { UserSession } from '@esri/arcgis-rest-auth';
import { createItem } from '@esri/arcgis-rest-items';
import { request as agoRequest } from '@esri/arcgis-rest-request';

import { Formik, Field } from 'formik';
import Form, { FormControl, FormControlLabel, FormHelperText } from 'calcite-react/Form';

// Components
import Panel, { PanelTitle } from 'calcite-react/Panel';
import ArcgisItemCard from 'calcite-react/ArcgisItemCard';
import TextField from 'calcite-react/TextField';
import Button from 'calcite-react/Button';
import Tooltip from 'calcite-react/Tooltip';
import { CalciteA, CalciteH6, CalciteP } from 'calcite-react/Elements';
import Label from 'calcite-react/Label';
import Loader from 'calcite-react/Loader';
import InformationIcon from 'calcite-ui-icons-react/InformationIcon';

import Accordion, { AccordionSection, AccordionTitle, AccordionContent } from 'calcite-react/Accordion';
import Table, {
  TableHeader,
  TableHeaderRow,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell
} from 'calcite-react/Table';

import exampleSDMX from '../services/exampleSDMX.json';

import ComboBox from '@zippytech/react-toolkit/ComboBox';
import '@zippytech/react-toolkit/ComboBox/index.css';

import styled from 'styled-components';
import { fetch } from 'whatwg-fetch';
import CalciteGridContainer from './CalciteGridContainer';
import CalciteGridColumn from './CalciteGridColumn';

const Separator = styled.hr`
  width: 75%;
`;

const AccordionSectionStyled = styled(AccordionSection)`
  max-height: 200px;
  overflow: scroll;
`;

const TableCellStyled = styled(TableCell)`
  padding: 0 0 0 5px;
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
      activeSectionIndexes: [],
      selectedDataFlowValue:
        'http://unepliveservices.unep.org/nsiws/rest/dataflow/IAEG-SDGs/SDG/1.0/?references=all&detail=full',
      selectedDataFlowItem: null,
      outputUrlComponents: {
        baseUrl: '',
        keyParts: [],
        suffix: 'FeatureServer/0'
      },
      formValues: {
        sdmxDataFlow:
          'http://unepliveservices.unep.org/nsiws/rest/dataflow/IAEG-SDGs/SDG/1.0/?references=all&detail=full'
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

  handleDataFlowSelectChange(value, item) {
    this.setState({
      selectedValue: value,
      selectedItem: item
    });
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

  onAccordionChange = (evt, index) => {
    this.state.activeSectionIndexes.includes(index)
      ? this.setState({
          activeSectionIndexes: this.state.activeSectionIndexes.filter(item => index !== item)
        })
      : this.setState({
          activeSectionIndexes: [...this.state.activeSectionIndexes, index]
        });
  };

  useSDMXUrlPreset = (url, format) => {
    this.props.onSDMXExampleChosen(url, format);
  };

  render() {
    return (
      <Table style={{ marginBottom: '0' }}>
        <TableHeader>
          <TableHeaderRow>
            <TableHeaderCell />
            {/* <TableHeaderCell>Name</TableHeaderCell> */}
            <TableHeaderCell>Description</TableHeaderCell>
            <TableHeaderCell>Source</TableHeaderCell>
            <TableHeaderCell>Format</TableHeaderCell>
          </TableHeaderRow>
        </TableHeader>
        <TableBody>
          {exampleSDMX.data.map((item, index) => (
            <TableRow key={`tblrow_${index}`}>
              <TableCellStyled>
                <Button
                  extraSmall
                  transparent
                  onClick={() => {
                    this.useSDMXUrlPreset(item.url, item.format);
                  }}>
                  Use
                </Button>
              </TableCellStyled>
              {/* <TableCellStyled>{item.name}</TableCellStyled> */}
              <TableCellStyled>{item.description}</TableCellStyled>
              <TableCellStyled>{item.source}</TableCellStyled>
              <TableCellStyled className="text-center">
                {item.format === 1 ? <Label green>JSON</Label> : <Label blue>XML</Label>}
              </TableCellStyled>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  render__n() {
    return (
      <Panel>
        <CalciteGridColumn column="18">
          <CalciteGridColumn column="4" className="leader-half">
            <CalciteP>SDMX API Query URL</CalciteP>
          </CalciteGridColumn>
          <CalciteGridColumn column="13">
            <TextField name="sdmxDataFlow" value={this.state.sdmxDataflowUrl} fullWidth />
          </CalciteGridColumn>
          <CalciteGridColumn column="17" className="leader-quarter">
            <Accordion
              activeSectionIndexes={this.state.activeSectionIndexes}
              onAccordionChange={this.onAccordionChange}
              fullWidth>
              <AccordionSectionStyled fullWidth>
                <AccordionTitle>Example SDMX Providers</AccordionTitle>
                <AccordionContent>
                  <Table style={{ marginBottom: '0' }}>
                    <TableBody>
                      <TableRow>
                        <TableCellStyled>
                          <Button
                            extraSmall
                            transparent
                            onClick={() => {
                              this.useSDMXUrlPreset('http://unepliveservices.unep.org/nsiws/rest/dataflow/');
                            }}>
                            Use
                          </Button>
                        </TableCellStyled>
                        <TableCellStyled>United Nations Enviornment</TableCellStyled>
                        <TableCellStyled>[description]</TableCellStyled>
                        <TableCellStyled>
                          <Label green>JSON</Label>
                        </TableCellStyled>
                        <TableCellStyled>[source]</TableCellStyled>
                      </TableRow>
                      <TableRow>
                        <TableCellStyled>
                          <Button
                            extraSmall
                            transparent
                            onClick={() => {
                              this.useSDMXUrlPreset('https://stats.pacificdata.org/data-nsi/Rest/dataflow/');
                            }}>
                            Use
                          </Button>
                        </TableCellStyled>
                        <TableCellStyled>Stats Pacific Data</TableCellStyled>
                        <TableCellStyled>[description]</TableCellStyled>
                        <TableCellStyled>
                          <Label blue>XML</Label>
                        </TableCellStyled>
                        <TableCellStyled>[source]</TableCellStyled>
                      </TableRow>
                      <TableRow>
                        <TableCellStyled>
                          <Button
                            extraSmall
                            transparent
                            onClick={() => {
                              this.useSDMXUrlPreset('https://api.data.unicef.org/sdmx/Rest/dataflow/');
                            }}>
                            Use
                          </Button>
                        </TableCellStyled>
                        <TableCellStyled>UNICEF</TableCellStyled>
                        <TableCellStyled>[description]</TableCellStyled>
                        <TableCellStyled>
                          <Label green>JSON</Label>
                        </TableCellStyled>
                        <TableCellStyled>[source]</TableCellStyled>
                      </TableRow>
                    </TableBody>
                  </Table>
                </AccordionContent>
              </AccordionSectionStyled>
            </Accordion>
          </CalciteGridColumn>
        </CalciteGridColumn>
      </Panel>
    );
  }

  render_oldtwo() {
    return (
      <Formik initialValues={this.state.formValues} onSubmit={this.publishLayer} validate={this.validateIt}>
        {({ values, errors, touched, handleSubmit, isSubmitting }) => (
          <Form onSubmit={handleSubmit}>
            <Panel>
              <CalciteGridColumn column="18">
                <FormControl
                  horizontal
                  fullWidth
                  success={touched.state && !errors.state ? true : false}
                  error={touched.state && errors.state ? true : false}>
                  <FormControlLabel style={{ minWidth: '200px' }}>SDMX Data Flow URL</FormControlLabel>
                  <Field component={TextField} name="sdmxDataFlow" fullWidth />
                  <FormHelperText>{(touched.state && errors.state) || null}</FormHelperText>
                  {/* </CalciteGridColumn> */}
                  {/* <CalciteGridColumn column="2" className="margin-left-0 leader-quarter"> */}
                  {/* <Button className="column-4 margin-left-1" onClick={this.showOptions}>
                    Show Options
                  </Button> */}
                  {/* </CalciteGridColumn> */}
                </FormControl>

                <Accordion
                  activeSectionIndexes={this.state.activeSectionIndexes}
                  onAccordionChange={this.onAccordionChange}
                  fullWidth>
                  <AccordionSection fullWidth>
                    <AccordionTitle>Example SDMX Providers</AccordionTitle>
                    <AccordionContent>
                      <CalciteGridContainer>
                        <CalciteGridColumn column="4">
                          <CalciteH6>United Nations Enviornment</CalciteH6>
                        </CalciteGridColumn>
                        <CalciteGridColumn column="4">
                          <Button
                            extraSmall
                            transparent
                            onClick={() => {
                              this.useSDMXUrlPreset(
                                'http://stat.data.abs.gov.au/sdmx-json/dataflow/ABS_ANNUAL_ERP_ASGS2016/'
                              );
                            }}>
                            Use
                          </Button>
                        </CalciteGridColumn>
                      </CalciteGridContainer>
                      <CalciteGridContainer>
                        <CalciteGridColumn column="4">
                          <CalciteH6>Australia Statistics</CalciteH6>
                        </CalciteGridColumn>
                        <CalciteGridColumn column="4">
                          <Button
                            extraSmall
                            transparent
                            onClick={() => {
                              this.useSDMXUrlPreset(
                                'http://stat.data.abs.gov.au/sdmx-json/dataflow/ABS_ANNUAL_ERP_ASGS2016/'
                              );
                            }}>
                            Use
                          </Button>
                        </CalciteGridColumn>
                      </CalciteGridContainer>
                    </AccordionContent>
                  </AccordionSection>
                </Accordion>
              </CalciteGridColumn>
            </Panel>
          </Form>
        )}
      </Formik>
    );
  }

  render_old() {
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
