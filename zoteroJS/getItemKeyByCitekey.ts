// @ts-nocheck 
/* eslint-disable */
var s = new Zotero.Search();
s.libraryID = Zotero.Libraries.userLibraryID;
s.addCondition("citationKey", "is", citekey);
var ids = await s.search();
if (ids.length) {
  var item = Zotero.Items.get(ids[0]);

  // 输出结果
  return item.key;
} else {
  return "";
}
