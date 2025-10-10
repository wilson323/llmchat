module.exports = {
  // TypeScript/JavaScript文件的处理
  '*.{js,jsx,ts,tsx}': [
    // 自动修复ESLint问题
    'eslint --fix --max-warnings=0',
    // 运行ESLint检查（不允许警告）
    'eslint --max-warnings=0',
    // 自动格式化Prettier
    'prettier --write',
    // 检查Prettier格式
    'prettier --check'
  ],

  // JSON文件处理
  '*.{json,jsonc}': [
    'prettier --write',
    'prettier --check'
  ],

  // Markdown文件处理
  '*.md': [
    'prettier --write',
    'prettier --check'
  ],

  // YAML文件处理
  '*.{yml,yaml}': [
    'prettier --write',
    'prettier --check'
  ],

  // 配置文件处理
  '.{eslintrc,prettierrc}*': [
    'prettier --write',
    'prettier --check'
  ],

  // 包管理文件特殊处理
  'package.json': [
    'prettier --write',
    'prettier --check',
    // 验证package.json格式
    'node -e "try { JSON.parse(require(\"fs\").readFileSync(0, \"utf8\")); console.log(\"✅ package.json is valid\"); } catch(e) { console.error(\"❌ Invalid package.json:\", e.message); process.exit(1); }"'
  ],

  // TypeScript声明文件
  '*.d.ts': [
    'prettier --write',
    'prettier --check',
    // TypeScript声明文件不需要运行ESLint
  ],

  // 忽略的文件类型（这些文件不会经过lint-staged处理）
  // 注意：这些文件应该通过.gitignore或其他方式排除
};