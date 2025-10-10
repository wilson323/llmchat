module.exports = {
  // 基础配置
  semi: true,                    // 分号
  trailingComma: 'es5',          // 尾随逗号
  singleQuote: true,             // 单引号
  printWidth: 100,               // 行宽限制
  tabWidth: 2,                   // 缩进宽度
  useTabs: false,                // 使用空格缩进
  quoteProps: 'as-needed',       // 对象属性引号
  bracketSpacing: true,          // 对象括号空格
  bracketSameLine: false,        // JSX括号换行
  arrowParens: 'avoid',          // 箭头函数参数括号
  endOfLine: 'lf',               // 行尾符

  // 文件特定配置
  overrides: [
    {
      files: '*.json',
      options: {
        printWidth: 120,
        tabWidth: 2
      }
    },
    {
      files: '*.md',
      options: {
        printWidth: 80,
        proseWrap: 'always'
      }
    },
    {
      files: '*.{yml,yaml}',
      options: {
        tabWidth: 2,
        singleQuote: false
      }
    },
    {
      files: '.{eslintrc,prettierrc}*',
      options: {
        parser: 'json'
      }
    }
  ],

  // 忽略文件 - 由.prettierignore处理
};