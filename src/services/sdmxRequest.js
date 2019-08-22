import { request as agoRequest } from '@esri/arcgis-rest-request';
import rp from 'request-promise';
import Papa from 'papaparse';

const SDMX_ACCEPT_HEADER = 'application/vnd.sdmx.data+json;version=1.0.0-wd';

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
 * Load SDMX from a local file
 * @param file
 * @param isCsv
 */
export async function parseSDMXDataFile(file, isCsv) {
  return new Promise((resolve, reject) => {
    if (isCsv) {
      Papa.parse(file, {
        header: true,
        complete: (results, file) => {
          console.log('Parsing complete:', results, file);
          const fields = Object.keys(results.data[0]).map(field => field);
          resolve({ sdmxDataFile: results, isValid: true, count: results.data.length, sdmxFields: fields });
        },
        error: error => {
          reject({ isValid: false, count: null, message: error });
        }
      });
    } else {
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
    }
  });
}

function isSDMXValid(json) {
  return (
    json.data.structure.dimensions.observation &&
    json.data.structure.attributes.observation &&
    (json.data.dataSets[0].observations || json.data.dataSets[0].series)
  );
}

/**
 * Load SDMX from an SDMX API URL endpoint
 * @param url
 */
export async function loadSDMXFromAPI(url) {
  let options = {
    url: url,
    json: true,
    headers: { Accept: SDMX_ACCEPT_HEADER }
  };

  return rp(options)
    .then(response => {
      if (!response.data) {
        response = { data: response };
      }
      if (isSDMXValid(response)) {
        const dimensionProps = response.data.structure.dimensions.observation;
        const attributeProps = response.data.structure.attributes.observation;
        const fields = parseFieldsAndLookups(dimensionProps, attributeProps).map(field => field.name);
        const obs = response.data.dataSets[0].observations || response.data.dataSets[0].series;
        const count = Object.keys(obs).length;

        return { isValid: true, count: count, sdmxFields: fields };
      } else {
        return { isValid: false, count: 0 };
      }

      // TODO :: figure out a way to handle XML being returned even if JSON is specified in request

      // const validXml = xmlParser.validate(response);
      // if (validXml !== true) {
      //   console.log(validXml.err);
      //   return { isValid: false, count: 0 };
      // }

      // const parsedXml = xmlParser.parse(response, {
      //   ignoreAttributes: false,
      //   ignoreNameSpace: true
      // });

      // // continue processing parsed XML data here:::
      // const count = parsedXml.GenericData.DataSet.Obs.length;
      // const idKeys = parsedXml.GenericData.DataSet.Obs[0].ObsKey.Value.map(rec => rec['@_id']);
      // const fields = [...idKeys, ...parsedXml.GenericData.DataSet.Obs[0].Attributes.Value.map(rec => rec['@_id'])];
      // return { isValid: true, count: count, sdmxFields: fields };
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
export async function queryForSDMXItems(user, orgId, token) {
  const query = `owner:"${user}" orgid:${orgId} typekeywords:"SDMX"`;
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
