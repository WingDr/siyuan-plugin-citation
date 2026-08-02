import assert from "node:assert/strict";

import {
  buildLiteratureDocInPathStatement,
  isDirectChildDocument,
} from "../src/api/literature-doc-query";

const tests: Array<[string, () => void]> = [];
function test(name: string, run: () => void) {
  tests.push([name, run]);
}

test("only direct children of the literature library are accepted", () => {
  const libraryPath = "/Assets/References";
  assert.equal(isDirectChildDocument(libraryPath, "/Assets/References/Paper A"), true);
  assert.equal(isDirectChildDocument(`${libraryPath}/`, "/Assets/References/Paper B"), true);
  assert.equal(isDirectChildDocument(libraryPath, "/Assets/References/Paper A/Notes"), false);
  assert.equal(isDirectChildDocument(libraryPath, "/Assets/References/Paper A/Notes/Draft"), false);
  assert.equal(isDirectChildDocument(libraryPath, "/Assets/References-Archive/Paper A"), false);
  assert.equal(isDirectChildDocument(libraryPath, "/Assets/References/"), false);
  assert.equal(isDirectChildDocument(libraryPath, undefined as any), false);
});

test("root libraries still distinguish direct and nested documents", () => {
  assert.equal(isDirectChildDocument("/", "/Paper A"), true);
  assert.equal(isDirectChildDocument("/", "/Paper A/Notes"), false);
});

test("the query selects a stable, paginated set of direct children", () => {
  const statement = buildLiteratureDocInPathStatement(
    "box'quoted",
    "/Assets/References/",
    128,
    64,
  );

  assert.match(statement, /b\.box = 'box''quoted'/);
  assert.match(statement, /substr\(b\.hpath, 1, 19\) = '\/Assets\/References\/'/);
  assert.match(statement, /length\(substr\(b\.hpath, 20\)\) > 0/);
  assert.match(statement, /instr\(substr\(b\.hpath, 20\), '\/'\) = 0/);
  assert.match(statement, /ORDER BY b\.hpath, b\.id/);
  assert.match(statement, /LIMIT 64 OFFSET 128/);
});

test("pagination values are normalized", () => {
  const statement = buildLiteratureDocInPathStatement("box", "/References", -2.5, 0);
  assert.match(statement, /LIMIT 1 OFFSET 0/);
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
console.log(`${passed}/${tests.length} literature document query tests passed`);
