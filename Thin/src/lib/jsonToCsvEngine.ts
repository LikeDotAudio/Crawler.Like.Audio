import Papa from "papaparse";
import * as jsyaml from "js-yaml";
import { json2xml } from "xml-js";

export interface ConversionOutputs {
  processedData: any[];
  csvOutput: string;
  yamlOutput: string;
  xmlOutput: string;
  jsonOutput: string;
}

const flattenObject = (obj: any, prefix = ""): any => {
  return Object.keys(obj).reduce((acc: any, k: string) => {
    const pre = prefix.length ? prefix + "." : "";
    if (typeof obj[k] === "object" && obj[k] !== null && !Array.isArray(obj[k])) {
      Object.assign(acc, flattenObject(obj[k], pre + k));
    } else {
      acc[pre + k] = obj[k];
    }
    return acc;
  }, {});
};

export const processJson = (data: any, flattenArrays: boolean): any[] => {
  if (!data) return [];
  
  let arr = Array.isArray(data) ? data : [data];

  // Attempt to drill down if the root is an object containing a single array
  if (!Array.isArray(data) && typeof data === 'object' && data !== null) {
    const keys = Object.keys(data);
    if (keys.length === 1 && Array.isArray(data[keys[0]])) {
      arr = data[keys[0]];
    }
  }

  if (flattenArrays) {
    // Create repeating rows for nested arrays
    const result: any[] = [];
    const traverse = (currentObj: any, baseRow: any = {}) => {
      const row = { ...baseRow };
      let hasArray = false;
      let arrayKey = "";
      let arrayItems: any[] = [];

      for (const key in currentObj) {
        if (Array.isArray(currentObj[key])) {
          hasArray = true;
          arrayKey = key;
          arrayItems = currentObj[key];
          break; // Just handle one array per level for simplicity in repeating rows
        } else {
          row[key] = currentObj[key];
        }
      }

      if (hasArray) {
        arrayItems.forEach((item) => {
          const nestedBase = { ...row };
          if (typeof item === 'object' && item !== null) {
             traverse(item, nestedBase);
          } else {
             nestedBase[arrayKey] = item;
             result.push(flattenObject(nestedBase));
          }
        });
      } else {
        result.push(flattenObject(row));
      }
    };

    arr.forEach((item) => traverse(item));
    return result;
  } else {
    // Just flatten objects, leave arrays stringified
    return arr.map((item) => flattenObject(item));
  }
};

export const generateConversions = (jsonData: any, flattenArrays: boolean): ConversionOutputs => {
  const processedData = processJson(jsonData, flattenArrays);
  const csvOutput = Papa.unparse(processedData);
  const yamlOutput = jsyaml.dump(jsonData);
  const xmlOutput = json2xml(JSON.stringify(jsonData), { compact: true, spaces: 4 });
  const jsonOutput = JSON.stringify(jsonData, null, 2);

  return {
    processedData,
    csvOutput,
    yamlOutput,
    xmlOutput,
    jsonOutput
  };
};
