export interface ISpanItem {
    block_id: string;
    box: string;
    content: string;
    ial: string;
    id: string;
    markdown: string;
    path: string;
    root_id: string;
    type: string;
  }

  export interface IBlockItem {
    alias: string;
    box: string;
    content: string;
    created: string;
    fcontent: string;
    hash: string;
    hpath: string;
    ial: string;
    id: string;
    length: number;
    markdown: string;
    memo: string;
    name: string;
    parent_id: string;
    path: string;
    root_id: string;
    sort: number;
    subtype: string;
    tag: string;
    type: string;
    updated: string;
  }