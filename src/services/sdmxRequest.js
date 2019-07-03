import moment from 'moment';
import storage from 'azure-storage';
import request from 'request';
import { request as agoRequest } from '@esri/arcgis-rest-request';
import { createItem } from '@esri/arcgis-rest-items';
import { searchItems } from '@esri/arcgis-rest-portal';
import rp from 'request-promise';
import xmlParser from 'fast-xml-parser';

const SDMX_ACCEPT_HEADER = 'application/vnd.sdmx.data+json;version=1.0.0-wd';
const AZURE_BLOB_HOST = 'https://sdmxstorage.blob.core.windows.net';
const AZURE_SAS_TOKEN =
  '?sv=2018-03-28&ss=b&srt=sco&sp=rwdlac&se=2019-06-21T04:06:02Z&st=2019-06-20T20:06:02Z&sip=65.28.47.118&spr=https&sig=RHYOHGMf1xNJcFY5WIBmvajNuDZUAC7N%2B%2Fc8XOnXZaI%3D';
// KEEP FOR USE IN SDMX URL BUILDER
// TODO :: clean up
export function getSDMXDataFlowsFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = event => {
      const json = JSON.parse(event.target.result);
      if (!json.data || !json.data.dataflows || json.data.dataflows.length === 0) {
        reject('no data flows found');
        return;
      }
      const dataFlows = json.data.dataflows.map(df => {
        return { id: df.id, label: df.name.en };
      });
      resolve(dataFlows);
    };
    reader.onerror = error => {
      reject(error);
    };
    reader.readAsText(file);
  });
}

/**
 * Create features in geojson format from SDMX formatted response
 * @param observations The actual data values for the observations
 * @param dimensionProps Dimension properties
 * @param attributeProps Attribute properties
 */
function createFeatures(observations, dimensionProps, attributeProps) {
  let features = [];
  let idCounter = 1;
  for (const obs in observations) {
    let feature = { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [] } };

    const dimSplits = obs.split(':');
    const attributes = observations[obs];

    for (var i = 0; i < dimSplits.length; i++) {
      const currentKeyInt = parseInt(dimSplits[i]);
      const foundDim = dimensionProps.filter(dim => dim.keyPosition === i)[0];
      if (foundDim) {
        if (foundDim.id === 'TIME_PERIOD') {
          const tv = moment(foundDim.values[currentKeyInt].name.en, 'YYYY-MM');
          // feature.properties[`${foundDim.id}_CODE`] = foundDim.values[currentKeyInt].id;
          feature.properties[`${foundDim.id}_CODE`] = tv.format('YYYY-MM').toString();
          feature.properties[foundDim.name.en.toUpperCase().replace(' ', '_')] = tv.format('YYYY-MM').toString();
        } else {
          feature.properties[`${foundDim.id}_CODE`] = foundDim.values[currentKeyInt].id;
          feature.properties[foundDim.name.en.toUpperCase().replace(' ', '_')] = foundDim.values[currentKeyInt].name.en;
        }
      }
    }

    const obsValue = attributes[0];
    feature.properties['OBS_VALUE'] = obsValue;

    attributes.shift();

    for (var j = 0; j < attributes.length; j++) {
      const attValue = attributes[j];
      const foundAtt = attributeProps[j];
      if (attValue === null) {
        feature.properties[`${foundAtt.id}_CODE`] = null;
        feature.properties[foundAtt.name.en.toUpperCase().replace(' ', '_')] = null;
      } else {
        feature.properties[`${foundAtt.id}_CODE`] = foundAtt.values[attValue].id;
        feature.properties[foundAtt.name.en.toUpperCase().replace(' ', '_')] = foundAtt.values[attValue].name.en;
      }
    }

    feature.properties['counterField'] = idCounter++;

    features.push(feature);
  }

  return features;
}

/**
 * Helper to parse fields from SDMX formatted response
 * @param dimensionProps Dimension properties
 * @param attributeProps Attribute properties
 */
function parseFieldsAndLookups(dimensionProps, attributeProps) {
  let fields = [];

  dimensionProps.forEach(obs => {
    fields.push({
      name: `${obs.id}_CODE`,
      alias: `${obs.id}_CODE`,
      type: 'String'
    });

    if (!obs.name.en) {
      obs.name = { en: obs.name };
    }
    fields.push({
      name: obs.name.en.toUpperCase().replace(' ', '_'),
      alias: obs.name.en,
      type: 'String'
    });
  });

  attributeProps.forEach(obs => {
    fields.push({
      name: `${obs.id}_CODE`,
      alias: `${obs.id}_CODE`,
      type: 'String'
    });

    if (!obs.name.en) {
      obs.name = { en: obs.name };
    }

    fields.push({
      name: obs.name.en.toUpperCase().replace(' ', '_'),
      alias: obs.name.en,
      type: 'String'
    });
  });

  return fields;
}

/**
 * Create a Feature Collection from an SDMX formatted response
 * @param json SDMX-formatted response in JSON format
 */
function createFeatureCollection(json) {
  let fc = {
    type: 'FeatureCollection',
    features: []
  };

  fc.metadata = {
    name: 'from sdmx',
    idField: 'counterField',
    fields: [
      {
        name: 'counterField',
        alias: 'counterField',
        type: 'Integer'
      }
    ]
  };

  const dimensionProps = json.data.structure.dimensions.observation;
  const attributeProps = json.data.structure.attributes.observation;
  let fields = parseFieldsAndLookups(dimensionProps, attributeProps);
  fields.push({
    name: 'OBS_VALUE',
    alias: 'Observation Value',
    type: 'Double'
  });

  fc.metadata.fields = fc.metadata.fields.concat(fields);

  const observations = json.data.dataSets[0].observations;

  const features = createFeatures(observations, dimensionProps, attributeProps);
  fc.features = features;

  const layerName = json.data.structure.name.en;

  fc.metadata.name = layerName;

  return fc;
}

/**
 * Load SDMX from a local file
 * @param file
 */
export async function parseSDMXDataFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = event => {
      const json = JSON.parse(event.target.result);
      if (isSDMXValid(json)) {
        const dimensionProps = json.data.structure.dimensions.observation;
        const attributeProps = json.data.structure.attributes.observation;
        const fields = parseFieldsAndLookups(dimensionProps, attributeProps).map(field => field.name);
        const count = Object.keys(json.data.dataSets[0].observations).length;
        resolve({ sdmxDataFile: json, isValid: true, count: count, sdmxFields: fields });
      } else {
        reject({ isValid: false, count: null, message: 'unable to parse SDMX File' });
      }
    };
    reader.onerror = error => {
      reject({ isValid: false, count: null, message: error });
    };
    reader.readAsText(file);
  });
}

function isSDMXValid(json) {
  return (
    json.data.structure.dimensions.observation &&
    json.data.structure.attributes.observation &&
    json.data.dataSets[0].observations
  );
}

/**
 * Load SDMX from an SDMX API URL endpoint
 * @param url
 */
export async function loadSDMXFromAPI(url, returnJson) {
  let options = {
    url: url
  };

  if (returnJson) {
    options.json = true;
    options.headers = { accept: SDMX_ACCEPT_HEADER };
  }

  return rp(options)
    .then(response => {
      if (returnJson) {
        if (!response.data) {
          response = { data: response };
        }
        if (isSDMXValid(response)) {
          const dimensionProps = response.data.structure.dimensions.observation;
          const attributeProps = response.data.structure.attributes.observation;
          const fields = parseFieldsAndLookups(dimensionProps, attributeProps).map(field => field.name);
          const count = Object.keys(response.data.dataSets[0].observations).length;

          return { isValid: true, count: count, sdmxFields: fields };
        } else {
          return { isValid: false, count: 0 };
        }
      } else {
        const validXml = xmlParser.validate(response);
        if (validXml !== true) {
          console.log(validXml.err);
          return { isValid: false, count: 0 };
        }

        const parsedXml = xmlParser.parse(response, {
          ignoreAttributes: false,
          ignoreNameSpace: true
        });

        // continue processing parsed XML data here:::
        const count = parsedXml.GenericData.DataSet.Obs.length;
        const idKeys = parsedXml.GenericData.DataSet.Obs[0].ObsKey.Value.map(rec => rec['@_id']);
        const fields = [...idKeys, ...parsedXml.GenericData.DataSet.Obs[0].Attributes.Value.map(rec => rec['@_id'])];
        return { isValid: true, count: count, sdmxFields: fields };
      }
    })
    .catch(err => {
      return err;
    });
}

/**
 * Load & Parse GeoJSON from a local file
 * @param file
 */
export async function parseGeoJsonGeoFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = event => {
      const json = JSON.parse(event.target.result);
      resolve({ geoJsonData: json });
    };
    reader.onerror = error => {
      reject(error);
    };
    reader.readAsText(file);
  });
}

/**
 * Load Fields from a feature service
 * @param url URL to the feature service
 * @param params Parameters for the GET request
 */
export async function loadFeatureServiceFields(url, params) {
  return agoRequest(url, params);
}

/**
 * Query a Feature Service for GeoJSON based on Unique Values from the SDMX source
 * @param url URL to the feature service
 * @param where Where clause including the unique values (ex: ISO IN ('AF', 'IR', 'IN'))
 * @param token Valid AGO Token
 */
export async function getGeoJsonByUniqueFieldValues(url, where, token) {
  return agoRequest(`${url}/query`, {
    httpMethod: 'GET',
    params: {
      f: 'geojson',
      outFields: '*',
      outSR: 4326,
      returnGeometry: true,
      token: token,
      where: where
    }
  });
}

export async function featureServiceToAzureBlob(url, token) {
  const queryResponse = await agoRequest(`${url}/query`, {
    httpMethod: 'GET',
    params: {
      f: 'geojson',
      outFields: '*',
      outSR: 4326,
      returnGeometry: true,
      token: token,
      where: '1=1'
    }
  });

  debugger;
  // STILL TOO SLOW - TRY STREAM METHOD

  const uploadResponse = await uploadJSONToAzureBlob(queryResponse);
  return uploadResponse;
}

// export async function streamJSONToAzureBlob(json) {
//   const containerName = 'fromsdmxwebapp';
//   const blobName = `json_from_sdmx_app_${new Date().getTime()}.json`;
//   const text = JSON.stringify(json);

//   const blobService = storage.createBlobServiceWithSas(AZURE_BLOB_HOST, AZURE_SAS_TOKEN);

//   return new Promise((resolve, reject) => {
//     // blobService.createBlockBlobFromText(containerName, blobName, text, err => {
//     blobService.createWriteStreamToBlockBlob(containerName, blobName, stream, err => {
//       if (err) {
//         reject(err);
//       } else {
//         const blobUrl = blobService.getUrl(containerName, blobName);
//         resolve({ blobUrl: blobUrl });
//       }
//     });
//   });
// }

/**
 * Upload GeoJSON to Azure blob storate
 * @param json @object json object data
 * @returns Direct URL to uploaded geojson in Azure blob
 */
export async function uploadJSONToAzureBlob(json) {
  const containerName = 'fromsdmxwebapp';
  const blobName = `json_from_sdmx_app_${new Date().getTime()}.json`;
  const text = JSON.stringify(json);

  const blobService = storage.createBlobServiceWithSas(AZURE_BLOB_HOST, AZURE_SAS_TOKEN);

  return new Promise((resolve, reject) => {
    blobService.createBlockBlobFromText(containerName, blobName, text, err => {
      if (err) {
        reject(err);
      } else {
        const blobUrl = blobService.getUrl(containerName, blobName);
        resolve({ blobUrl: blobUrl });
      }
    });
  });
}

export function joinSDMXtoGeoJson(geojson, fc, gjField, pGeoJson, sdmxField, pSDMX) {
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
}

/**
 * Create Item in ArcGIS Online from a hosted GeoJSON file via a URL
 * @param urlToGeoJson URL to the geojson file
 * @param name name of the GeoJSON item
 * @param auth authentication object
 * @returns ItemId of newly created GeoJSON item
 */
export async function createGeoJsonInArcGISOnline2(urlToGeoJson, name, auth) {
  const item = {
    title: name,
    type: 'GeoJson'
  };

  const params = {
    dataUrl: urlToGeoJson,
    // overwrite: true,
    async: true
  };

  return createItem({
    item,
    params,
    authentication: auth
  });
}

export async function createGeoJsonInArcGISOnline(url, name, geojson, token) {
  const formData = {
    itemType: 'file',
    type: 'GeoJson',
    title: name,
    file: JSON.stringify(geojson),
    token: token
  };
  return request.post(url, { formData: formData }, function optionalCallback(err, httpResponse, body) {
    debugger;
    if (err) {
      return console.error('upload failed:', err);
    }
    console.log('Upload successful!  Server responded with:', body);
  });
}

/**
 * Check Item Status in ArcGIS Online
 * @param itemId ArcGIS Online ItemId of the item to publish
 * @param token ArcGIS Online token for the status requeset
 * @returns Promise for Item Status check
 */
export async function publishItemAsLayer(itemId, url, token, sdmxName) {
  return agoRequest(url, {
    httpMethod: 'POST',
    params: {
      itemId: itemId,
      f: 'json',
      token: token,
      filetype: 'geojson',
      overwrite: false,
      publishParameters: {
        hasStaticData: true,
        name: sdmxName,
        maxRecordCount: 10000,
        layerInfo: {
          capabilities: 'Query'
        }
      }
    }
  });
}

/**
 * Check Item Status in ArcGIS Online
 * @param urlToGeoJson URL to the geojson file
 * @param token ArcGIS Online token for the status requeset
 * @returns Promise for Item Status check
 */
export async function checkItemStatus(inUrl, token) {
  return agoRequest(inUrl, {
    httpMethod: 'GET',
    params: {
      f: 'json',
      token: token
    }
  });
}

/**
 * Query a Feature Service for GeoJSON based on Unique Values from the SDMX source
 * @param url URL to the feature service
 * @param where Where clause including the unique values (ex: ISO IN ('AF', 'IR', 'IN'))
 * @param token Valid AGO Token
 */
export async function queryForSDMXItems(user, orgId, token) {
  // const orgId = auth.portal;
  // const query = new SearchQueryBuilder()
  //   .match(user)
  //   .in('owner')
  //   .and()
  //   .match(orgId)
  //   .in('orgid')
  //   .and()
  //   .match('SDMX')
  //   .in('typekeywords');

  const query = `owner:"${user}" orgid:${orgId} typekeywords:"SDMX"`;

  // return searchItems(query);

  return agoRequest('https://www.arcgis.com/sharing/rest/search', {
    httpMethod: 'GET',
    params: {
      f: 'json',
      q: query,
      num: 10000,
      token: token
    }
  });
}
