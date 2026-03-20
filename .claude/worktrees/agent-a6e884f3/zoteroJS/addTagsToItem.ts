// @ts-nocheck 
/* eslint-disable */
var targetItem = await Zotero.Items.getByLibraryAndKeyAsync(libraryID, key);
var existTags = targetItem.getTags();

var setList = tags.split(",").reduce((acc, tag) => {
  if (existTags.indexOf(tag) == -1) {
    return [...acc, {
      tag,
      type: 0
    }];
  } else {
    return acc;
  }
}, existTags);

await targetItem.setTags(setList);
return JSON.stringify({result: await targetItem.saveTx()});