import template from "template_js";

export function generateFromTemplate(contentTemplate: string, params: object) { 
  const reg = /\{\{(.*?)\}\}/g;
  return template(contentTemplate.replace(reg, (match, pname) => {
    return `<%= ${pname} %>`;
  }), params);
}