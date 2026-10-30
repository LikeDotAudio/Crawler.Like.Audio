import Papa from "papaparse";
import * as jsyaml from "js-yaml";
import { json2xml } from "xml-js";

/** One flat output row: dotted key path → leaf value. */
export type Row = Record<string, unknown>;

const isPlainObject = (v: unknown): v is Row => typeof v === "object" && v !== null && !Array.isArray(v);

export interface ConversionOutputs {
  processedData: Row[];
  csvOutput: string;
  yamlOutput: string;
  xmlOutput: string;
  jsonOutput: string;
}

const flattenObject = (obj: unknown, prefix = ""): Row => {
  const rec = Object(obj) as Row; // primitives box to wrappers, as Object.keys would treat them
  return Object.keys(rec).reduce((acc: Row, k: string) => {
    const pre = prefix.length ? prefix + "." : "";
    const v = rec[k];
    if (isPlainObject(v)) {
      Object.assign(acc, flattenObject(v, pre + k));
    } else {
      acc[pre + k] = v;
    }
    return acc;
  }, {});
};

export const processJson = (data: unknown, flattenArrays: boolean): Row[] => {
  if (!data) return [];
  
  let arr: unknown[] = Array.isArray(data) ? data : [data];

  // Attempt to drill down if the root is an object containing a single array
  if (isPlainObject(data)) {
    const keys = Object.keys(data);
    const only = data[keys[0]];
    if (keys.length === 1 && Array.isArray(only)) {
      arr = only;
    }
  }

  if (flattenArrays) {
    // Create repeating rows for nested arrays
    const result: Row[] = [];
    const traverse = (currentObj: unknown, baseRow: Row = {}) => {
      const rec = Object(currentObj) as Row;
      const row: Row = { ...baseRow };
      let hasArray = false;
      let arrayKey = "";
      let arrayItems: unknown[] = [];

      for (const key in rec) {
        const v = rec[key];
        if (Array.isArray(v)) {
          hasArray = true;
          arrayKey = key;
          arrayItems = v;
          break; // Just handle one array per level for simplicity in repeating rows
        } else {
          row[key] = v;
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

export const generateConversions = (jsonData: unknown, flattenArrays: boolean): ConversionOutputs => {
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
