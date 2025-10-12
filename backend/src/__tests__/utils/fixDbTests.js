/**
 * 修复数据库集成测试脚本
 * 将email字段替换为username字段，匹配现有数据库结构
 */

const fs = require('fs');
const path = require('path');

const testFiles = [
  'src/__tests__/integration/database.integration.test.ts',
  'src/__tests__/integration/databaseMigration.integration.test.ts',
  'src/__tests__/integration/databasePerformance.integration.test.ts'
];

function fixFile(filePath) {
  console.log(`修复文件: ${filePath}`);

  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // 替换INSERT语句中的email字段
  const emailInsertRegex = /'INSERT INTO users \([^)]*email[^)]*\) VALUES \([^)]*\)/g;
  content = content.replace(emailInsertRegex, (match) => {
    modified = true;
    return match.replace(/email/g, 'username')
               .replace(/password_hash/g, 'password_salt, password_hash')
               .replace(/'[^']*@[^']*'/g, "'testuser-' + Date.now() + "'")
               .replace(/\('([^']*hashed_password[^']*)'\)/, "('testsalt'.repeat(8), '$1')");
  });

  // 替换assertExists中的email条件
  const emailAssertRegex = /assertExists\('users', '([^)]*email[^)]*)'/g;
  content = content.replace(emailAssertRegex, (match, condition) => {
    modified = true;
    return `assertExists('users', '${condition.replace(/email/g, 'username')}')`;
  });

  // 替换assertNotExists中的email条件
  const emailNotAssertRegex = /assertNotExists\('users', '([^)]*email[^)]*)'/g;
  content = content.replace(emailNotAssertRegex, (match, condition) => {
    modified = true;
    return `assertNotExists('users', '${condition.replace(/email/g, 'username')}')`;
  });

  // 替换UPDATE语句中的email字段
  const emailUpdateRegex = /UPDATE users SET email = \$1/g;
  content = content.replace(emailUpdateRegex, 'UPDATE users SET username = $1');

  // 替换full_name为role
  const fullNameRegex = /full_name/g;
  content = content.replace(fullNameRegex, 'role');

  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`  ✓ 已修复 ${filePath}`);
  } else {
    console.log(`  - 无需修复 ${filePath}`);
  }
}

// 修复所有测试文件
testFiles.forEach(fixFile);

console.log('\n数据库集成测试修复完成！');