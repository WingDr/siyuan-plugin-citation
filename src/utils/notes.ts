const blockLabels = [
  "h1", "h2", "h3", "h4", "h5", "h6",
  "blockquote",
  "table", "ol", "ul",
  "p"
];

const requireEnterLabels = [
  "blockquote"
];

interface htmlBlock {
  content: string,
  isSeparated: boolean
}

export function htmlNotesProcess(note: string) {
  return processBlocks([{
    content: removeWrapDiv(note),
    isSeparated: false
  }] as htmlBlock[], 0).map(b => "<div>\n"+b.content+"\n</div>").join("\n\n");
}

function removeWrapDiv(content: string): string {
  const trimContent = content.trim();
  if (trimContent.search(/<div.*?>/) == -1 || trimContent.search(/<div.*?>/) != 0) {
    return trimContent;
  } else {
    const noDivContent = trimContent.replace(/<div.*?>/, "");
    return noDivContent.slice(0, noDivContent.length - "</div>".length);
  }
}

function processBlocks(blockList: htmlBlock[], labelIndex: number) {
  if (labelIndex == blockLabels.length) {
    return blockList.filter(block => {
      return !(block.content == "<p></p>" || block.content.length == 0);
    });
  }
  const newList:htmlBlock[] = [];
  const label = blockLabels[labelIndex];
  const regExpString = "<" + label + ".*?>[\\s\\S]*?</" + label + ">";
  const reg = new RegExp(regExpString);
  blockList.forEach(block => {
    if (block.isSeparated) {
      newList.push(block);
    } else {
      const blocks = separateBlocks(block.content, reg);
      if (requireEnterLabels.indexOf(label) != -1) {
        const startLabelExp = new RegExp("<" + label + ".*?>");
        const endLabel= "</" + label + ">";
        blocks.forEach(block => {
          if (block.isSeparated == true) {
            const content = block.content;
            const match = content.match(startLabelExp);
            block.content = match[0] + "\n" + content.slice(match[0].length, content.length - endLabel.length).trim() + "\n" + endLabel;
          }
        });
      }
      newList.push(...blocks);
    }
  });
  return processBlocks(newList, labelIndex + 1);
}

function separateBlocks(content: string, reg: RegExp): htmlBlock[] {
  const trimContent = content.trim();
  if (trimContent.search(reg) == -1) {
    return [{
      content: trimContent,
      isSeparated: false
    }];
  } else if (trimContent.search(reg) == 0) {
    const match = trimContent.match(reg);
    return [{
      content: match[0],
      isSeparated: true
    }, ...separateBlocks(trimContent.slice(match[0].length), reg)];
  } else {
    return [{
      content: trimContent.slice(0, trimContent.search(reg)),
      isSeparated: false
    }, ...separateBlocks(trimContent.slice(trimContent.search(reg)), reg)];
  }
}