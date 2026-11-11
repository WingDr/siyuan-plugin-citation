import assert from "node:assert/strict";

import {
  buildColumnRenames,
  buildDbValueMap,
  readAttrViewCell,
  renderLiteratureTitle,
  rewriteDbColumnTokens,
} from "../src/utils/literatureTitle";

const KEY_TEXT = "20261111105159-uc6r8st";
const KEY_NUMBER = "20261111105160-num0001";
const KEY_MULTI = "20261111105161-mul0001";
const KEY_BLOCK = "20261111105162-blk0001";
const KEY_URL = "20261111105163-url0001";
const KEY_DUP_A = "20261111105164-dup0001";
const KEY_DUP_B = "20261111105165-dup0001";
const ITEM_ID = "20261111112139-g8kq1pw";

const av = {
  keyValues: [
    {
      key: { id: KEY_BLOCK, name: "主键", type: "block" },
      values: [{ blockID: ITEM_ID, type: "block", block: { id: "doc-id" } }],
    },
    {
      key: { id: KEY_TEXT, name: "短评", type: "text" },
      values: [{ blockID: ITEM_ID, type: "text", text: { content: "AAA\n第二行" } }],
    },
    {
      key: { id: KEY_NUMBER, name: "年份", type: "number" },
      values: [{
        blockID: ITEM_ID,
        type: "number",
        number: { content: 2024, isNotEmpty: true },
      }],
    },
    {
      key: { id: KEY_MULTI, name: "标签", type: "mSelect" },
      values: [{
        blockID: ITEM_ID,
        type: "mSelect",
        mSelect: [{ content: "A" }, { content: "B" }],
      }],
    },
    {
      key: { id: KEY_URL, name: "Zotero", type: "url" },
      values: [{ blockID: ITEM_ID, type: "url", url: { content: "zotero://select/x" } }],
    },
    {
      key: { id: KEY_DUP_A, name: "重名", type: "text" },
      values: [{ blockID: ITEM_ID, type: "text", text: { content: "A" } }],
    },
    {
      key: { id: KEY_DUP_B, name: "重名", type: "text" },
      values: [{ blockID: ITEM_ID, type: "text", text: { content: "B" } }],
    },
  ],
};

const entry = { title: "论文标题", citekey: "wang_2024" };

const tests: Array<[string, () => void]> = [];
function test(name: string, run: () => void) {
  tests.push([name, run]);
}

test("reads text, number and multi-select cells", () => {
  assert.equal(readAttrViewCell(av, ITEM_ID, KEY_TEXT), "AAA 第二行");
  assert.equal(readAttrViewCell(av, ITEM_ID, KEY_NUMBER), "2024");
  assert.equal(readAttrViewCell(av, ITEM_ID, KEY_MULTI), "A, B");
});

test("unsupported, missing and empty cells return an empty string", () => {
  assert.equal(readAttrViewCell(av, ITEM_ID, KEY_BLOCK), "");
  assert.equal(readAttrViewCell(av, ITEM_ID, KEY_URL), "");
  assert.equal(readAttrViewCell(av, ITEM_ID, "missing-key"), "");
  assert.equal(readAttrViewCell(av, "missing-item", KEY_TEXT), "");
  assert.equal(
    readAttrViewCell(
      { keyValues: [{ key: { id: "empty" }, values: [] }] },
      ITEM_ID,
      "empty",
    ),
    "",
  );
});

test("number cells respect the isNotEmpty flag", () => {
  const zero = {
    keyValues: [{
      key: { id: "num", name: "数字", type: "number" },
      values: [{ blockID: ITEM_ID, type: "number", number: { content: 0, isNotEmpty: true } }],
    }],
  };
  assert.equal(readAttrViewCell(zero, ITEM_ID, "num"), "0");
  const empty = {
    keyValues: [{
      key: { id: "num", name: "数字", type: "number" },
      values: [{ blockID: ITEM_ID, type: "number", number: { content: 0, isNotEmpty: false } }],
    }],
  };
  assert.equal(readAttrViewCell(empty, ITEM_ID, "num"), "");
});

test("db map exposes keyIDs, unique current names and ignores unsupported columns", () => {
  const map = buildDbValueMap(av, ITEM_ID);
  assert.equal(map[KEY_TEXT], "AAA 第二行");
  assert.equal(map["短评"], "AAA 第二行");
  assert.equal(map["年份"], "2024");
  assert.equal(map["标签"], "A, B");
  assert.equal(map["Zotero"], undefined);
  assert.equal(map["主键"], undefined);
  assert.equal(map["重名"], undefined);
});

test("db map keeps the last saved column name as a rename-safe alias", () => {
  const map = buildDbValueMap(av, ITEM_ID, [{ keyID: KEY_TEXT, name: "总结" }]);
  assert.equal(map["总结"], "AAA 第二行");
  assert.equal(map["短评"], "AAA 第二行");
  assert.equal(map[KEY_TEXT], "AAA 第二行");
});

test("db map ignores aliases for columns that no longer exist", () => {
  const map = buildDbValueMap(av, ITEM_ID, [{ keyID: "removed-column", name: "旧列" }]);
  assert.equal(map["旧列"], undefined);
});

test("old templates without db keep their behavior", () => {
  assert.equal(renderLiteratureTitle("({{citekey}})", entry, {}), "(wang_2024)");
  assert.equal(renderLiteratureTitle("{{title}}", entry, {}), "论文标题");
});

test("name token reads the cell value", () => {
  const map = buildDbValueMap(av, ITEM_ID);
  assert.equal(
    renderLiteratureTitle('{{db["短评"] || title}} ({{citekey}})', entry, map),
    "AAA 第二行 (wang_2024)",
  );
});

test("keyID token also reads the cell value", () => {
  const map = buildDbValueMap(av, ITEM_ID);
  assert.equal(
    renderLiteratureTitle(`{{db["${KEY_TEXT}"] || title}} ({{citekey}})`, entry, map),
    "AAA 第二行 (wang_2024)",
  );
});

test("empty column falls back to the paper title", () => {
  assert.equal(
    renderLiteratureTitle('{{db["短评"] || title}} ({{citekey}})', entry, {}),
    "论文标题 (wang_2024)",
  );
  // 裸 token 没有 || title 时只能保证“整体渲染为空”才回退；
  // 与静态文字拼接时由用户在模板里显式写 || title。
  assert.equal(renderLiteratureTitle('{{db["短评"]}}', entry, {}), "论文标题");
  assert.equal(
    renderLiteratureTitle('{{db["短评"]}} ({{citekey}})', entry, {}),
    "(wang_2024)",
  );
});

test("multiple columns are joined in template order", () => {
  const map = buildDbValueMap(av, ITEM_ID);
  assert.equal(
    renderLiteratureTitle('{{db["短评"]}} — {{db["年份"]}} ({{citekey}})', entry, map),
    "AAA 第二行 — 2024 (wang_2024)",
  );
});

test("illegal filename characters are sanitized and empty titles never survive", () => {
  assert.equal(
    renderLiteratureTitle('{{db["短评"] || title}}', { ...entry, title: "a/b:c" }, {}),
    "a_b:c",
  );
  assert.equal(renderLiteratureTitle("", { title: "", citekey: "" }, {}), "Untitled");
});

test("column rename rewrites only the token and preserves the rest", () => {
  assert.equal(
    rewriteDbColumnTokens('{{db["总结"]}} ({{citekey}})', [{ from: "总结", to: "短评" }]),
    '{{db["短评"]}} ({{citekey}})',
  );
  assert.equal(
    rewriteDbColumnTokens('{{db["总结"] || title}} ({{citekey}})', [{ from: "总结", to: "短评" }]),
    '{{db["短评"] || title}} ({{citekey}})',
  );
  assert.equal(
    rewriteDbColumnTokens("{{db['总结']}} ({{citekey}})", [{ from: "总结", to: "短评" }]),
    '{{db["短评"]}} ({{citekey}})',
  );
  assert.equal(
    rewriteDbColumnTokens('{{ db[ "总结" ] }}', [{ from: "总结", to: "短评" }]),
    '{{ db[ "短评" ] }}',
  );
  assert.equal(
    rewriteDbColumnTokens('{{db["总结"]}} — {{db["总结"]}}', [{ from: "总结", to: "短评" }]),
    '{{db["短评"]}} — {{db["短评"]}}',
  );
  assert.equal(
    rewriteDbColumnTokens('{{db["无关"]}}', [{ from: "总结", to: "短评" }]),
    '{{db["无关"]}}',
  );
});

test("column rename also matches quoted names escaped by JSON.stringify", () => {
  const name = 'a"b';
  const token = `{{db[${JSON.stringify(name)}]}}`;
  assert.equal(rewriteDbColumnTokens(token, [{ from: name, to: "新列" }]), '{{db["新列"]}}');
});

test("buildColumnRenames compares by keyID and ignores removed or unchanged columns", () => {
  assert.deepEqual(
    buildColumnRenames(
      [{ keyID: KEY_TEXT, name: "总结" }, { keyID: "removed", name: "旧" }, { keyID: KEY_NUMBER, name: "年份" }],
      [{ keyID: KEY_TEXT, name: "短评" }, { keyID: KEY_NUMBER, name: "年份" }],
    ),
    [{ from: "总结", to: "短评" }],
  );
});

let passed = 0;
for (const [name, run] of tests) {
  try {
    run();
    passed++;
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}
console.log(`${passed}/${tests.length} literature-title tests passed`);
