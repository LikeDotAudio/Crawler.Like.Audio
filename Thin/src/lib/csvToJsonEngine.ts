import * as jsyaml from "js-yaml";
import { json2xml } from "xml-js";

export type Role =
  | "Hierarchical Key"
  | "Sub Key"
  | "Simple Value"
  | "Value as Key"
  | "Key Name and Value"
  | "Skip";

export interface HeaderConfig {
  originalHeader: string;
  jsonKey: string;
  role: Role;
  nestedUnder: string;
  partName: string;
}

export interface GenerationResult {
  jsonOutput: any;
  yamlOutput: string;
  xmlOutput: string;
}

function groupBy(array: any[], key: string) {
  return array.reduce((result: any, currentValue: any) => {
    const val = currentValue[key];
    (result[val] = result[val] || []).push(currentValue);
    return result;
  }, {});
}

function buildHierarchy(
  rows: any[],
  parentKey: string,
  configs: Record<string, HeaderConfig>,
  headers: string[]
): any[] {
  const levelConfigs = Object.values(configs)
    .filter((c) => c.nestedUnder === parentKey && c.role !== "Skip")
    .sort((a, b) => headers.indexOf(a.originalHeader) - headers.indexOf(b.originalHeader));

  const firstGroupingConfig = levelConfigs.find((c) =>
    ["Hierarchical Key", "Value as Key", "Key Name and Value"].includes(c.role)
  );

  if (!firstGroupingConfig) {
    const outputList: any[] = [];
    const simpleConfigs = levelConfigs.filter((c) => ["Simple Value", "Sub Key"].includes(c.role));

    rows.forEach((row) => {
      const node: any = {};
      simpleConfigs.forEach((c) => {
        if (c.role === "Skip") return;
        let val = row[c.originalHeader];
        if (val !== undefined && val !== "") {
          if (val === "true" || val === "True") val = true;
          if (val === "false" || val === "False") val = false;
          node[c.jsonKey] = val;
        }
      });
      if (Object.keys(node).length > 0) {
        outputList.push(node);
      }
    });
    return outputList;
  }

  const groupKey = firstGroupingConfig.originalHeader;
  const grouped = groupBy(rows, groupKey);
  const outputList: any[] = [];

  Object.entries(grouped).forEach(([keyValue, groupRows]: [string, any]) => {
    const node: any = {};
    let val: any = keyValue;
    if (val === "true" || val === "True") val = true;
    if (val === "false" || val === "False") val = false;

    if (firstGroupingConfig.role === "Value as Key") {
      const children = buildHierarchy(groupRows, groupKey, configs, headers);
      let mergedChildren = {};
      children.forEach((c) => {
        mergedChildren = { ...mergedChildren, ...c };
      });
      node[val as string] = mergedChildren;
    } else if (firstGroupingConfig.role === "Hierarchical Key") {
      node[firstGroupingConfig.jsonKey] = val;
      node[firstGroupingConfig.partName] = buildHierarchy(groupRows, groupKey, configs, headers);
    } else if (firstGroupingConfig.role === "Key Name and Value") {
      node[firstGroupingConfig.jsonKey] = {
        [firstGroupingConfig.partName]: val,
        parts: buildHierarchy(groupRows, groupKey, configs, headers),
      };
    }
    outputList.push(node);
  });

  return outputList;
}

export function generateOutputs(
  csvData: any[],
  configs: Record<string, HeaderConfig>,
  rootKeyName: string,
  headers: string[]
): GenerationResult {
  if (!csvData || !csvData.length) {
    return { jsonOutput: null, yamlOutput: "", xmlOutput: "" };
  }

  const finalJson = {
    [rootKeyName]: buildHierarchy(csvData, "root", configs, headers),
  };

  let yamlOutput = "";
  try {
    yamlOutput = jsyaml.dump(finalJson);
  } catch (yErr: any) {
    yamlOutput = "# Error generating YAML: " + yErr.message;
  }

  let xmlOutput = "";
  try {
    xmlOutput = json2xml(JSON.stringify(finalJson), { compact: true, spaces: 4 });
  } catch (xErr: any) {
    xmlOutput = "<!-- XML Error: Keys cannot contain spaces or invalid characters -->\n" + xErr.message;
  }

  return {
    jsonOutput: finalJson,
    yamlOutput,
    xmlOutput,
  };
}
