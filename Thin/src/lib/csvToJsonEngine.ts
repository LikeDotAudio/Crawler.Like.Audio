import * as jsyaml from "js-yaml";
import { json2xml } from "xml-js";
import { errorMessage } from "@/lib/utils";

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

/** One parsed CSV/Excel row: header → cell. */
export type CsvRow = Record<string, unknown>;
/** One generated JSON object. */
type OutNode = Record<string, unknown>;

export interface GenerationResult {
  jsonOutput: Record<string, OutNode[]> | null;
  yamlOutput: string;
  xmlOutput: string;
}

function groupBy(array: CsvRow[], key: string): Record<string, CsvRow[]> {
  return array.reduce((result: Record<string, CsvRow[]>, currentValue: CsvRow) => {
    const val = String(currentValue[key]);
    (result[val] = result[val] || []).push(currentValue);
    return result;
  }, {});
}

function buildHierarchy(
  rows: CsvRow[],
  parentKey: string,
  configs: Record<string, HeaderConfig>,
  headers: string[]
): OutNode[] {
  const levelConfigs = Object.values(configs)
    .filter((c) => c.nestedUnder === parentKey && c.role !== "Skip")
    .sort((a, b) => headers.indexOf(a.originalHeader) - headers.indexOf(b.originalHeader));

  const firstGroupingConfig = levelConfigs.find((c) =>
    ["Hierarchical Key", "Value as Key", "Key Name and Value"].includes(c.role)
  );

  if (!firstGroupingConfig) {
    const outputList: OutNode[] = [];
    const simpleConfigs = levelConfigs.filter((c) => ["Simple Value", "Sub Key"].includes(c.role));

    rows.forEach((row) => {
      const node: OutNode = {};
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
  const outputList: OutNode[] = [];

  Object.entries(grouped).forEach(([keyValue, groupRows]) => {
    const node: OutNode = {};
    let val: string | boolean = keyValue;
    if (val === "true" || val === "True") val = true;
    if (val === "false" || val === "False") val = false;

    if (firstGroupingConfig.role === "Value as Key") {
      const children = buildHierarchy(groupRows, groupKey, configs, headers);
      let mergedChildren = {};
      children.forEach((c) => {
        mergedChildren = { ...mergedChildren, ...c };
      });
      node[String(val)] = mergedChildren;
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
  csvData: CsvRow[],
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
  } catch (yErr) {
    yamlOutput = "# Error generating YAML: " + errorMessage(yErr);
  }

  let xmlOutput = "";
  try {
    xmlOutput = json2xml(JSON.stringify(finalJson), { compact: true, spaces: 4 });
  } catch (xErr) {
    xmlOutput = "<!-- XML Error: Keys cannot contain spaces or invalid characters -->\n" + errorMessage(xErr);
  }

  return {
    jsonOutput: finalJson,
    yamlOutput,
    xmlOutput,
  };
}
