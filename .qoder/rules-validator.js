#!/usr/bin/env node

/**
 * Qoder规则验证器
 * 验证项目是否符合Speckit和Qoder开发规则
 */

const fs = require('fs');
const path = require('path');

// 配置文件路径
const CONFIG_PATH = '.qoder/config.json';
const SPECKIT_DOCS_PATH = '.claude/specs/llmchat-platform';
const SPECIFY_PATH = '.specify';

// 加载配置
function loadConfig() {
  try {
    const configContent = fs.readFileSync(CONFIG_PATH, 'utf8');
    return JSON.parse(configContent);
  } catch (error) {
    console.error('❌ 无法加载Qoder配置文件:', error.message);
    process.exit(1);
  }
}

// 检查文件是否存在
function checkFileExists(filePath, description) {
  const fullPath = path.join(process.cwd(), filePath);
  if (fs.existsSync(fullPath)) {
    console.log(`✅ ${description} 存在`);
    return true;
  } else {
    console.log(`❌ ${description} 不存在`);
    return false;
  }
}

// 检查目录是否存在
function checkDirectoryExists(dirPath, description) {
  const fullPath = path.join(process.cwd(), dirPath);
  if (fs.existsSync(fullPath) && fs.lstatSync(fullPath).isDirectory()) {
    console.log(`✅ ${description} 存在`);
    return true;
  } else {
    console.log(`❌ ${description} 不存在`);
    return false;
  }
}

// 验证TypeScript架构规范
function validateTypeScriptArchitecture(config) {
  console.log('\n🔍 验证TypeScript架构规范...');

  let passed = true;

  // 检查单一真理源文件
  const { singleSourceOfTruth } = config.developmentRules.typeScript;
  if (singleSourceOfTruth) {
    Object.entries(singleSourceOfTruth).forEach(([key, filePath]) => {
      if (!checkFileExists(filePath, `${key} 文件`)) {
        passed = false;
      }
    });
  }

  // 检查禁止的文件模式
  const forbiddenPatterns = config.developmentRules.typeScript.forbiddenPatterns || [];
  forbiddenPatterns.forEach(pattern => {
    console.log(`⚠️  需要手动检查禁止模式: ${pattern}`);
  });

  // 检查P0错误配置
  const { p0Errors } = config.developmentRules.typeScript;
  if (p0Errors) {
    console.log(`✅ TypeScript P0错误配置: ${Object.keys(p0Errors).length} 个错误类型`);
  } else {
    console.log('❌ 缺少TypeScript P0错误配置');
    passed = false;
  }

  return passed;
}

// 验证Speckit规范
function validateSpeckit(config) {
  console.log('\n🔍 验证Speckit规范...');

  let passed = true;

  // 检查Speckit文档结构
  const { documentStructure } = config.developmentRules.speckit;
  if (documentStructure) {
    Object.entries(documentStructure).forEach(([docType, filePath]) => {
      if (!checkFileExists(filePath, `${docType} 文档`)) {
        passed = false;
      }
    });
  }

  // 检查单一真实来源
  const { singleSourceOfTruth } = config.developmentRules.speckit;
  if (singleSourceOfTruth) {
    Object.entries(singleSourceOfTruth).forEach(([sourceType, filePath]) => {
      if (!checkFileExists(filePath, `${sourceType} 单一真实来源`)) {
        passed = false;
      }
    });
  }

  // 检查Speckit验证脚本目录
  if (
    !checkDirectoryExists(config.developmentRules.speckit.validation.scripts, 'Speckit验证脚本目录')
  ) {
    passed = false;
  }

  // 检查.specify目录
  if (!checkDirectoryExists(SPECIFY_PATH, 'Speckit规范目录 (.specify)')) {
    passed = false;
  }

  return passed;
}

// 验证企业级安全准则
function validateEnterpriseSecurity(config) {
  console.log('\n🔍 验证企业级安全准则...');

  let passed = true;

  const { enterpriseSecurity } = config.developmentRules;
  if (!enterpriseSecurity || !enterpriseSecurity.enabled) {
    console.log('❌ 企业级安全准则未启用');
    return false;
  }

  // 检查禁止的操作
  const { forbiddenOperations } = enterpriseSecurity;
  if (forbiddenOperations && forbiddenOperations.length > 0) {
    console.log(`✅ 禁止操作配置: ${forbiddenOperations.length} 项`);
  } else {
    console.log('❌ 缺少禁止操作配置');
    passed = false;
  }

  // 检查安全的替代方案
  const { safeAlternatives } = enterpriseSecurity;
  if (safeAlternatives && safeAlternatives.length > 0) {
    console.log(`✅ 安全替代方案配置: ${safeAlternatives.length} 项`);
  } else {
    console.log('❌ 缺少安全替代方案配置');
    passed = false;
  }

  // 检查安全验证脚本
  if (!checkDirectoryExists(enterpriseSecurity.validation.scripts, '企业级安全验证脚本目录')) {
    passed = false;
  }

  return passed;
}

// 验证质量门禁
function validateQualityGates(config) {
  console.log('\n🔍 验证质量门禁...');

  let passed = true;

  // 检查TypeScript质量门禁
  const { typeScript } = config.qualityGates;
  if (typeScript) {
    console.log(`✅ TypeScript质量门禁配置: 零容忍=${typeScript.zeroTolerance}`);

    // 检查P0错误配置
    const { p0Errors } = typeScript;
    if (p0Errors) {
      console.log(`✅ TypeScript P0错误配置: ${Object.keys(p0Errors).length} 个错误类型`);
    } else {
      console.log('❌ 缺少TypeScript P0错误配置');
      passed = false;
    }
  } else {
    console.log('❌ 缺少TypeScript质量门禁配置');
    passed = false;
  }

  // 检查测试覆盖率配置
  const { testing } = config.qualityGates;
  if (testing) {
    console.log(
      `✅ 测试覆盖率配置: 单元测试${testing.unitTestCoverage}%, 集成测试${testing.integrationTestCoverage}%`
    );
  } else {
    console.log('❌ 缺少测试覆盖率配置');
    passed = false;
  }

  return passed;
}

// 验证代码标准
function validateCodeStandards(config) {
  console.log('\n🔍 验证代码标准...');

  let passed = true;

  // 检查命名规范
  const { namingConventions } = config.codeStandards;
  if (namingConventions) {
    console.log('✅ 命名规范配置存在');
  } else {
    console.log('❌ 缺少命名规范配置');
    passed = false;
  }

  // 检查组件模式
  const { componentPatterns } = config.codeStandards;
  if (componentPatterns) {
    console.log('✅ 组件模式配置存在');
  } else {
    console.log('❌ 缺少组件模式配置');
    passed = false;
  }

  return passed;
}

// 验证自动化配置
function validateAutomation(config) {
  console.log('\n🔍 验证自动化配置...');

  let passed = true;

  // 检查预提交钩子配置
  const { preCommit } = config.automation;
  if (preCommit) {
    console.log('✅ 预提交钩子配置存在');
  } else {
    console.log('❌ 缺少预提交钩子配置');
    passed = false;
  }

  // 检查CI配置
  const { ci } = config.automation;
  if (ci) {
    console.log('✅ CI配置存在');
  } else {
    console.log('❌ 缺少CI配置');
    passed = false;
  }

  return passed;
}

// 主函数
function main() {
  console.log('🚀 Qoder规则验证器启动...\n');

  // 加载配置
  const config = loadConfig();

  // 执行各项验证
  const validations = [
    validateTypeScriptArchitecture(config),
    validateSpeckit(config),
    validateEnterpriseSecurity(config),
    validateQualityGates(config),
    validateCodeStandards(config),
    validateAutomation(config),
  ];

  // 汇总结果
  const allPassed = validations.every(result => result);

  console.log('\n📊 验证结果汇总:');
  console.log(`总共检查: ${validations.length} 项`);
  console.log(`通过: ${validations.filter(r => r).length} 项`);
  console.log(`失败: ${validations.filter(r => !r).length} 项`);

  if (allPassed) {
    console.log('\n🎉 所有规则验证通过！项目符合Qoder和Speckit开发规范。');
    process.exit(0);
  } else {
    console.log('\n⚠️  部分规则验证失败，请根据上述提示修复问题。');
    process.exit(1);
  }
}

// 执行主函数
main();
