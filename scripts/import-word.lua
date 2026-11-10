-- Preserve Word colors and scripts with SiYuan's native text marks.
local mark_types = {
  Strong = "strong", Emph = "em", Underline = "u", Strikeout = "s",
  Superscript = "sup", Subscript = "sub", Code = "code",
}

local function escape_html(text)
  return text:gsub("&", "&amp;"):gsub("<", "&lt;"):gsub(">", "&gt;"):gsub('"', "&quot;")
end

local function numbered_bibliography_entry(block)
  if block.t ~= "Div" or (block.attributes["custom-style"] or ""):lower() ~= "bibliography" then return nil end
  if #block.content ~= 1 or (block.content[1].t ~= "Para" and block.content[1].t ~= "Plain") then return nil end
  local paragraph = block.content[1]:clone()
  local original = pandoc.utils.stringify(paragraph.content)
  local text = original
  -- Zotero can prefix its first bibliography number with an invisible joiner.
  while true do
    local before = text
    text = text:gsub("^%s+", "")
    for _, codepoint in ipairs({0x200B, 0x200C, 0x200D, 0xFEFF}) do
      text = text:gsub("^" .. utf8.char(codepoint), "")
    end
    if text == before then break end
  end
  local number, remaining = text:match("^(%d+)[%.)]%s+(.+)$")
  if not number then number, remaining = text:match("^%[(%d+)%]%s+(.+)$") end
  if not number then return nil end
  local prefix_bytes = #original - #remaining

  -- Remove the displayed number across runs/spans, preserving the entry's markup.
  local function strip_prefix(inlines)
    local result = pandoc.Inlines({})
    for _, inline in ipairs(inlines) do
      if prefix_bytes == 0 then
        result:insert(inline)
      elseif inline.t == "Str" then
        local count = math.min(prefix_bytes, #inline.text)
        inline.text = inline.text:sub(count + 1)
        prefix_bytes = prefix_bytes - count
        if inline.text ~= "" then result:insert(inline) end
      elseif inline.t == "Space" or inline.t == "SoftBreak" then
        prefix_bytes = prefix_bytes - 1
      elseif inline.content then
        inline.content = strip_prefix(inline.content)
        if #inline.content > 0 then result:insert(inline) end
      else
        result:insert(inline)
      end
    end
    return result
  end
  paragraph.content = strip_prefix(paragraph.content)
  if prefix_bytes ~= 0 then return nil end
  return {number = tonumber(number), blocks = {paragraph}}
end

local function bibliography_lists(blocks)
  local result = pandoc.Blocks({})
  local items, first, last = {}, nil, nil
  local function flush()
    if #items > 0 then
      result:insert(pandoc.OrderedList(items, pandoc.ListAttributes(first, "Decimal", "Period")))
      items, first, last = {}, nil, nil
    end
  end
  for _, block in ipairs(blocks) do
    local entry = numbered_bibliography_entry(block)
    if entry then
      if last and entry.number ~= last + 1 then flush() end
      first = first or entry.number
      last = entry.number
      table.insert(items, entry.blocks)
    else
      flush()
      result:insert(block)
    end
  end
  flush()
  return result
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

return {{Blocks = bibliography_lists}, {
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
