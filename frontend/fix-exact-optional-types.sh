#!/bin/bash

# 批量修复 exactOptionalPropertyTypes 错误的脚本
echo "开始修复 exactOptionalPropertyTypes 错误..."

# 找到所有需要修复的文件
files=$(grep -l "string | undefined" src/**/*.{ts,tsx} 2>/dev/null | head -20)
echo "找到需要修复的文件:"
echo "$files"

# 修复常见的模式
for file in $files; do
  echo "修复文件: $file"

  # 模式1: search: string | undefined -> search?: string
  sed -i.bak 's/search: string | undefined/search?: string/g' "$file"

  # 模式2: message: string | undefined -> message: string | undefined (已经正确)
  # 模式3: value: string | undefined -> value?: string (如果value是可选的)

  # 删除备份文件
  rm -f "$file.bak"
done

echo "批量修复完成！"