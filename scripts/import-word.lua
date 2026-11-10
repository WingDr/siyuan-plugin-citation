-- Use SiYuan text marks instead of optional ^superscript^ / ~subscript~ syntax.
local mark_types = {
  Strong = "strong", Emph = "em", Underline = "u", Strikeout = "s",
  Superscript = "sup", Subscript = "sub", Code = "code",
}

local function escape_html(text)
  return text:gsub("&", "&amp;"):gsub("<", "&lt;"):gsub(">", "&gt;"):gsub('"', "&quot;")
end

local function script_mark(element, kind)
  local output = {}
  local function collect(inlines, marks)
    for _, inline in ipairs(inlines) do
      local mark = mark_types[inline.t]
      if mark and inline.content then
        collect(inline.content, marks .. " " .. mark)
      else
        local text
        if inline.t == "Space" or inline.t == "SoftBreak" or inline.t == "LineBreak" then
          text = " "
        else
          text = pandoc.utils.stringify(inline)
        end
        local types = inline.t == "Code" and (marks .. " code") or marks
        table.insert(output, '<span data-type="' .. types .. '">' .. escape_html(text) .. '</span>')
      end
    end
  end
  collect(element.content, kind)
  -- Raw Markdown avoids Pandoc's `{=html}` wrappers, which SiYuan does not parse.
  return pandoc.RawInline("markdown", table.concat(output)), false
end

return {{
  traverse = "topdown",
  Superscript = function(element) return script_mark(element, "sup") end,
  Subscript = function(element) return script_mark(element, "sub") end,
}}
