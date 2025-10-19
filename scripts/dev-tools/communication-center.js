#!/usr/bin/env node

/**
 * LLMChat 团队沟通中心
 * 团队通知、消息同步、沟通协调等功能
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// 项目根目录
const projectRoot = join(__dirname, '../..');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  log(`\n💬 ${title}`, 'cyan');
  log('─'.repeat(60), 'blue');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// 团队通知系统
class NotificationSystem {
  constructor() {
    this.channels = {
      email: {
        enabled: false,
        config: {}
      },
      slack: {
        enabled: false,
        webhook: '',
        config: {}
      },
      discord: {
        enabled: false,
        webhook: '',
        config: {}
      },
      teams: {
        enabled: false,
        webhook: '',
        config: {}
      }
    };
  }

  async sendNotification(type, title, message, options = {}) {
    const notification = {
      type,
      title,
      message,
      timestamp: new Date().toISOString(),
      priority: options.priority || 'normal',
      channel: options.channel || 'all'
    };

    // 保存通知记录
    this.saveNotification(notification);

    // 发送到各个渠道
    const results = [];

    if (notification.channel === 'all' || notification.channel === 'email') {
      if (this.channels.email.enabled) {
        results.push(await this.sendEmail(notification));
      }
    }

    if (notification.channel === 'all' || notification.channel === 'slack') {
      if (this.channels.slack.enabled) {
        results.push(await this.sendSlack(notification));
      }
    }

    if (notification.channel === 'all' || notification.channel === 'discord') {
      if (this.channels.discord.enabled) {
        results.push(await this.sendDiscord(notification));
      }
    }

    if (notification.channel === 'all' || notification.channel === 'teams') {
      if (this.channels.teams.enabled) {
        results.push(await this.sendTeams(notification));
      }
    }

    return results;
  }

  saveNotification(notification) {
    const notificationsPath = join(projectRoot, '.team/notifications');
    if (!existsSync(notificationsPath)) {
      mkdirSync(notificationsPath, { recursive: true });
    }

    const notificationFile = join(notificationsPath, `${Date.now()}.json`);
    writeFileSync(notificationFile, JSON.stringify(notification, null, 2));
  }

  async sendEmail(notification) {
    log(`发送邮件通知: ${notification.title}`, 'blue');

    // 这里可以集成邮件发送服务
    // 例如：使用 nodemailer、SendGrid 等

    return {
      channel: 'email',
      status: 'success',
      message: '邮件通知发送成功'
    };
  }

  async sendSlack(notification) {
    log(`发送 Slack 通知: ${notification.title}`, 'blue');

    try {
      const webhook = this.channels.slack.webhook;
      if (!webhook) {
        throw new Error('Slack webhook 未配置');
      }

      const payload = {
        text: notification.title,
        attachments: [{
          color: this.getPriorityColor(notification.priority),
          fields: [{
            title: '消息',
            value: notification.message,
            short: false
          }, {
            title: '时间',
            value: new Date(notification.timestamp).toLocaleString(),
            short: true
          }, {
            title: '类型',
            value: notification.type,
            short: true
          }]
        }]
      };

      // 这里应该发送 HTTP 请求到 Slack webhook
      // 由于这是示例，我们只是模拟

      return {
        channel: 'slack',
        status: 'success',
        message: 'Slack 通知发送成功'
      };
    } catch (error) {
      return {
        channel: 'slack',
        status: 'error',
        message: error.message
      };
    }
  }

  async sendDiscord(notification) {
    log(`发送 Discord 通知: ${notification.title}`, 'blue');

    try {
      const webhook = this.channels.discord.webhook;
      if (!webhook) {
        throw new Error('Discord webhook 未配置');
      }

      const payload = {
        embeds: [{
          title: notification.title,
          description: notification.message,
          color: this.getDiscordColor(notification.priority),
          timestamp: notification.timestamp,
          footer: {
            text: 'LLMChat 团队通知'
          }
        }]
      };

      // 这里应该发送 HTTP 请求到 Discord webhook

      return {
        channel: 'discord',
        status: 'success',
        message: 'Discord 通知发送成功'
      };
    } catch (error) {
      return {
        channel: 'discord',
        status: 'error',
        message: error.message
      };
    }
  }

  async sendTeams(notification) {
    log(`发送 Teams 通知: ${notification.title}`, 'blue');

    try {
      const webhook = this.channels.teams.webhook;
      if (!webhook) {
        throw new Error('Teams webhook 未配置');
      }

      const payload = {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "themeColor": this.getTeamsColor(notification.priority),
        "summary": notification.title,
        "sections": [{
          "activityTitle": notification.title,
          "activitySubtitle": notification.type,
          "text": notification.message,
          "facts": [{
            "name": "时间",
            "value": new Date(notification.timestamp).toLocaleString()
          }],
          "markdown": true
        }]
      };

      // 这里应该发送 HTTP 请求到 Teams webhook

      return {
        channel: 'teams',
        status: 'success',
        message: 'Teams 通知发送成功'
      };
    } catch (error) {
      return {
        channel: 'teams',
        status: 'error',
        message: error.message
      };
    }
  }

  getPriorityColor(priority) {
    const colors = {
      low: '#36a64f',      // 绿色
      normal: '#3aa3e3',   // 蓝色
      high: '#ff9500',     // 橙色
      urgent: '#ff0000'    // 红色
    };
    return colors[priority] || colors.normal;
  }

  getDiscordColor(priority) {
    const colors = {
      low: 0x36a64f,       // 绿色
      normal: 0x3aa3e3,    // 蓝色
      high: 0xff9500,      // 橙色
      urgent: 0xff0000     // 红色
    };
    return colors[priority] || colors.normal;
  }

  getTeamsColor(priority) {
    const colors = {
      low: '36A64F',        // 绿色
      normal: '3AA3E3',     // 蓝色
      high: 'FF9500',       // 橙色
      urgent: 'FF0000'      // 红色
    };
    return colors[priority] || colors.normal;
  }

  configureChannel(channel, config) {
    if (this.channels[channel]) {
      this.channels[channel] = { ...this.channels[channel], ...config, enabled: true };
      logSuccess(`${channel} 通道配置成功`);
    } else {
      logError(`未知通道: ${channel}`);
    }
  }
}

// 团队活动追踪器
class ActivityTracker {
  constructor() {
    this.activities = [];
  this.activitiesPath = join(projectRoot, '.team/activities');
  }

  trackActivity(type, description, user = 'system', metadata = {}) {
    const activity = {
      id: this.generateId(),
      type,
      description,
      user,
      timestamp: new Date().toISOString(),
      metadata
    };

    this.activities.push(activity);
    this.saveActivity(activity);

    log(`活动记录: ${type} - ${description}`, 'blue');
    return activity;
  }

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  saveActivity(activity) {
    if (!existsSync(this.activitiesPath)) {
      mkdirSync(this.activitiesPath, { recursive: true });
    }

    const activityFile = join(this.activitiesPath, `${activity.id}.json`);
    writeFileSync(activityFile, JSON.stringify(activity, null, 2));
  }

  getRecentActivities(limit = 10) {
    const activities = this.activities
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);

    return activities;
  }

  getActivityReport(days = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const recentActivities = this.activities.filter(
      activity => new Date(activity.timestamp) >= cutoffDate
    );

    const report = {
      period: `${days} 天`,
      totalActivities: recentActivities.length,
      activitiesByType: this.groupActivitiesByType(recentActivities),
      activitiesByUser: this.groupActivitiesByUser(recentActivities),
      topUsers: this.getTopUsers(recentActivities)
    };

    return report;
  }

  groupActivitiesByType(activities) {
    const grouped = {};
    activities.forEach(activity => {
      if (!grouped[activity.type]) {
        grouped[activity.type] = 0;
      }
      grouped[activity.type]++;
    });
    return grouped;
  }

  groupActivitiesByUser(activities) {
    const grouped = {};
    activities.forEach(activity => {
      if (!grouped[activity.user]) {
        grouped[activity.user] = 0;
      }
      grouped[activity.user]++;
    });
    return grouped;
  }

  getTopUsers(activities) {
    const userCounts = this.groupActivitiesByUser(activities);
    return Object.entries(userCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([user, count]) => ({ user, count }));
  }
}

// 团队知识库管理器
class KnowledgeBase {
  constructor() {
    this.kbPath = join(projectRoot, '.team/knowledge-base');
    this.categories = {
      'getting-started': '快速入门',
      'development': '开发指南',
      'deployment': '部署运维',
      'troubleshooting': '故障排除',
      'best-practices': '最佳实践'
    };
  }

  addArticle(category, title, content, author = 'system') {
    if (!this.categories[category]) {
      throw new Error(`未知分类: ${category}`);
    }

    const article = {
      id: this.generateId(),
      category,
      title,
      content,
      author,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: this.extractTags(content)
    };

    this.saveArticle(article);
    logSuccess(`知识库文章已添加: ${title}`);

    return article;
  }

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  extractTags(content) {
    // 简单的标签提取逻辑
    const tags = [];
    const words = content.toLowerCase().split(/\s+/);

    // 提取常见关键词作为标签
    const keywords = ['react', 'typescript', 'node', 'api', 'database', 'testing', 'deployment'];
    keywords.forEach(keyword => {
      if (words.includes(keyword)) {
        tags.push(keyword);
      }
    });

    return [...new Set(tags)];
  }

  saveArticle(article) {
    if (!existsSync(this.kbPath)) {
      mkdirSync(this.kbPath, { recursive: true });
    }

    const categoryPath = join(this.kbPath, article.category);
    if (!existsSync(categoryPath)) {
      mkdirSync(categoryPath, { recursive: true });
    }

    const articleFile = join(categoryPath, `${article.id}.md`);
    const articleContent = this.renderArticleTemplate(article);
    writeFileSync(articleFile, articleContent);
  }

  renderArticleTemplate(article) {
    return `---
id: ${article.id}
category: ${article.category}
title: ${article.title}
author: ${article.author}
created: ${article.createdAt}
updated: ${article.updatedAt}
tags: [${article.tags.join(', ')}]
---

# ${article.title}

${article.content}

---
*最后更新: ${new Date(article.updatedAt).toLocaleString()}*`;
  }

  searchArticles(query) {
    const results = [];

    Object.keys(this.categories).forEach(category => {
      const categoryPath = join(this.kbPath, category);
      if (existsSync(categoryPath)) {
        const files = require('fs').readdirSync(categoryPath);
        files.forEach(file => {
          if (file.endsWith('.md')) {
            const articlePath = join(categoryPath, file);
            const content = readFileSync(articlePath, 'utf8');

            if (content.toLowerCase().includes(query.toLowerCase())) {
              const article = this.parseArticle(content);
              results.push(article);
            }
          }
        });
      }
    });

    return results;
  }

  parseArticle(content) {
    const frontMatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
    const match = content.match(frontMatterRegex);

    if (match) {
      const frontMatter = match[1];
      const articleContent = match[2];

      // 简单的 front matter 解析
      const metadata = {};
      frontMatter.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length > 0) {
          const value = valueParts.join(':').trim();
          if (key === 'tags') {
            metadata[key] = value.replace(/[\[\]]/g, '').split(',').map(t => t.trim());
          } else {
            metadata[key] = value;
          }
        }
      });

      return {
        ...metadata,
        content: articleContent
      };
    }

    return null;
  }

  generateIndex() {
    const index = {
      categories: {},
      lastUpdated: new Date().toISOString()
    };

    Object.entries(this.categories).forEach(([key, name]) => {
      const categoryPath = join(this.kbPath, key);
      if (existsSync(categoryPath)) {
        const files = require('fs').readdirSync(categoryPath);
        index.categories[key] = {
          name,
          articles: files.map(file => {
            const articlePath = join(categoryPath, file);
            const content = readFileSync(articlePath, 'utf8');
            const article = this.parseArticle(content);
            return {
              id: article.id,
              title: article.title,
              author: article.author,
              tags: article.tags
            };
          })
        };
      }
    });

    const indexPath = join(this.kbPath, 'index.json');
    writeFileSync(indexPath, JSON.stringify(index, null, 2));

    logSuccess('知识库索引已生成');
  }
}

// 团队会议管理器
class MeetingManager {
  constructor() {
    this.meetingsPath = join(projectRoot, '.team/meetings');
  }

  scheduleMeeting(title, description, date, duration, attendees = []) {
    const meeting = {
      id: this.generateId(),
      title,
      description,
      date,
      duration,
      attendees,
      agenda: [],
      status: 'scheduled',
      createdAt: new Date().toISOString()
    };

    this.saveMeeting(meeting);
    logSuccess(`会议已安排: ${title} - ${date}`);

    return meeting;
  }

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  saveMeeting(meeting) {
    if (!existsSync(this.meetingsPath)) {
      mkdirSync(this.meetingsPath, { recursive: true });
    }

    const meetingFile = join(this.meetingsPath, `${meeting.id}.json`);
    writeFileSync(meetingFile, JSON.stringify(meeting, null, 2));
  }

  generateMeetingMinutes(meetingId) {
    const meetingFile = join(this.meetingsPath, `${meetingId}.json`);
    if (!existsSync(meetingFile)) {
      throw new Error(`会议不存在: ${meetingId}`);
    }

    const meeting = JSON.parse(readFileSync(meetingFile, 'utf8'));

    const minutes = {
      meetingId: meeting.id,
      title: meeting.title,
      date: meeting.date,
      attendees: meeting.attendees,
      agenda: meeting.agenda,
      notes: '',
      actionItems: [],
      decisions: [],
      generatedAt: new Date().toISOString()
    };

    const minutesFile = join(this.meetingsPath, `${meetingId}-minutes.md`);
    const minutesContent = this.renderMinutesTemplate(minutes);
    writeFileSync(minutesFile, minutesContent);

    logSuccess(`会议纪要模板已生成: ${meeting.title}`);
    return minutesFile;
  }

  renderMinutesTemplate(minutes) {
    return `# ${minutes.title}

**日期:** ${new Date(minutes.date).toLocaleDateString()}
**参会人员:** ${minutes.attendees.join(', ')}
**生成时间:** ${new Date(minutes.generatedAt).toLocaleString()}

## 会议议程

${minutes.agenda.map((item, index) => `${index + 1}. ${item}`).join('\n')}

## 会议记录

<!-- 在这里记录会议的主要内容 -->

## 决策事项

<!-- 在这里记录会议中做出的决策 -->

## 行动项

| 事项 | 负责人 | 截止日期 | 状态 |
|------|--------|----------|------|
|      |        |          | 待定 |

## 下次会议

**时间:** 待定
**议题:** 待定

---
*此纪要由团队协作工具生成*`;
  }
}

// 显示使用说明
function showUsage() {
  log('💬 LLMChat 团队沟通中心', 'bright');
  log('==========================', 'blue');
  log('\n用法:', 'cyan');
  log('  node communication-center.js [选项]', 'white');
  log('\n选项:', 'cyan');
  log('  --notify <type> <title> <message>  发送团队通知', 'white');
  log('  --track <type> <description>       记录团队活动', 'white');
  log('  --kb-add <category> <title> <content>  添加知识库文章', 'white');
  log('  --kb-search <query>              搜索知识库', 'white');
  log('  --meeting <title> <date>         安排会议', 'white');
  log('  --activity-report                生成活动报告', 'white');
  log('  --help                          显示帮助信息', 'white');
  log('\n示例:', 'cyan');
  log('  node communication-center.js --notify "部署" "生产环境部署完成" "应用已成功部署到生产环境"', 'white');
  log('  node communication-center.js --track "代码提交" "修复了登录页面的样式问题"', 'white');
  log('  node communication-center.js --kb-add "development" "React Hooks 使用指南" "# React Hooks 指南内容"', 'white');
}

// 主函数
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showUsage();
    return;
  }

  try {
    if (args[0] === '--notify') {
      const [, type, title, ...messageParts] = args;
      const message = messageParts.join(' ');

      if (!type || !title || !message) {
        throw new Error('用法: --notify <type> <title> <message>');
      }

      const notificationSystem = new NotificationSystem();
      await notificationSystem.sendNotification(type, title, message);
      return;
    }

    if (args[0] === '--track') {
      const [, type, ...descriptionParts] = args;
      const description = descriptionParts.join(' ');

      if (!type || !description) {
        throw new Error('用法: --track <type> <description>');
      }

      const activityTracker = new ActivityTracker();
      activityTracker.trackActivity(type, description);
      return;
    }

    if (args[0] === '--kb-add') {
      const [, category, title, ...contentParts] = args;
      const content = contentParts.join(' ');

      if (!category || !title || !content) {
        throw new Error('用法: --kb-add <category> <title> <content>');
      }

      const knowledgeBase = new KnowledgeBase();
      knowledgeBase.addArticle(category, title, content);
      knowledgeBase.generateIndex();
      return;
    }

    if (args[0] === '--kb-search') {
      const [, ...queryParts] = args;
      const query = queryParts.join(' ');

      if (!query) {
        throw new Error('用法: --kb-search <query>');
      }

      const knowledgeBase = new KnowledgeBase();
      const results = knowledgeBase.searchArticles(query);

      logSection('知识库搜索结果');
      if (results.length === 0) {
        log('未找到相关文章', 'yellow');
      } else {
        results.forEach(article => {
          log(`• ${article.title} (${article.category})`, 'blue');
          log(`  ${article.content.substring(0, 100)}...`, 'white');
        });
      }
      return;
    }

    if (args[0] === '--meeting') {
      const [, title, date] = args;

      if (!title || !date) {
        throw new Error('用法: --meeting <title> <date>');
      }

      const meetingManager = new MeetingManager();
      meetingManager.scheduleMeeting(title, '', date, 60);
      return;
    }

    if (args[0] === '--activity-report') {
      const activityTracker = new ActivityTracker();
      const report = activityTracker.getActivityReport(7);

      logSection('团队活动报告 (7天)');
      log(`总活动数: ${report.totalActivities}`, 'blue');

      log('\n按类型分组:', 'cyan');
      Object.entries(report.activitiesByType).forEach(([type, count]) => {
        log(`  ${type}: ${count}`, 'white');
      });

      log('\n活跃用户:', 'cyan');
      report.topUsers.forEach(user => {
        log(`  ${user.user}: ${user.count} 次活动`, 'white');
      });
      return;
    }

    logError('未知选项，请使用 --help 查看帮助信息');
    process.exit(1);

  } catch (error) {
    logError(`团队沟通工具执行失败: ${error.message}`);
    process.exit(1);
  }
}

// 运行主函数
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main as runCommunicationCenter, NotificationSystem, ActivityTracker, KnowledgeBase, MeetingManager };