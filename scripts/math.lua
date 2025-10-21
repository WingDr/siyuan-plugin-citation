-- math.lua: 智能处理 LaTeX 数学环境的 Pandoc 过滤器

-- 定义需要特殊处理的 LaTeX 顶层环境
-- 英文注释: Define the top-level LaTeX environments that need special handling.
local top_level_envs = {
  ["align"] = true,
  ["align*"] = true,
  ["gather"] = true,
  ["gather*"] = true,
  ["flalign"] = true,
  ["flalign*"] = true,
  ["alignat"] = true,
  ["alignat*"] = true,
  ["multline"] = true,
  ["multline*"] = true,
  ["equation"] = true,
  ["equation*"] = true
}

-- 定义顶层环境到内部环境的映射 (用于 Word 输出)
-- 英文注释: Define the mapping from top-level to inner environments (for Word output).
local to_inner_map = {
  ["align"] = "aligned",
  ["align*"] = "aligned",
  ["gather"] = "gathered",
  ["gather*"] = "gathered",
  ["alignat"] = "alignedat",
  ["alignat*"] = "alignedat",
  ["equation"] = "aligned", -- 'equation' can be converted to 'aligned' for a single block
  ["equation*"] = "aligned",
  -- 注意：flalign 和 multline 没有标准的内部对应环境，所以它们在 Word 中可能仍然无法完美转换。
  -- Note: flalign and multline do not have standard inner equivalents, so they may still not convert perfectly to Word.
}

-- 过滤器主函数，处理数学元素
-- 英文注释: Main filter function to process Math elements.
function Math(math_block)
  -- 只处理块级公式 (DisplayMath)，忽略行内公式 (InlineMath)
  -- Only process display math, ignore inline math.
  if math_block.mathtype ~= 'DisplayMath' then
    return nil -- 不处理，使用默认行为 (Do nothing, use default behavior)
  end

  -- 提取公式内容，并去除前后的空格
  -- Extract math content and trim whitespace.
  local content = math_block.text:match("^%s*(.*%S)") or ""
  
  -- 从公式内容中匹配环境名称，例如 `\begin{align}` -> "align"
  -- Match the environment name from the content, e.g., `\begin{align}` -> "align"
  local env_name = content:match("^\\begin%{(.-)%}")

  -- 如果成功匹配到环境名，并且这个环境在我们的顶层环境列表中
  -- If an environment name is matched and it's in our list of top-level environments...
  if env_name and top_level_envs[env_name] then

    -- 检查输出格式是否为 Word
    -- Check if the output format is Word.
    if FORMAT:match 'docx' then
      -- 查找对应的内部环境名
      -- Look up the corresponding inner environment name.
      local inner_env = to_inner_map[env_name]
      if inner_env then
        -- 替换 \begin{...} 和 \end{...}
        -- Replace \begin{...} and \end{...}
        local new_content = content:gsub("(\\begin%{" .. env_name .. "%})", "\\begin{" .. inner_env .. "}")
        new_content = new_content:gsub("(\\end%{" .. env_name .. "%})", "\\end{" .. inner_env .. "}")
        math_block.text = new_content
        -- 返回修改后的公式块
        -- Return the modified math block.
        return math_block
      end

    -- 检查输出格式是否为 LaTeX 或 PDF
    -- Check if the output format is LaTeX or PDF.
    elseif FORMAT:match 'latex' or FORMAT == 'pdf' then
      -- 将整个块转换为 LaTeX 原生块 (RawBlock)
      -- 这可以防止 Pandoc 在外面包裹 \[...\]
      -- Convert the whole block to a LaTeX RawBlock.
      -- This prevents Pandoc from wrapping it in \[...\]
      return pandoc.RawBlock('latex', content)
    end
  end

  -- 对于所有其他情况，返回 nil，让 Pandoc 进行默认处理
  -- For all other cases, return nil to let Pandoc handle it by default.
  return nil
end