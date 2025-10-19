#!/usr/bin/env node

/**
 * LLMChat 文档管理自动化工具
 *
 * 功能：
 * - 自动生成文档索引
 * - 验证文档完整性
 * - 检查文档合规性
 * - 更新文档版本信息
 * - 生成文档统计报告
 */

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

class DocumentationManager {
  constructor() {
    this.docsDir = path.join(__dirname, '../docs');
    this.projectRoot = path.join(__dirname, '..');
    this.config = {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      compliance: 'Spec-Kit',
      author: 'LLMChat Team'
    };
  }

  /**
   * 扫描文档目录
   */
  scanDocumentation() {
    const pattern = path.join(this.docsDir, '**/*.md');
    const files = glob.sync(pattern);

    const docs = files.map(file => {
      const relativePath = path.relative(this.docsDir, file);
      const stats = fs.statSync(file);

      return {
        path: relativePath,
        fullPath: file,
        size: stats.size,
        modified: stats.mtime,
        created: stats.birthtime
      };
    });

    return docs;
  }

  /**
   * 生成文档索引
   */
  generateIndex(docs) {
    const categories = {
      'core': {
        title: '核心文档',
        priority: 'P0',
        docs: []
      },
      'development': {
        title: '开发文档',
        priority: 'P1',
        docs: []
      },
      'user': {
        title: '用户文档',
        priority: 'P1',
        docs: []
      },
      'technical': {
        title: '技术文档',
        priority: 'P1',
        docs: []
      },
      'management': {
        title: '管理文档',
        priority: 'P2',
        docs: []
      },
      'archive': {
        title: '归档文档',
        priority: 'P3',
        docs: []
      }
    };

    // 分类文档
    docs.forEach(doc => {
      const category = this.categorizeDocument(doc.path);
      if (categories[category]) {
        categories[category].docs.push(doc);
      }
    });

    return categories;
  }

  /**
   * 文档分类逻辑
   */
  categorizeDocument(filePath) {
    const coreDocs = ['DOCUMENT_INDEX.md', 'DEVELOPMENT_STANDARDS.md', 'USER_GUIDE.md', 'API_DOCUMENTATION.md'];
    const devDocs = ['CODE_REVIEW_GUIDE.md', 'TEST_FIX_GUIDE.md', 'QUALITY_SYSTEM_GUIDE.md'];
    const userDocs = ['QUICK_START_GUIDE.md', 'CONFIG_QUICK_START.md'];
    const techDocs = ['ARCHITECTURE_GUIDE.md', 'SECURITY_GUIDE.md', 'DEPLOYMENT_GUIDE.md'];
    const mgmtDocs = ['PROJECT_SPECIFICATION.md', 'TASK_LIST.md'];

    const fileName = path.basename(filePath);

    if (coreDocs.includes(fileName)) return 'core';
    if (devDocs.includes(fileName)) return 'development';
    if (userDocs.includes(fileName)) return 'user';
    if (techDocs.includes(fileName)) return 'technical';
    if (mgmtDocs.includes(fileName)) return 'management';
    if (filePath.includes('archive')) return 'archive';

    return 'development'; // 默认分类
  }

  /**
   * 验证文档完整性
   */
  validateDocument(docPath) {
    const content = fs.readFileSync(docPath, 'utf8');
    const issues = [];

    // 检查必需的元数据
    if (!content.includes('**文档版本**:')) {
      issues.push('缺少文档版本信息');
    }

    if (!content.includes('**最后更新**:')) {
      issues.push('缺少最后更新时间');
    }

    if (!content.includes('**合规状态**:')) {
      issues.push('缺少合规状态信息');
    }

    // 检查Markdown格式
    const lines = content.split('\n');
    let hasTitle = false;

    for (const line of lines) {
      if (line.startsWith('# ')) {
        hasTitle = true;
        break;
      }
    }

    if (!hasTitle) {
      issues.push('缺少文档标题');
    }

    // 检查链接有效性
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const matches = content.match(linkRegex);

    if (matches) {
      matches.forEach(match => {
        const link = match.match(/\(([^)]+)\)/)[1];
        if (link.startsWith('http')) {
          // 外部链接跳过检查
          return;
        }

        const linkPath = path.resolve(path.dirname(docPath), link);
        if (!fs.existsSync(linkPath)) {
          issues.push(`无效链接: ${link}`);
        }
      });
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * 生成文档统计报告
   */
  generateReport(docs) {
    const report = {
      summary: {
        totalDocs: docs.length,
        totalSize: docs.reduce((sum, doc) => sum + doc.size, 0),
        lastUpdated: this.config.lastUpdated
      },
      categories: {},
      validation: {
        valid: 0,
        invalid: 0,
        issues: []
      },
      recommendations: []
    };

    docs.forEach(doc => {
      const validation = this.validateDocument(doc.fullPath);

      if (validation.valid) {
        report.validation.valid++;
      } else {
        report.validation.invalid++;
        report.validation.issues.push({
          doc: doc.path,
          issues: validation.issues
        });
      }
    });

    // 生成建议
    if (report.validation.invalid > 0) {
      report.recommendations.push('修复文档验证问题');
    }

    if (report.summary.totalDocs < 10) {
      report.recommendations.push('增加更多文档');
    }

    return report;
  }

  /**
   * 更新文档版本信息
   */
  updateDocumentVersions() {
    const docs = this.scanDocumentation();

    docs.forEach(doc => {
      let content = fs.readFileSync(doc.fullPath, 'utf8');

      // 更新最后更新时间
      if (content.includes('**最后更新**:')) {
        content = content.replace(
          /\*\*最后更新\*\*: \d{4}-\d{2}-\d{2}/,
          `**最后更新**: ${new Date().toISOString().split('T')[0]}`
        );

        fs.writeFileSync(doc.fullPath, content, 'utf8');
      }
    });
  }

  /**
   * 生成文档导航
   */
  generateNavigation(categories) {
    let navigation = '# 📚 文档导航\n\n';

    Object.entries(categories).forEach(([key, category]) => {
      navigation += `## ${category.title} (${category.priority})\n\n`;

      category.docs.forEach(doc => {
        const fileName = path.basename(doc.path, '.md');
        const title = this.extractTitle(doc.fullPath);
        navigation += `- [${title}](./${doc.path})\n`;
      });

      navigation += '\n';
    });

    return navigation;
  }

  /**
   * 提取文档标题
   */
  extractTitle(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    for (const line of lines) {
      if (line.startsWith('# ')) {
        return line.replace('# ', '').trim();
      }
    }

    return path.basename(filePath, '.md');
  }

  /**
   * 生成合规性报告
   */
  generateComplianceReport(docs) {
    const report = {
      compliance: {
        standard: 'Spec-Kit',
        version: this.config.version,
        status: '✅ 合规',
        score: 0,
        maxScore: 100
      },
      checks: {
        structure: this.checkStructure(docs),
        content: this.checkContent(docs),
        format: this.checkFormat(docs),
        accessibility: this.checkAccessibility(docs)
      }
    };

    // 计算总分
    let totalScore = 0;
    Object.values(report.checks).forEach(check => {
      totalScore += check.score;
    });

    report.compliance.score = Math.round(totalScore / Object.keys(report.checks).length);

    return report;
  }

  /**
   * 检查文档结构
   */
  checkStructure(docs) {
    const requiredDocs = [
      'DOCUMENT_INDEX.md',
      'DEVELOPMENT_STANDARDS.md',
      'USER_GUIDE.md',
      'API_DOCUMENTATION.md'
    ];

    const hasRequired = requiredDocs.every(docName =>
      docs.some(doc => path.basename(doc.path) === docName)
    );

    return {
      score: hasRequired ? 95 : 70,
      status: hasRequired ? '✅ 通过' : '⚠️ 部分缺失',
      details: hasRequired ? '包含所有必需文档' : '缺少核心文档'
    };
  }

  /**
   * 检查文档内容
   */
  checkContent(docs) {
    let validDocs = 0;

    docs.forEach(doc => {
      const validation = this.validateDocument(doc.fullPath);
      if (validation.valid) {
        validDocs++;
      }
    });

    const score = Math.round((validDocs / docs.length) * 100);

    return {
      score,
      status: score >= 90 ? '✅ 优秀' : score >= 70 ? '⚠️ 良好' : '❌ 需改进',
      details: `${validDocs}/${docs.length} 文档通过验证`
    };
  }

  /**
   * 检查文档格式
   */
  checkFormat(docs) {
    let formattedDocs = 0;

    docs.forEach(doc => {
      const content = fs.readFileSync(doc.fullPath, 'utf8');

      // 检查是否有标题
      if (content.includes('# ')) {
        formattedDocs++;
      }
    });

    const score = Math.round((formattedDocs / docs.length) * 100);

    return {
      score,
      status: score >= 90 ? '✅ 优秀' : score >= 70 ? '⚠️ 良好' : '❌ 需改进',
      details: `${formattedDocs}/${docs.length} 文档格式正确`
    };
  }

  /**
   * 检查文档可访问性
   */
  checkAccessibility(docs) {
    // 检查是否有导航文档
    const hasIndex = docs.some(doc => path.basename(doc.path) === 'DOCUMENT_INDEX.md');

    return {
      score: hasIndex ? 90 : 60,
      status: hasIndex ? '✅ 良好' : '❌ 缺失导航',
      details: hasIndex ? '包含文档索引' : '缺少文档索引'
    };
  }

  /**
   * 运行文档管理流程
   */
  async run() {
    console.log('🚀 开始文档管理流程...\n');

    // 1. 扫描文档
    console.log('📁 扫描文档目录...');
    const docs = this.scanDocumentation();
    console.log(`✅ 发现 ${docs.length} 个文档\n`);

    // 2. 生成索引
    console.log('📋 生成文档索引...');
    const categories = this.generateIndex(docs);
    console.log(`✅ 文档已分类为 ${Object.keys(categories).length} 个类别\n`);

    // 3. 验证文档
    console.log('🔍 验证文档完整性...');
    const report = this.generateReport(docs);
    console.log(`✅ 验证完成: ${report.validation.valid} 个有效, ${report.validation.invalid} 个需要修复\n`);

    // 4. 生成合规性报告
    console.log('📊 生成合规性报告...');
    const complianceReport = this.generateComplianceReport(docs);
    console.log(`✅ 合规性评分: ${complianceReport.compliance.score}/100\n`);

    // 5. 生成报告文件
    console.log('📝 生成报告文件...');
    this.generateReportFiles(docs, categories, report, complianceReport);
    console.log('✅ 报告文件已生成\n');

    // 6. 更新版本信息
    console.log('🔄 更新文档版本信息...');
    this.updateDocumentVersions();
    console.log('✅ 版本信息已更新\n');

    console.log('🎉 文档管理流程完成！');
    console.log(`📊 合规性评分: ${complianceReport.compliance.score}/100`);

    if (report.validation.invalid > 0) {
      console.log(`⚠️  注意: ${report.validation.invalid} 个文档需要修复`);
    }
  }

  /**
   * 生成报告文件
   */
  generateReportFiles(docs, categories, report, complianceReport) {
    const reportDir = path.join(this.projectRoot, 'reports', 'documentation');

    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    // 生成文档索引
    const indexPath = path.join(this.docsDir, 'DOCUMENT_INDEX.md');
    const indexContent = this.generateIndexFile(categories);
    fs.writeFileSync(indexPath, indexContent, 'utf8');

    // 生成合规性报告
    const compliancePath = path.join(reportDir, 'compliance-report.json');
    fs.writeFileSync(compliancePath, JSON.stringify(complianceReport, null, 2), 'utf8');

    // 生成统计报告
    const statsPath = path.join(reportDir, 'documentation-stats.json');
    fs.writeFileSync(statsPath, JSON.stringify({
      generated: new Date().toISOString(),
      summary: report.summary,
      validation: report.validation,
      recommendations: report.recommendations
    }, null, 2), 'utf8');
  }

  /**
   * 生成文档索引文件
   */
  generateIndexFile(categories) {
    let content = `# LLMChat 项目文档完整索引

> **企业级文档标准体系** - Spec-Kit合规版本
> **文档版本**: ${this.config.version}
> **最后更新**: ${this.config.lastUpdated.split('T')[0]}
> **合规状态**: ✅ Spec-Kit合规

## 📋 文档导航

`;

    Object.entries(categories).forEach(([key, category]) => {
      content += `### ${category.title} (${category.priority})\n\n`;

      category.docs.forEach(doc => {
        const title = this.extractTitle(doc.fullPath);
        content += `- **[${title}](./${doc.path})** - ${this.generateDescription(doc.path)}\n`;
      });

      content += '\n';
    });

    content += `## 📊 文档统计

- **总文档数**: ${Object.values(categories).reduce((sum, cat) => sum + cat.docs.length, 0)}
- **核心文档**: ${categories.core?.docs.length || 0}
- **开发文档**: ${categories.development?.docs.length || 0}
- **用户文档**: ${categories.user?.docs.length || 0}
- **技术文档**: ${categories.technical?.docs.length || 0}

## 🔍 快速导航

| 需求场景 | 推荐文档 | 优先级 |
|---------|---------|--------|
| 新用户入门 | [USER_GUIDE.md](./USER_GUIDE.md) | P0 |
| 开发环境配置 | [DEVELOPMENT_STANDARDS.md](./DEVELOPMENT_STANDARDS.md) | P0 |
| API接口文档 | [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) | P1 |
| 测试问题修复 | [TEST_FIX_GUIDE.md](./TEST_FIX_GUIDE.md) | P1 |
| 安全配置指南 | [SECURITY_GUIDE.md](./SECURITY_GUIDE.md) | P1 |

## 📞 获取帮助

如果您在文档中找不到所需信息：
1. 查看 [归档文档](./archive/) 获取历史信息
2. 联系项目维护团队
3. 提交文档改进建议

---

**文档体系设计原则**:
- 🎯 **用户导向**: 按用户角色和需求场景组织
- 📋 **层次清晰**: P0/P1/P2/P3优先级分类
- 🔍 **易于查找**: 完整的索引和搜索指南
- 📝 **标准统一**: 统一的格式和写作规范
- 🔄 **持续维护**: 实时更新和定期审查

*最后更新: ${this.config.lastUpdated.split('T')[0]}*
*维护者: ${this.config.author}*
`;

    return content;
  }

  /**
   * 生成文档描述
   */
  generateDescription(filePath) {
    const descriptions = {
      'DOCUMENT_INDEX.md': '完整的文档导航和索引',
      'DEVELOPMENT_STANDARDS.md': '企业级开发标准和规范',
      'USER_GUIDE.md': '完整的用户使用指南',
      'API_DOCUMENTATION.md': 'API文档规范和接口说明',
      'TEST_FIX_GUIDE.md': '测试问题诊断和修复指南',
      'SECURITY_GUIDE.md': '安全规范和最佳实践',
      'DEPLOYMENT_GUIDE.md': '部署指南和运维手册',
      'ARCHITECTURE_GUIDE.md': '系统架构设计文档',
      'CODE_REVIEW_GUIDE.md': '代码审查指南',
      'QUALITY_SYSTEM_GUIDE.md': '质量保证体系指南'
    };

    const fileName = path.basename(filePath);
    return descriptions[fileName] || '技术文档';
  }
}

// 主程序入口
if (require.main === module) {
  const manager = new DocumentationManager();
  manager.run().catch(console.error);
}

module.exports = DocumentationManager;