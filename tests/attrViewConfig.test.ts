import assert from "node:assert/strict";

import {
  ATTR_VIEW_CONFIG_VERSION,
  buildAttrViewTemplate,
  parseAttrViewTemplate,
  reconcileAttrViewColumns,
  selectAttrViewDataForSave,
  type AttrViewColumnConfig,
} from "../src/frontEnd/settingTab/attrViewConfig";
import { generateFromTemplate } from "../src/utils/templates";
import { EntryCSLAdapter, Library } from "../src/database/filesLibrary";

const columns = [
  { id: "author", name: "第一作者", type: "select" },
  { id: "last", name: "末位作者", type: "mSelect" },
  { id: "journal", name: "发表期刊", type: "select" },
  { id: "date", name: "发表日期", type: "date" },
  { id: "url", name: "URL", type: "url" },
];

const tests: Array<[string, () => void]> = [];
function test(name: string, run: () => void) {
  tests.push([name, run]);
}

test("legacy migration preserves only explicitly configured columns", () => {
  const legacyTemplate = `[
    {
      "keyID": "journal",
      "value": {"mSelect":[{"content":"{{ containerTitle }}"}]}
    }
  ]`;
  const result = reconcileAttrViewColumns(columns, [], legacyTemplate, 0);
  assert.equal(result.status, "migrated");
  assert.equal(result.configs.find((item) => item.keyID === "journal")?.mode, "custom");
  assert.equal(result.configs.find((item) => item.keyID === "author")?.mode, "");
  assert.equal(result.configs.find((item) => item.keyID === "date")?.mode, "");
});

test("a new database receives safe name-based defaults", () => {
  const result = reconcileAttrViewColumns(columns, [], "", 0);
  assert.equal(result.status, "new");
  assert.equal(result.configs.find((item) => item.keyID === "author")?.mode, "firstAuthor");
  assert.equal(result.configs.find((item) => item.keyID === "last")?.mode, "lastAuthor");
  assert.equal(result.configs.find((item) => item.keyID === "date")?.mode, "date");
});

test("an intentionally empty structured config stays empty", () => {
  const result = reconcileAttrViewColumns(columns, [], "", ATTR_VIEW_CONFIG_VERSION);
  assert.equal(result.status, "structured");
  assert.ok(result.configs.every((item) => item.mode === ""));
});

test("malformed legacy templates fail closed", () => {
  const parsed = parseAttrViewTemplate('[{"keyID":"journal","value": nope}]');
  assert.equal(parsed.valid, false);
  const result = reconcileAttrViewColumns(columns, [], '[{"keyID":"journal","value": nope}]', 0);
  assert.equal(result.status, "error");
});

test("pre-version structured configs are retained and old last-author mode is normalized", () => {
  const saved: AttrViewColumnConfig[] = [{
    keyID: "last",
    name: "末位作者",
    type: "mSelect",
    mode: "correspondingAuthor" as any,
    customValue: "",
  }];
  const result = reconcileAttrViewColumns(columns, saved, "", 0);
  assert.equal(result.status, "structured");
  assert.equal(result.configs.find((item) => item.keyID === "last")?.mode, "lastAuthor");
});

test("built-in values remain valid JSON with quotes, slashes and newlines", () => {
  const configs: AttrViewColumnConfig[] = [
    { keyID: "journal", name: "发表期刊", type: "select", mode: "journal", customValue: "" },
    { keyID: "url", name: "URL", type: "url", mode: "url", customValue: "" },
    { keyID: "date", name: "发表日期", type: "date", mode: "date", customValue: "" },
  ];
  const journal = 'Journal "Quoted"\\Series\nNext';
  const url = 'https://example.com/a\\b?title="quoted"';
  const issuedDate = Date.UTC(2022, 1, 1);
  const rendered = generateFromTemplate(buildAttrViewTemplate(configs), {
    containerTitle: journal,
    DOI: "",
    URL: url,
    issuedDate,
  });
  const values = JSON.parse(rendered);
  assert.equal(values[0].value.mSelect[0].content, journal);
  assert.equal(values[1].value.url.content, url);
  assert.equal(values[2].value.date.content, issuedDate);
  assert.equal(values[2].value.date.isNotEmpty, true);
});

test("CSL metadata exposes normalized publication date and author names", () => {
  const entry = new EntryCSLAdapter({
    id: "sample",
    type: "article-journal",
    author: [
      { given: "Ada", family: "Lovelace" },
      { given: "Grace", family: "Hopper" },
    ],
    issued: { "date-parts": [[2022, 2]] },
  });
  const variables = new Library({ sample: entry }).getTemplateVariablesForCitekey("sample");
  assert.equal(variables.firstAuthor, "Ada Lovelace");
  assert.equal(variables.lastAuthor, "Grace Hopper");
  assert.equal(variables.issuedDate, Date.UTC(2022, 1, 1));
});

test("missing select and date values still produce valid JSON", () => {
  const configs: AttrViewColumnConfig[] = [
    { keyID: "author", name: "第一作者", type: "select", mode: "firstAuthor", customValue: "" },
    { keyID: "date", name: "发表日期", type: "date", mode: "date", customValue: "" },
  ];
  const rendered = generateFromTemplate(buildAttrViewTemplate(configs), {
    firstAuthor: "",
    issuedDate: 0,
  });
  const values = JSON.parse(rendered);
  assert.deepEqual(values[0].value.mSelect, []);
  assert.equal(values[1].value.date.content, 0);
  assert.equal(values[1].value.date.isNotEmpty, false);
});

test("unsafe load states preserve the original settings", () => {
  const original = {
    block: "old-block",
    template: '[{"keyID":"old","value":{"text":{"content":"old"}}}]',
    configs: [] as AttrViewColumnConfig[],
    version: 0,
  };
  for (const state of ["idle", "loading", "error"] as const) {
    assert.deepEqual(
      selectAttrViewDataForSave(state, "new-block", "", [], original),
      original,
    );
  }
});

test("only a successfully loaded block is persisted", () => {
  const original = { block: "old", template: "old", configs: [] as AttrViewColumnConfig[], version: 0 };
  const configs: AttrViewColumnConfig[] = [
    { keyID: "journal", name: "发表期刊", type: "select", mode: "journal", customValue: "" },
  ];
  const ready = selectAttrViewDataForSave("ready", "new", "new", configs, original);
  assert.equal(ready.block, "new");
  assert.equal(ready.version, ATTR_VIEW_CONFIG_VERSION);
  assert.match(ready.template, /"keyID": "journal"/);
  assert.deepEqual(selectAttrViewDataForSave("ready", "invalid", "new", configs, original), original);
  assert.deepEqual(selectAttrViewDataForSave("cleared", "", "", configs, original), {
    block: "",
    template: "",
    configs: [],
    version: ATTR_VIEW_CONFIG_VERSION,
  });
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
console.log(`${passed}/${tests.length} attribute-view tests passed`);
