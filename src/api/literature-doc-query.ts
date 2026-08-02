function normalizeDirectoryHPath(dirHPath: string): string {
  const trimmed = dirHPath.trim();
  if (!trimmed || trimmed === "/") return "/";
  return `${trimmed.replace(/\/+$/, "")}/`;
}

function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''");
}

function normalizeNonNegativeInteger(value: number, fallback: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : fallback;
}

export function isDirectChildDocument(dirHPath: string, documentHPath: string): boolean {
  if (typeof documentHPath !== "string") return false;
  const prefix = normalizeDirectoryHPath(dirHPath);
  if (!documentHPath.startsWith(prefix)) return false;
  const relativePath = documentHPath.slice(prefix.length);
  return relativePath.length > 0 && !relativePath.includes("/");
}

export function buildLiteratureDocInPathStatement(
  notebook: string,
  dirHPath: string,
  offset: number,
  limit: number,
): string {
  const prefix = normalizeDirectoryHPath(dirHPath);
  const escapedNotebook = escapeSqlString(notebook);
  const escapedPrefix = escapeSqlString(prefix);
  const prefixLength = prefix.length;
  const relativePathStart = prefixLength + 1;
  const safeOffset = normalizeNonNegativeInteger(offset, 0);
  const safeLimit = Math.max(1, normalizeNonNegativeInteger(limit, 64));

  return `SELECT
          b.id, b.root_id, b.box, b."path", b.hpath, b.name, b.content, a.value as literature_key, c.value as literature_unlink
        FROM blocks b
          left outer join (
            select * FROM "attributes" WHERE name = "custom-literature-key"
          ) as a on b.id = a.block_id
          left outer join (
            select * FROM "attributes" WHERE name = "custom-literature-unlinked"
          ) as c on b.id = c.block_id
        WHERE
          b.box = '${escapedNotebook}' and
          substr(b.hpath, 1, ${prefixLength}) = '${escapedPrefix}' and
          length(substr(b.hpath, ${relativePathStart})) > 0 and
          instr(substr(b.hpath, ${relativePathStart}), '/') = 0 and
          b.type = 'd'
        ORDER BY b.hpath, b.id
        LIMIT ${safeLimit} OFFSET ${safeOffset}`;
}
