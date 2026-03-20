# AGENTS.md

## Project identity

This repository is a SiYuan plugin for literature citation workflows. It connects literature data sources (BibTeX / CSL-JSON / Zotero / Juris-M) to SiYuan so users can:

- search literature
- insert citation links into notes
- generate and refresh literature note documents
- sync metadata, annotations, attachments, backlinks, and tags
- export documents with citations to Markdown / Word / LaTeX
- optionally sync literature metadata into SiYuan database attribute views

The plugin entrypoint is `src/index.ts`. Plugin metadata is in `plugin.json`.

## How to use this file

Use this file as the default repository-level context before making changes.

- For stable architecture and editing constraints, prefer this file.
- For deeper codebase walkthrough details, see `.claude/repo-overview.md`.
- If this file and the current code disagree, trust the current code and update this file.

## Core architecture

The three most important modules are:

1. `Database`
2. `Reference`
3. `LiteratureNote`

Treat them as the core workflow chain of the plugin.

### Responsibilities

- `src/database/`
  - Owns data source abstraction and orchestration.
  - Handles different source modes: local files, Zotero Better BibTeX, Zotero debug-bridge.
  - Entry point for user-facing actions like inserting citation links or notes.

- `src/references/reference.ts`
  - Owns citation-generation behavior.
  - Handles adjacent citation grouping logic.
  - Inserts or rewrites citation content inside the editor.

- `src/references/literatureNote.ts`
  - Owns literature note creation, refresh, merging, and synchronization.
  - Protects user data regions during refresh.
  - Syncs backlinks/tags to Zotero in supported modes.
  - Syncs SiYuan database attribute view data when configured.
  - This is not a passive cache layer; it is a state synchronization hub.

- `src/references/pool.ts`
  - Maintains the mapping between literature keys and SiYuan document/block ids.

- `src/frontEnd/`
  - Owns settings UI, search dialog, slash commands, menu registration, and interaction glue.

- `src/export/`
  - Owns export pipelines for Markdown / Word / LaTeX.

- `src/api/`
  - Wraps SiYuan kernel API access and network helpers.

- `src/utils/`
  - Shared constants, notifications, logging, updates, templates, and utility helpers.

- `zoteroJS/`
  - JS scripts executed in Zotero/Juris-M for debug-bridge mode.

## Startup flow

The plugin entry class is `SiYuanPluginCitation` in `src/index.ts`.

High-level startup order inside `onload()`:

1. initialize logger / noticer / literature pool / network manager
2. load persisted settings
3. register icons
4. run update migration logic
5. initialize `KernelApi`
6. initialize `InteractionManager`
7. initialize `ExportManager`
8. initialize `Database`
9. build the concrete data source from current settings
10. initialize `Reference`

When changing initialization behavior, preserve this dependency order unless there is a strong reason not to.

## Critical invariants

### 1. Adjacent citations are edited as a group

This is one of the plugin's defining behaviors.

- Do not change citation insertion or citation-style switching logic without checking adjacent citation handling.
- Do not implement single-citation rewrites that accidentally break neighboring citation groups.
- If touching citation parsing, insertion, export, or style conversion, verify grouped-citation behavior.

Primary area: `src/references/reference.ts`

### 2. Literature notes must preserve user data

Literature note refresh logic must preserve the user data region whenever possible.

- Do not treat literature-note refresh as a blind full-document overwrite.
- Be careful with logic around top citation blocks, user-data headings, and custom attributes.
- Changes here can destroy user-authored content if done incorrectly.

Primary area: `src/references/literatureNote.ts`

### 3. `LiteratureNote` is a synchronization center

Changes in literature note logic can affect multiple systems at once:

- document creation/refresh
- user data preservation
- Zotero backlink/tag writeback
- database attribute view synchronization
- merge/unbind behavior

Do not make “small” local edits here without checking downstream effects.

### 4. Internal literature keys are mode-dependent

Many flows depend on keys such as:

- `libraryID_citekey`
- `libraryID_itemKey`

Do not normalize or rewrite key formats casually. Check both file-mode and Zotero-mode behavior first.

### 5. Debug-bridge mode has the broadest feature surface

The debug-bridge Zotero/Juris-M mode supports the richest behavior, including:

- selected-item insertion
- annotation and attachment handling
- paste-related flows
- backlink/tag writeback
- stronger export integration

When changing advanced citation, note, export, or Zotero-related behavior, verify whether debug-bridge is affected.

## Data source architecture

Unified data-source abstraction lives in `src/database/modal.ts`.

Implementations include:

- file-based mode
- Zotero Better BibTeX mode
- Zotero debug-bridge mode

If adding or changing a data source:

- preserve the shared modal contract
- keep search, content retrieval, note retrieval, and optional writeback responsibilities clearly separated
- avoid leaking one mode's assumptions into all other modes

## Export caveats

Export logic lives in `src/export/exportManager.ts`.

Important constraints:

- Markdown, Word, and LaTeX export are separate pipelines with shared citation assumptions.
- Adjacent citations are also merged during export behavior.
- Word and LaTeX export depend on Pandoc scripts in `scripts/`.
- There is repo-documented local-environment coupling in export-related template paths; do not assume export paths are fully portable without checking the current implementation.

When editing export logic:

- verify citation transformation format
- verify grouped citation behavior
- verify path assumptions and external tool expectations

## Frontend and interaction notes

Interaction registration is concentrated in `src/frontEnd/interaction.ts`.

This includes:

- slash menu items
- commands
- document title menu actions
- block ref menu actions
- paste event behavior

If a user-facing action seems “missing”, check interaction registration before assuming the core logic is absent.

Settings UI is under `src/frontEnd/settingTab/` and uses Svelte components rather than a trivial flat settings form.

## Template system notes

Template handling is intentionally simple and powerful.

- `{{ expr }}` syntax is transformed into template_js expressions.
- Templates may contain JS expressions and control-flow-like behavior.
- Template variables differ by data source implementation.

When changing template-related code:

- do not accidentally remove support for expression-based templates
- check both citation templates and literature note templates
- check downstream consumers such as title templates, naming templates, Zotero tag/backlink templates, and attribute-view JSON templates

## Build and environment notes

Tech stack includes TypeScript, Svelte 5, Webpack, Sass, axios, Fuse.js, template_js, and BibTeX parsing.

Common commands:

- `npm run lint`
- `npm run dev`
- `npm run build`

Important caveat:

- Some development/build behavior is coupled to the original author's local filesystem layout.
- Do not assume all absolute paths are portable.
- If you touch build or export paths, minimize blast radius and document portability implications.

## High-signal files to read before larger changes

Read in this order when the task touches core behavior:

1. `src/index.ts`
2. `src/frontEnd/interaction.ts`
3. `src/database/database.ts`
4. `src/database/modal.ts`
5. `src/references/reference.ts`
6. `src/references/literatureNote.ts`
7. `src/references/cite.ts`
8. `src/export/exportManager.ts`
9. `src/frontEnd/settingTab/`
10. `zoteroJS/`

## Change guidance by area

### If changing citation insertion or style behavior

- inspect `src/references/reference.ts`
- inspect `src/references/cite.ts`
- inspect interaction entry points
- verify adjacent citation grouping behavior
- verify export-side citation transformations are still compatible

### If changing literature note generation or refresh

- inspect `src/references/literatureNote.ts`
- inspect `src/references/pool.ts`
- verify user data preservation
- verify custom attributes remain coherent
- verify optional Zotero/database sync side effects

### If changing data source behavior

- inspect `src/database/database.ts`
- inspect `src/database/modal.ts`
- inspect source-specific library/adaptor files
- verify both retrieval and search behavior
- verify mode-specific assumptions do not break other source types

### If changing export behavior

- inspect `src/export/exportManager.ts`
- inspect `scripts/`
- verify output format assumptions
- verify grouped citations and external path/tool assumptions

### If changing UI or commands

- inspect `src/frontEnd/interaction.ts`
- inspect `src/frontEnd/searchDialog/`
- inspect `src/frontEnd/settingTab/`
- inspect `src/i18n/`

## Practical guardrails for future agents

- Prefer minimal changes over broad refactors.
- Do not refactor unrelated modules while fixing a bug.
- Do not change citation grouping semantics unless the task explicitly requires it.
- Do not change literature-note refresh semantics without checking user data protection.
- Do not assume file-mode and Zotero-mode share identical data shapes.
- Do not assume export paths are portable.
- When touching user-visible text, check both `src/i18n/en_US.json` and `src/i18n/zh_CN.json`.

## Supplemental context

Detailed repository walkthrough, file map, and implementation notes are kept in:

- `.claude/repo-overview.md`

Use that file for deeper orientation, but keep `AGENTS.md` as the primary stable editing guide.
