-- Map colored SiYuan spans to Word character styles without flattening links or math.
local function color_value(style)
  local value = (";" .. (style or "")):match(";%s*color%s*:%s*([^;]+)")
  if not value then return nil end
  value = value:lower():gsub("%s+", ""):gsub("!important$", "")
  local named = {red="FF0000", blue="0000FF", green="008000", black="000000", white="FFFFFF",
    yellow="FFFF00", orange="FFA500", purple="800080", gray="808080", grey="808080"}
  if named[value] then return named[value] end
  local hex = value:match("^#(%x%x%x%x%x%x)$")
  if hex then return hex:upper() end
  hex = value:match("^#(%x%x%x)$")
  if hex then return (hex:gsub(".", "%0%0")):upper() end
  local red, green, blue, alpha = value:match("^rgba?%((%d+),(%d+),(%d+),?([%d%.]*)%)$")
  if not red then return nil end
  local opacity = alpha ~= "" and tonumber(alpha) or 1
  opacity = math.max(0, math.min(1, opacity))
  local function channel(component)
    local number = math.max(0, math.min(255, tonumber(component)))
    return string.format("%02X", math.floor(number * opacity + 255 * (1 - opacity) + 0.5))
  end
  return channel(red) .. channel(green) .. channel(blue)
end

local constructors = {strong=pandoc.Strong, em=pandoc.Emph, u=pandoc.Underline,
  s=pandoc.Strikeout, sup=pandoc.Superscript, sub=pandoc.Subscript}

local function color_raw_runs(inlines, color)
  for _, inline in ipairs(inlines) do
    if inline.t == "RawInline" and inline.format == "openxml" then
      -- Zotero citation fields are raw runs, so Pandoc cannot apply a Span's
      -- character style to them. Set their color directly instead.
      inline.text = inline.text:gsub("<w:r>(.-)</w:r>", function(content)
        local property = '<w:color w:val="' .. color .. '"/>'
        if content:find("<w:rPr>", 1, true) then
          content = content:gsub('<w:color[^>]*/>', '')
          return '<w:r>' .. content:gsub('<w:rPr>', '<w:rPr>' .. property, 1) .. '</w:r>'
        end
        return '<w:r><w:rPr>' .. property .. '</w:rPr>' .. content .. '</w:r>'
      end)
    elseif inline.content then color_raw_runs(inline.content, color) end
  end
end

function Span(element)
  local types = {}
  for name in (element.attributes["data-type"] or ""):gmatch("%S+") do types[name] = true end
  local content = element.content
  if types.code then content = {pandoc.Code(pandoc.utils.stringify(content))} end
  for _, name in ipairs({"strong", "em", "u", "s", "sup", "sub"}) do
    if types[name] and constructors[name] then content = {constructors[name](content)} end
  end
  if types.a and element.attributes["data-href"] then
    content = {pandoc.Link(content, element.attributes["data-href"], element.attributes["data-title"] or "")}
  end
  local color = color_value(element.attributes.style)
  element.content = content
  if color then
    color_raw_runs(content, color)
    element.attributes["custom-style"] = "SiyuanExportColor_" .. color
  end
  element.attributes["data-type"] = nil
  return element
end

return {{traverse="topdown", Span=Span}}
