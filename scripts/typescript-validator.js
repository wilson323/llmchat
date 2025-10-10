#!/usr/bin/env node

/**
 * TypeScript Configuration Validator
 *
 * Validates TypeScript configuration for type safety compliance
 * and ensures all necessary strict checks are enabled.
 */

const fs = require('fs');
const path = require('path');

class TypeScriptValidator {
  constructor() {
    this.requiredOptions = {
      // Core strict options
      'strict': true,
      'noImplicitAny': true,
      'strictNullChecks': true,
      'strictFunctionTypes': true,
      'strictBindCallApply': true,
      'strictPropertyInitialization': true,
      'noImplicitThis': true,
      'alwaysStrict': true,

      // Additional safety options
      'noUncheckedIndexedAccess': true,
      'exactOptionalPropertyTypes': true,
      'noImplicitReturns': true,
      'noFallthroughCasesInSwitch': true,
      'noImplicitOverride': true,

      // Code quality options
      'allowUnusedLabels': false,
      'allowUnreachableCode': false,
      'forceConsistentCasingInFileNames': true
    };

    this.recommendedOptions = {
      'noImplicitReturns': true,
      'noImplicitOverride': true,
      'allowSyntheticDefaultImports': true,
      'esModuleInterop': true,
      'skipLibCheck': true,
      'forceConsistentCasingInFileNames': true
    };
  }

  /**
   * Validate TypeScript configuration file
   */
  validateConfig(configPath) {
    try {
      if (!fs.existsSync(configPath)) {
        return {
          valid: false,
          errors: [`Configuration file not found: ${configPath}`],
          warnings: []
        };
      }

      const configContent = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(configContent);
      const compilerOptions = config.compilerOptions || {};

      const validation = this.validateCompilerOptions(compilerOptions, configPath);

      return validation;
    } catch (error) {
      return {
        valid: false,
        errors: [`Failed to parse configuration: ${error.message}`],
        warnings: []
      };
    }
  }

  /**
   * Validate compiler options
   */
  validateCompilerOptions(options, configPath) {
    const errors = [];
    const warnings = [];
    const recommendations = [];

    // Check required options
    for (const [option, expectedValue] of Object.entries(this.requiredOptions)) {
      const actualValue = options[option];

      if (actualValue === undefined) {
        errors.push(`Missing required option: "${option}" should be set to ${expectedValue}`);
      } else if (actualValue !== expectedValue) {
        errors.push(`Invalid option: "${option}" is ${actualValue}, should be ${expectedValue}`);
      }
    }

    // Check recommended options
    for (const [option, expectedValue] of Object.entries(this.recommendedOptions)) {
      const actualValue = options[option];

      if (actualValue === undefined) {
        recommendations.push(`Consider adding: "${option}": ${expectedValue}`);
      } else if (actualValue !== expectedValue) {
        warnings.push(`Recommended: "${option}" is ${actualValue}, consider ${expectedValue}`);
      }
    }

    // Check for problematic options
    if (options.strict === false) {
      errors.push('Strict mode is disabled. This is a major type safety risk.');
    }

    if (options.noImplicitAny === false) {
      errors.push('noImplicitAny is disabled. This allows implicit any types.');
    }

    if (options.strictNullChecks === false) {
      errors.push('strictNullChecks is disabled. This allows null/undefined issues.');
    }

    // Check target configuration
    const validTargets = ['ES3', 'ES5', 'ES2015', 'ES2016', 'ES2017', 'ES2018', 'ES2019', 'ES2020', 'ES2021', 'ES2022'];
    if (options.target && !validTargets.includes(options.target)) {
      warnings.push(`Target "${options.target}" may not be optimal. Consider using ES2020 or later.`);
    }

    // Check module configuration
    if (options.module === 'none' && configPath.includes('backend')) {
      warnings.push('Module resolution set to "none" may cause issues with imports.');
    }

    // Check path resolution
    if (!options.baseUrl && options.paths) {
      errors.push('baseUrl is required when using paths mapping.');
    }

    // Check include/exclude patterns
    if (configPath.includes('backend')) {
      const configDir = path.dirname(configPath);
      if (!options.exclude || !options.exclude.some(pattern =>
        pattern.includes('node_modules') || pattern.includes('dist')
      )) {
        recommendations.push('Consider excluding node_modules and dist directories.');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      recommendations
    };
  }

  /**
   * Generate TypeScript configuration recommendations
   */
  generateRecommendations(configPath) {
    const validation = this.validateConfig(configPath);

    let recommendations = '';

    if (!validation.valid) {
      recommendations += '# ❌ Configuration Issues Found\n\n';
      recommendations += '## Errors (Must Fix)\n';
      validation.errors.forEach(error => {
        recommendations += `- ${error}\n`;
      });
      recommendations += '\n';
    }

    if (validation.warnings.length > 0) {
      recommendations += '# ⚠️ Configuration Warnings\n\n';
      validation.warnings.forEach(warning => {
        recommendations += `- ${warning}\n`;
      });
      recommendations += '\n';
    }

    if (validation.recommendations.length > 0) {
      recommendations += '# 💡 Recommendations\n\n';
      validation.recommendations.forEach(rec => {
        recommendations += `- ${rec}\n`;
      });
      recommendations += '\n';
    }

    // Add optimal configuration example
    recommendations += '# 📋 Optimal Configuration\n\n';
    recommendations += '```json\n';
    recommendations += JSON.stringify({
      compilerOptions: {
        ...this.requiredOptions,
        ...this.recommendedOptions,
        target: 'ES2020',
        lib: ['ES2020'],
        module: 'commonjs',
        moduleResolution: 'node',
        resolveJsonModule: true,
        declaration: true,
        declarationMap: true,
        sourceMap: true,
        removeComments: true,
        baseUrl: './src',
        paths: {
          '@/*': ['*']
        }
      }
    }, null, 2);
    recommendations += '\n```\n\n';

    // Add type safety checklist
    recommendations += '# 🔍 Type Safety Checklist\n\n';
    recommendations += '- [ ] Strict mode enabled\n';
    recommendations += '- [ ] No implicit any types\n';
    recommendations += '- [ ] Null checks enabled\n';
    recommendations += '- [ ] Function return types required\n';
    recommendations += '- [ ] No unchecked indexed access\n';
    recommendations += '- [ ] Exact optional properties\n';
    recommendations += '- [ ] No implicit returns\n';
    recommendations += '- [ ] No fallthrough cases\n';
    recommendations += '- [ ] No implicit override\n';
    recommendations += '- [ ] Consistent file naming\n\n';

    return recommendations;
  }

  /**
   * Validate all TypeScript configurations in the project
   */
  validateProject(rootDir = process.cwd()) {
    const configs = [
      path.join(rootDir, 'tsconfig.json'),
      path.join(rootDir, 'backend', 'tsconfig.json'),
      path.join(rootDir, 'frontend', 'tsconfig.json'),
      path.join(rootDir, 'shared-types', 'tsconfig.json')
    ];

    const results = [];
    let overallValid = true;

    for (const configPath of configs) {
      if (fs.existsSync(configPath)) {
        const relativePath = path.relative(rootDir, configPath);
        const validation = this.validateConfig(configPath);

        results.push({
          config: relativePath,
          ...validation
        });

        if (!validation.valid) {
          overallValid = false;
        }
      }
    }

    return {
      overallValid,
      results: results || []
    };
  }
}

// CLI interface
function main() {
  const args = process.argv.slice(2);
  const rootDir = args.find(arg => arg.startsWith('--root='))?.split('=')[1] || process.cwd();
  const generateRecommendations = args.includes('--recommendations');

  console.log('🔍 TypeScript Configuration Validator');
  console.log(`Project Root: ${rootDir}`);
  console.log('');

  const validator = new TypeScriptValidator();
  const validationResults = validator.validateProject(rootDir);
  const results = validationResults.results || [];

  // Display results
  console.log('📊 Validation Results');
  console.log('='.repeat(50));

  let hasErrors = false;

  for (const result of results) {
    console.log(`\n📁 ${result.config}`);
    console.log('  Status:', result.valid ? '✅ Valid' : '❌ Invalid');

    if (result.errors.length > 0) {
      hasErrors = true;
      console.log('  Errors:');
      result.errors.forEach(error => {
        console.log(`    ❌ ${error}`);
      });
    }

    if (result.warnings.length > 0) {
      console.log('  Warnings:');
      result.warnings.forEach(warning => {
        console.log(`    ⚠️  ${warning}`);
      });
    }

    if (result.recommendations.length > 0) {
      console.log('  Recommendations:');
      result.recommendations.forEach(rec => {
        console.log(`    💡 ${rec}`);
      });
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`Overall Status: ${validationResults.overallValid ? '✅ All Valid' : '❌ Issues Found'}`);

  // Generate recommendations if requested
  if (generateRecommendations || !validationResults.overallValid) {
    const mainConfig = path.join(rootDir, 'backend', 'tsconfig.json');
    if (fs.existsSync(mainConfig)) {
      const recommendations = validator.generateRecommendations(mainConfig);
      const reportPath = path.join(rootDir, 'typescript-recommendations.md');

      fs.writeFileSync(reportPath, recommendations);
      console.log(`\n📝 Detailed recommendations saved to: ${reportPath}`);
    }
  }

  // Exit with error code if validation failed
  if (!results.overallValid) {
    console.log('\n❌ TypeScript configuration validation failed.');
    console.log('Please fix the issues before proceeding.');
    process.exit(1);
  } else {
    console.log('\n✅ All TypeScript configurations are valid!');
  }
}

if (require.main === module) {
  main();
}

module.exports = { TypeScriptValidator };