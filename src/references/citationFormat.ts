import { generateFromTemplate } from "../utils/templates";

export function renderCiteLink(template: string, entry: object, citeFileID: string, index: number): string {
  return generateFromTemplate(template, { index, citeFileID, ...entry });
}

/** Delimiters belong to the reference anchor, so exporting it consumes them too. */
export function formatMultiCitation(link: string, index: number, count: number, setting: {
  multiCitePrefix?: string;
  multiCiteConnector?: string;
  multiCiteSuffix?: string;
}): string {
  const prefix = setting.multiCitePrefix ?? "";
  const connector = setting.multiCiteConnector ?? "";
  const suffix = setting.multiCiteSuffix ?? "";
  if (count === 1) return prefix + link + suffix;
  return (index === 0 ? prefix : "") + link + (index === count - 1 ? suffix : connector);
}
