export interface ZoteroCitationItem {
  id?: string | number;
  uris?: string[];
  uri?: string[];
  itemData?: {
    DOI?: string;
    citationKey?: string;
    "citation-key"?: string;
    [key: string]: unknown;
  };
  prefix?: string;
  suffix?: string;
  locator?: string;
  label?: string;
}

export interface WordCitation {
  marker: string;
  text: string;
  items: ZoteroCitationItem[];
}

/** Source metadata for matching; full template variables are fetched after a match. */
export interface ImportEntry {
  key: string;
  itemKey?: string;
  citekey?: string;
  DOI?: string;
  title?: string;
  shortAuthor?: string;
  year?: string;
  entry?: { data?: { itemID?: number; id?: number; libraryID?: number } };
}
