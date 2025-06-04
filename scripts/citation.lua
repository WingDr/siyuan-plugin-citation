function Citation(el)
    local cite_pattern = "@siyuan_cite{([^}]+)}"
    local name_pattern = "@siyuan_name{([^}]+)}"
    if el.text:match(cite_pattern) then
        if el.text:match(name_pattern) then
            print(el.text)
            local cite_match = el.text:match(cite_pattern)
            -- 用逗号分割id，添加上前后缀，然后再用逗号拼接
            local ids = {}
            for id in string.gmatch(cite_match, "[^,]+") do
                table.insert(ids, '{"id":' .. id .. '}')
            end
            local cite_result = table.concat(ids, ",")
            print(cite_result)
            local name_match = el.text:match(name_pattern)
            return pandoc.RawInline("openxml", '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve">ADDIN ZOTERO_ITEM CSL_CITATION {"citationItems":['.. cite_result .. ']}</w:instrText></w:r><w:r><w:fldChar w:fldCharType=\"separate\"/></w:r><w:r><w:t>' .. name_match .. '</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>')
        end
    end
end



-- Handler for Figure blocks (which may contain images)
function Figure(fig)
    -- A Pandoc Lua filter to set image title as caption
    -- Format: ![alt](src "title")
    -- Check if the figure has an image
    for i, block in ipairs(fig.content) do
        if block.t == "Plain" then
            for j, inline in ipairs(block.content) do
                if inline.t == "Image" then
                    -- Process the image
                    local processed_image = process_image(inline)
                    -- Update the image in the figure
                    block.content[j] = processed_image
                    
                    -- Also update the figure caption
                    if processed_image.caption and #processed_image.caption > 0 then
                        -- Extract the caption text
                        local caption_text = pandoc.utils.stringify(processed_image.caption)
                        -- Update the figure caption
                        fig.caption = create_caption(caption_text)
                    end
                end
            end
        end
    end
    
    return fig
end

-- Handler for standalone images
function Image(img)
    return process_image(img)
end

-- Function to create a new caption from text
function create_caption(text)
    -- For simple captions, we can just use a Str element
    if text:find("^%s*$") then
        -- Empty caption
        return {}
    else
        -- Non-empty caption
        return {pandoc.Str(text)}
    end
end

-- Function to process the image and set title as caption
function process_image(img)

    -- Check if title exists and is not empty
    if img.title and img.title ~= "" then
        print("Setting image caption for: " .. img.title)
        -- Set the title as the image caption
        img.caption = create_caption(img.title)
        
        -- Clear the title to avoid duplication
        img.title = ""
        
        -- Return the modified image
        return img
    end
    
    -- If no title, return the image unchanged
    return img
end


-- Return the filter
return {
    { Str = Citation },
    {Image = Image}, {Figure = Figure}
}
