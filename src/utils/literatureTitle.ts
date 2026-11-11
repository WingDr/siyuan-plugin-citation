import { generateFromTemplate } from "./templates";

const DISALLOWED_FILENAME_CHARACTERS_RE = /[\/]/g;

/** 可用于标题模板的数据库列类型。 */
export const TITLE_COLUMN_TYPES = new Set(["text", "number", "select", "mSelect"]);

interface TitleColumnDefinition {
  keyID: string;
  name: string;
  type: string;
}

export interface TitleColumnRename {
  from: string;
  to: string;
}

export interface TitleColumnReference {
  keyID: string;
  name?: string;
}

function collapseCellText(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

/**
 * 读取思源数据库某一行、某一列的文本值。
 *
 * @param av getAttributeView 返回的 av 对象
 * @param itemID 数据库行 ID（不是文档块 ID）
 * @param keyID 列 ID
 * @returns 可读文本；缺列、缺行或空值返回空字符串
 */
export function readAttrViewCell(av: any, itemID: string, keyID: string): string {
  const keyValues = Array.isArray(av?.keyValues) ? av.keyValues : [];
  const keyValue = keyValues.find((item: any) => item?.key?.id === keyID);
  if (!keyValue) return "";

  const values = Array.isArray(keyValue.values) ? keyValue.values : [];
  const value = values.find((item: any) => item?.blockID === itemID);
  if (!value) return "";

  switch (value.type) {
    case "text":
      return collapseCellText(value.text?.content);
    case "number":
      return value.number?.isNotEmpty ? String(value.number.content ?? "") : "";
    case "select":
    case "mSelect":
      return (Array.isArray(value.mSelect) ? value.mSelect : [])
        .map((option: any) => collapseCellText(option?.content))
        .filter(Boolean)
        .join(", ");
    default:
      return "";
  }
}

/**
 * 提取数据库中可用于标题的列定义。
 *
 * @param av getAttributeView 返回的 av 对象
 * @returns 仅包含文本、数字、单选和多选列
 */
function getTitleColumnDefinitions(av: any): TitleColumnDefinition[] {
  const keyValues: any[] = Array.isArray(av?.keyValues) ? av.keyValues : [];
  return keyValues
    .map((item: any) => ({
      keyID: String(item?.key?.id ?? ""),
      name: String(item?.key?.name ?? ""),
      type: String(item?.key?.type ?? ""),
    }))
    .filter((column) => column.keyID.length > 0 && TITLE_COLUMN_TYPES.has(column.type));
}

/**
 * 构建标题模板可用的 `db` 对象。
 *
 * 同时提供列 ID、当前列名和已保存列配置里的旧列名，因此
 * `{{db["短评"]}}` 与 `{{db["20261111105159-uc6r8st"]}}` 都能解析；
 * 列改名后旧列名仍能指向同一个列 ID。
 *
 * @param av getAttributeView 返回的 av 对象
 * @param itemID 数据库行 ID（不是文档块 ID）
 * @param savedColumns 已保存的数据库列配置，用于保留旧列名
 * @returns 列名/列 ID 到单元格文本的映射
 */
export function buildDbValueMap(
  av: any,
  itemID: string,
  savedColumns: TitleColumnReference[] = [],
): Record<string, string> {
  const liveColumns = getTitleColumnDefinitions(av);
  const liveByKeyID = new Map(liveColumns.map((column) => [column.keyID, column]));
  // 使用无原型对象，避免列名恰好是 toString 等键时读到原型上的值。
  const map: Record<string, string> = Object.create(null);

  for (const column of liveColumns) {
    map[column.keyID] = readAttrViewCell(av, itemID, column.keyID);
  }

  const liveNameCounts = new Map<string, number>();
  for (const column of liveColumns) {
    if (!column.name) continue;
    liveNameCounts.set(column.name, (liveNameCounts.get(column.name) ?? 0) + 1);
  }
  for (const column of liveColumns) {
    if (!column.name || liveNameCounts.get(column.name) !== 1) continue;
    if (map[column.name] !== undefined) continue;
    map[column.name] = map[column.keyID];
  }

  const aliasNameCounts = new Map<string, number>();
  const aliases: TitleColumnReference[] = [];
  for (const saved of savedColumns) {
    const keyID = String(saved?.keyID ?? "");
    const name = String(saved?.name ?? "");
    if (!keyID || !name || !liveByKeyID.has(keyID)) continue;
    aliases.push({ keyID, name });
    aliasNameCounts.set(name, (aliasNameCounts.get(name) ?? 0) + 1);
  }
  for (const alias of aliases) {
    const name = alias.name as string;
    if (aliasNameCounts.get(name) !== 1) continue;
    if (map[name] !== undefined) continue;
    map[name] = map[alias.keyID];
  }

  return map;
}

/**
 * 渲染文献内容文档标题。
 *
 * 模板为空、列值为空或列不存在时回退到文献标题，再回退到 citekey，
 * 最后清洗文件名非法字符，保证 renameDoc 不会收到空标题。
 *
 * @param template 标题模板
 * @param entry 文献数据
 * @param db 数据库列值映射
 * @returns 可直接用于 renameDoc / createDocWithMd 的标题
 */
export function renderLiteratureTitle(
  template: string,
  entry: any,
  db: Record<string, string>,
): string {
  const rendered = generateFromTemplate(template, { ...entry, db });
  let title = String(rendered ?? "").trim();
  if (!title) title = String(entry?.title ?? "").trim();
  if (!title) title = String(entry?.citekey ?? "").trim();
  if (!title) title = "Untitled";
  return title.replace(DISALLOWED_FILENAME_CHARACTERS_RE, "_");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 按列改名结果重写标题模板里的 `{{db["旧列名"]}}`。
 *
 * 只替换 token 内的列名，模板其它部分保持不变；单引号、双引号和
 * 方括号内空白都兼容。
 *
 * @param template 标题模板
 * @param renames 列改名列表
 * @returns 重写后的模板；没有匹配时原样返回
 */
export function rewriteDbColumnTokens(template: string, renames: TitleColumnRename[]): string {
  let result = template;
  for (const rename of renames) {
    const from = String(rename?.from ?? "");
    const to = String(rename?.to ?? "");
    if (!from || !to || from === to) continue;

    // 同时匹配原始列名和 JSON 转义后的列名，覆盖含引号/反斜杠的极端列名。
    const candidates = new Set([from, JSON.stringify(from).slice(1, -1)]);
    for (const candidate of candidates) {
      // 只替换 token 内 db["..."] 的列名，后面可以继续跟 || title 等表达式。
      const pattern = new RegExp(
        `(\\{\\{[^}]*?\\bdb\\s*\\[\\s*)(["'])${escapeRegExp(candidate)}\\2`,
        "g",
      );
      result = result.replace(
        pattern,
        (_match: string, prefix: string, _quote: string) =>
          `${prefix}${JSON.stringify(to)}`,
      );
    }
  }
  return result;
}

/**
 * 对比已保存列配置和当前数据库列，生成列改名列表。
 *
 * @param savedColumns 已保存的列配置（旧列名）
 * @param liveColumns 当前数据库列（新列名）
 * @returns 需要重写到模板里的列改名
 */
export function buildColumnRenames(
  savedColumns: TitleColumnReference[],
  liveColumns: TitleColumnReference[],
): TitleColumnRename[] {
  const liveByKeyID = new Map(liveColumns.map((column) => [column.keyID, column]));
  const renames: TitleColumnRename[] = [];
  const seen = new Set<string>();

  for (const saved of savedColumns) {
    const live = liveByKeyID.get(String(saved?.keyID ?? ""));
    const from = String(saved?.name ?? "");
    const to = String(live?.name ?? "");
    if (!from || !to || from === to) continue;
    const key = `${from}\u0000${to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    renames.push({ from, to });
  }
  return renames;
}
