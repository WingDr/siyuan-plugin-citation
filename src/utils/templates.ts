


export function generateFromTemplate(template: string, params: object) {
  const reg = /\{\{(.*?)\}\}/g;
  return template.replace(reg, (match, pname) => {
    return params[pname] ?? "";
  });
}