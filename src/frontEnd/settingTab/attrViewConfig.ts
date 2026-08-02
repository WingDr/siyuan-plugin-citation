export const ATTR_VIEW_CONFIG_VERSION = 1;

export type AttrViewFillMode =
  | ""
  | "firstAuthor"
  | "lastAuthor"
  | "journal"
  | "date"
  | "zoteroUrl"
  | "url"
  | "custom";

export interface AttrViewColumnConfig {
  keyID: string;
  name: string;
  type: string;
  mode: AttrViewFillMode;
  customValue: string;
}

export interface AttrViewColumnDefinition {
  id: string;
  name: string;
  type: string;
}

export const attrViewFillOptionDefs: {
  key: AttrViewFillMode;
  types: string[];
}[] = [
  { key: "", types: ["*"] },
  { key: "firstAuthor", types: ["select", "mSelect"] },
  { key: "lastAuthor", types: ["select", "mSelect"] },
  { key: "journal", types: ["select", "mSelect"] },
  { key: "date", types: ["date"] },
  { key: "zoteroUrl", types: ["url"] },
  { key: "url", types: ["url"] },
  { key: "custom", types: ["*"] },
];

export function getFillModeKeysForType(colType: string): AttrViewFillMode[] {
  return attrViewFillOptionDefs
    .filter((def) => def.types.includes("*") || def.types.includes(colType))
    .map((def) => def.key);
}

export function isModeAllowedForType(mode: string, colType: string): mode is AttrViewFillMode {
  if (!mode || mode === "custom") return true;
  const normalizedMode = mode === "correspondingAuthor" ? "lastAuthor" : mode;
  const def = attrViewFillOptionDefs.find((item) => item.key === normalizedMode);
  return !!def && (def.types.includes("*") || def.types.includes(colType));
}

export function matchBuiltinModeByName(name: string): AttrViewFillMode {
  const map: Record<string, AttrViewFillMode> = {
    "第一作者": "firstAuthor",
    "first author": "firstAuthor",
    "末位作者": "lastAuthor",
    "last author": "lastAuthor",
    "发表期刊": "journal",
    "期刊": "journal",
    "journal": "journal",
    "发表日期": "date",
    "出版日期": "date",
    "publication date": "date",
    "zotero url": "zoteroUrl",
    "zotero_url": "zoteroUrl",
    "zoterourl": "zoteroUrl",
    "url": "url",
    "链接": "url",
    "网址": "url",
  };
  return map[name.trim().toLowerCase()] ?? "";
}

function selectLikeValue(contentTemplate: string): string {
  return `{"mSelect":{{ JSON.stringify((${contentTemplate}) ? [{"content":(${contentTemplate})}] : []) }}}`;
}

export function getBuiltinValueSnippet(mode: AttrViewFillMode): string {
  switch (mode) {
    case "firstAuthor":
      return selectLikeValue("firstAuthor");
    case "lastAuthor":
      return selectLikeValue("lastAuthor");
    case "journal":
      return selectLikeValue("containerTitle");
    case "date":
      return `{"date":{"content":{{ issuedDate || 0 }},"isNotEmpty":{{ issuedDate ? "true" : "false" }},"isNotTime":true}}`;
    case "zoteroUrl":
      return `{"url":{"content":{{ JSON.stringify(zoteroSelectURI || "") }}}}`;
    case "url":
      return `{"url":{"content":{{ JSON.stringify(DOI ? "https://doi.org/" + DOI : (URL || "")) }}}}`;
    default:
      return "";
  }
}

export function buildAttrViewTemplate(configs: AttrViewColumnConfig[]): string {
  const entries = configs
    .filter((config) => config.mode && (config.mode !== "custom" || config.customValue.trim()))
    .map((config) => {
      const valueSnippet = config.mode === "custom"
        ? config.customValue.trim()
        : getBuiltinValueSnippet(config.mode);
      if (!valueSnippet) return null;
      return `  {\n    "keyID": ${JSON.stringify(config.keyID)},\n    "value": ${valueSnippet}\n  }`;
    })
    .filter((entry): entry is string => !!entry);
  return entries.length ? `[\n${entries.join(",\n")}\n]` : "";
}

export type AttrViewLoadState = "idle" | "loading" | "ready" | "error" | "cleared";

export interface AttrViewPersistedData {
  block: string;
  template: string;
  configs: AttrViewColumnConfig[];
  version: number;
}

export function selectAttrViewDataForSave(
  loadState: AttrViewLoadState,
  draftBlock: string,
  loadedBlock: string,
  configs: AttrViewColumnConfig[],
  original: AttrViewPersistedData,
): AttrViewPersistedData {
  if (loadState === "cleared") {
    return { block: "", template: "", configs: [], version: ATTR_VIEW_CONFIG_VERSION };
  }
  if (loadState === "ready" && draftBlock === loadedBlock) {
    const clonedConfigs = configs.map((config) => ({ ...config }));
    return {
      block: loadedBlock,
      template: buildAttrViewTemplate(clonedConfigs),
      configs: clonedConfigs,
      version: ATTR_VIEW_CONFIG_VERSION,
    };
  }
  return {
    ...original,
    configs: original.configs.map((config) => ({ ...config })),
  };
}

function findBalancedObjectEnd(source: string, start: number): number {
  if (source[start] !== "{") return -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < source.length; i++) {
    const char = source[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{" && source[i + 1] === "{") {
      const templateEnd = source.indexOf("}}", i + 2);
      if (templateEnd === -1) return -1;
      i = templateEnd + 1;
      continue;
    }
    if (char === "{") depth++;
    else if (char === "}") {
      depth--;
      if (depth === 0) return i + 1;
      if (depth < 0) return -1;
    }
  }
  return -1;
}

export interface ParsedAttrViewTemplate {
  values: Record<string, string>;
  valid: boolean;
}

export function parseAttrViewTemplate(templateStr: string): ParsedAttrViewTemplate {
  const values: Record<string, string> = {};
  const source = templateStr.trim();
  if (!source) return { values, valid: true };
  if (!source.startsWith("[") || !source.endsWith("]")) return { values, valid: false };

  let cursor = 1;
  const contentEnd = source.length - 1;
  while (cursor < contentEnd) {
    while (cursor < contentEnd && /[\s,]/.test(source[cursor])) cursor++;
    if (cursor >= contentEnd) break;
    if (source[cursor] !== "{") return { values, valid: false };

    const objectEnd = findBalancedObjectEnd(source, cursor);
    if (objectEnd === -1 || objectEnd > contentEnd) return { values, valid: false };
    const objectSource = source.slice(cursor, objectEnd);
    const keyMatch = objectSource.match(/"keyID"\s*:\s*"([^"\\]+)"/);
    const valueMatch = /"value"\s*:/.exec(objectSource);
    if (!keyMatch || !valueMatch) return { values, valid: false };

    let valueStart = valueMatch.index + valueMatch[0].length;
    while (/\s/.test(objectSource[valueStart] ?? "")) valueStart++;
    const valueEnd = findBalancedObjectEnd(objectSource, valueStart);
    if (valueEnd === -1) return { values, valid: false };
    const trailing = objectSource.slice(valueEnd, objectSource.length - 1).trim();
    if (trailing) return { values, valid: false };

    values[keyMatch[1]] = objectSource.slice(valueStart, valueEnd);
    cursor = objectEnd;
  }
  return { values, valid: true };
}

export interface ReconciledAttrViewConfig {
  configs: AttrViewColumnConfig[];
  status: "structured" | "migrated" | "new" | "error";
}

export function reconcileAttrViewColumns(
  columns: AttrViewColumnDefinition[],
  savedConfigs: AttrViewColumnConfig[],
  legacyTemplate: string,
  configVersion: number,
): ReconciledAttrViewConfig {
  // PR #151 的早期测试版本已经写入 configs，但还没有版本字段，兼容这一状态。
  const hasStructuredConfig =
    configVersion >= ATTR_VIEW_CONFIG_VERSION || savedConfigs.length > 0;
  const legacy = parseAttrViewTemplate(legacyTemplate);
  if (!hasStructuredConfig && legacyTemplate.trim() && !legacy.valid) {
    return { configs: savedConfigs.map((item) => ({ ...item })), status: "error" };
  }

  const savedByKey = new Map(savedConfigs.map((item) => [item.keyID, item]));
  const useDefaults = !hasStructuredConfig && !legacyTemplate.trim();
  const configs = columns.map((column) => {
    const saved = savedByKey.get(column.id);
    const migratedValue = legacy.values[column.id];
    let mode: string = hasStructuredConfig ? (saved?.mode ?? "") : "";
    let customValue = hasStructuredConfig ? (saved?.customValue ?? "") : "";

    if (!hasStructuredConfig && migratedValue !== undefined) {
      mode = "custom";
      customValue = migratedValue;
    } else if (useDefaults) {
      mode = matchBuiltinModeByName(column.name);
    }
    if (mode === "correspondingAuthor") mode = "lastAuthor";
    if (!isModeAllowedForType(mode, column.type)) {
      mode = "";
      customValue = "";
    }

    return {
      keyID: column.id,
      name: column.name,
      type: column.type,
      mode: mode as AttrViewFillMode,
      customValue,
    };
  });

  return {
    configs,
    status: hasStructuredConfig ? "structured" : legacyTemplate.trim() ? "migrated" : "new",
  };
}
