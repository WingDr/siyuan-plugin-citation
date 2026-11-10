-- Preserve Word colors and scripts with SiYuan's native text marks.
local mark_types = {
  Strong = "strong", Emph = "em", Underline = "u", Strikeout = "s",
  Superscript = "sup", Subscript = "sub", Code = "code",
}

local function escape_html(text)
  return text:gsub("&", "&amp;"):gsub("<", "&lt;"):gsub(">", "&gt;"):gsub('"', "&quot;")
end

local function span_color(element)
  if element.t ~= "Span" then return nil end
  return (element.attributes["custom-style"] or ""):match("^SiyuanCitationColor_(%x%x%x%x%x%x)_%d+$")
end

local function add_mark(marks, mark)
  return marks == "" and mark or (marks .. " " .. mark)
end

local function text_marks(element, kind, color)
  local segments = {}
  local function append(text, marks, current_color, link)
    local types = current_color and add_mark(marks, "text") or marks
    local attributes = current_color and (' style="color: #' .. current_color .. ';"') or ""
    if link then
      types = add_mark(types, "a")
      attributes = attributes .. ' data-href="' .. escape_html(link.target) .. '"'
      if link.title ~= "" then attributes = attributes .. ' data-title="' .. escape_html(link.title) .. '"' end
    end
    local previous = segments[#segments]
    if previous and previous.types == types and previous.attributes == attributes then
      previous.text = previous.text .. text
    else
      table.insert(segments, {types = types, attributes = attributes, text = text})
    end
  end
  local function collect(inlines, marks, current_color, link)
    for _, inline in ipairs(inlines) do
      local mark = mark_types[inline.t]
      if inline.t == "Span" then
        collect(inline.content, marks, span_color(inline) or current_color, link)
      elseif inline.t == "Link" then
        collect(inline.content, marks, current_color, inline)
      elseif mark and inline.content then
        collect(inline.content, add_mark(marks, mark), current_color, link)
      elseif inline.t == "LineBreak" then
        table.insert(segments, {raw = "  \n"})
      else
        local text
        if inline.t == "Space" or inline.t == "SoftBreak" then
          text = " "
        else
          text = pandoc.utils.stringify(inline)
        end
        append(text, inline.t == "Code" and add_mark(marks, "code") or marks, current_color, link)
      end
    end
  end
  collect(element.content, kind, color, nil)
  local output = {}
  for _, segment in ipairs(segments) do
    table.insert(output, segment.raw or ('<span data-type="' .. segment.types .. '"' .. segment.attributes .. '>' .. escape_html(segment.text) .. '</span>'))
  end
  -- Raw Markdown avoids Pandoc's `{=html}` wrappers, which SiYuan does not parse.
  return pandoc.RawInline("markdown", table.concat(output)), false
end

return {{
  traverse = "topdown",
  Superscript = function(element) return text_marks(element, "sup") end,
  Subscript = function(element) return text_marks(element, "sub") end,
  Span = function(element)
    local color = span_color(element)
    if color then return text_marks(element, "", color) end
    element.attributes["custom-style"] = nil
    return element
  end,
  Div = function(element)
    if element.attributes["custom-style"] then return element.content end
  end,
  Figure = function(element)
    element.attributes["custom-style"] = nil
    return element
  end,
}}
