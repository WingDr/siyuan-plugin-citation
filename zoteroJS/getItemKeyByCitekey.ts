// @ts-nocheck 
/* eslint-disable */
var s = new Zotero.Search();
s.libraryID = libraryID;
s.addCondition("citationKey", "is", citekey);
var ids = await s.search();
let resKey = "";
if (ids.length) {
  var item = Zotero.Items.get(ids[0]);

  // 输出结果
  resKey = libraryID + "_" + item.key;
}
return JSON.stringify({
  itemKey: resKey
})
