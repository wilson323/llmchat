# LLMChat 贡献指南

## 📋 目录
- [贡献方式](#贡献方式)
- [开始之前](#开始之前)
- [贡献流程](#贡献流程)
- [代码规范](#代码规范)
- [文档贡献](#文档贡献)
- [社区参与](#社区参与)
- [获得帮助](#获得帮助)

## 贡献方式

### 🚀 参与方式
1. **代码贡献**: 修复Bug、添加新功能、性能优化
2. **文档贡献**: 完善文档、翻译、示例代码
3. **测试贡献**: 编写测试用例、提升测试覆盖率
4. **设计贡献**: UI/UX设计、图标、界面优化
5. **社区贡献**: 回答问题、分享经验、推广项目

### 🎯 贡献级别
- **新手友好**: 标记 `good first issue` 的任务适合新手
- **中等难度**: 需要一定经验的任务
- **高级任务**: 需要深入理解的复杂任务

## 开始之前

### 环境准备
```bash
# 1. 克隆仓库
git clone https://github.com/llmchat/llmchat.git
cd llmchat

# 2. 安装依赖
pnpm install

# 3. 配置开发环境
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 4. 启动开发服务器
pnpm run dev
```

### 开发工具配置
```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "emmet.includeLanguages": {
    "typescript": "html",
    "typescriptreact": "html"
  },
  "files.associations": {
    "*.css": "tailwindcss"
  }
}
```

### 推荐插件
```json
// .vscode/extensions.json
{
  "recommendations": [
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-typescript-next",
    "ms-vscode.vscode-eslint",
    "ms-vscode.vscode-json",
    "github.copilot",
    "ms-vscode.test-adapter-converter",
    "vitest.explorer"
  ]
}
```

## 贡献流程

### 1. 选择任务
```bash
# 查看可贡献的任务
gh issue list --label "good first issue"

# 查看所有开放任务
gh issue list --state open

# 查看项目任务看板
gh project view
```

### 2. 创建分支
```bash
# 创建功能分支
git checkout -b feature/your-feature-name

# 创建修复分支
git checkout -b fix/issue-number-description

# 创建文档分支
git checkout -b docs/update-documentation
```

### 3. 开发和测试
```bash
# 运行类型检查
pnpm run type-check

# 运行代码检查
pnpm run lint

# 运行测试
pnpm test

# 运行E2E测试
pnpm run test:e2e
```

### 4. 提交代码
```bash
# 添加更改
git add .

# 提交代码
git commit -m "feat: add new authentication system

- Implement JWT token authentication
- Add login and registration endpoints
- Create user model and database schema
- Add authentication middleware

🧪 测试: 单元测试通过，集成测试验证
🔒 安全: 密码加密已实现
📝 文档: API文档已更新

Closes #123"

# 推送分支
git push origin feature/your-feature-name
```

### 5. 创建Pull Request
```bash
# 创建Pull Request
gh pr create --title "feat: add new authentication system" \
  --body "## 变更描述
实现完整的用户认证系统，支持JWT令牌认证和用户注册登录功能。

## 变更类型
- [ ] 新功能
- [x] Bug修复
- [ ] 重构
- [ ] 文档更新
- [ ] 性能优化

## 测试
- [x] 单元测试通过
- [x] 集成测试通过
- [x] 手动测试验证
- [ ] 性能测试通过

## 检查清单
- [x] 代码符合项目规范
- [x] 所有测试通过
- [x] 文档已更新
- [x] 安全审查通过

## 相关Issue
Closes #123"
```

### 6. 代码审查
- **自检**: 在提交PR前进行自我审查
- **响应反馈**: 及时响应审查意见
- **迭代改进**: 根据反馈进行修改

### 7. 合并代码
- **审查通过**: 等待至少一个维护者批准
- **CI检查**: 确保所有CI检查通过
- **合并**: 维护者将代码合并到主分支

## 代码规范

### TypeScript规范
```typescript
// ✅ 推荐: 明确的类型定义
interface UserConfig {
  readonly id: string;
  name: string;
  email: string;
  avatar?: string;
}

// ✅ 推荐: 使用泛型提高复用性
interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

// ✅ 推荐: 明确的函数签名
async function fetchUserData(userId: string): Promise<UserConfig | null> {
  // 实现
}

// ❌ 避免: 使用any类型
function processData(data: any): any { // 不推荐
  return data;
}
```

### React组件规范
```typescript
// ✅ 推荐: 清晰的组件接口
interface UserAvatarProps {
  user: {
    id: string;
    name: string;
    avatar?: string;
  };
  size?: 'small' | 'medium' | 'large';
  onClick?: () => void;
}

const UserAvatar: React.FC<UserAvatarProps> = ({
  user,
  size = 'medium',
  onClick
}) => {
  return (
    <div className="user-avatar" onClick={onClick}>
      {/* 组件实现 */}
    </div>
  );
};

export default UserAvatar;
```

### 命名规范
```typescript
// 组件文件: PascalCase
UserAvatar.tsx, ChatContainer.tsx

// 工具文件: camelCase
apiClient.ts, formatUtils.ts

// 常量文件: UPPER_SNAKE_CASE
API_ENDPOINTS.ts, HTTP_STATUS.ts

// 接口文件: camelCase
types.ts, interfaces.ts
```

### 注释规范
```typescript
/**
 * 发送聊天消息
 *
 * @param message - 消息内容
 * @param agentId - 智能体ID
 * @param options - 发送选项
 * @returns Promise<ChatResponse> 聊天响应
 *
 * @example
 * ```typescript
 * const response = await sendMessage({
 *   content: "你好",
 *   agentId: "agent-123"
 * });
 * ```
 */
async function sendMessage(
  message: string,
  agentId: string,
  options: SendMessageOptions = {}
): Promise<ChatResponse> {
  // 实现
}
```

## 文档贡献

### 文档类型
1. **API文档**: 接口说明、请求/响应格式
2. **教程文档**: 分步骤教程、最佳实践
3. **架构文档**: 系统设计、技术决策
4. **部署文档**: 安装指南、运维手册

### 文档规范
```markdown
# 文档标题 (H1)

## 概述 (H2)
简要描述文档内容和目标读者

## 快速开始 (H2)
### 前置条件 (H3)
- Node.js 18+
- PostgreSQL 13+

### 安装步骤 (H3)
1. 克隆仓库
2. 安装依赖
3. 配置环境

## 详细说明 (H2)
### 核心概念 (H3)
- 概念1: 说明
- 概念2: 说明

### 代码示例 (H3)
```typescript
// 代码示例
const example = "Hello World";
```

## 故障排除 (H2)
### 常见问题 (H3)
- **问题1**: 解决方案
- **问题2**: 解决方案

## 相关链接 (H2)
- [相关文档1](链接)
- [相关文档2](链接)

---
*最后更新: YYYY-MM-DD*
*维护者: [姓名]*
```

### 文档贡献流程
1. **创建文档分支**
   ```bash
   git checkout -b docs/add-new-tutorial
   ```

2. **编写文档**
   - 遵循文档模板
   - 包含代码示例
   - 添加必要截图

3. **本地预览**
   ```bash
   npm run docs:dev
   ```

4. **提交文档**
   ```bash
   git add docs/new-tutorial.md
   git commit -m "docs: add new tutorial for feature X"
   ```

5. **创建PR**
   - 添加 `documentation` 标签
   - 等待文档团队审查

## 测试贡献

### 测试类型
1. **单元测试**: 测试单个函数或组件
2. **集成测试**: 测试模块间交互
3. **E2E测试**: 测试完整用户流程
4. **性能测试**: 测试系统性能

### 测试编写规范
```typescript
// 单元测试示例
describe('UserService', () => {
  let userService: UserService;
  let mockRepository: jest.Mocked<UserRepository>;

  beforeEach(() => {
    mockRepository = createMockRepository();
    userService = new UserService(mockRepository);
  });

  describe('createUser', () => {
    it('should create user successfully', async () => {
      // Arrange
      const userData = {
        name: 'John Doe',
        email: 'john@example.com'
      };
      const expectedUser = { id: '1', ...userData };

      mockRepository.create.mockResolvedValue(expectedUser);

      // Act
      const result = await userService.createUser(userData);

      // Assert
      expect(result).toEqual(expectedUser);
      expect(mockRepository.create).toHaveBeenCalledWith(userData);
    });

    it('should throw error when email already exists', async () => {
      // Arrange
      const userData = {
        name: 'John Doe',
        email: 'existing@example.com'
      };
      mockRepository.findByEmail.mockResolvedValue({} as User);

      // Act & Assert
      await expect(userService.createUser(userData))
        .rejects.toThrow('邮箱已存在');
    });
  });
});
```

### 测试覆盖率要求
- **核心功能**: 测试覆盖率 ≥ 90%
- **工具函数**: 测试覆盖率 ≥ 95%
- **UI组件**: 测试覆盖率 ≥ 80%
- **API接口**: 测试覆盖率 ≥ 85%

## 社区参与

### 回答问题
1. **GitHub Issues**: 回答用户问题
2. **讨论区**: 参与技术讨论
3. **社区论坛**: 分享使用经验

### 分享经验
1. **博客文章**: 写技术博客
2. **视频教程**: 制作教学视频
3. **案例分享**: 分享使用案例

### 推广项目
1. **社交媒体**: 分享项目动态
2. **技术会议**: 参加技术分享
3. **开源社区**: 推广项目价值

## 获得帮助

### 获取帮助的方式
1. **GitHub Issues**: 报告Bug或提出功能请求
2. **讨论区**: 技术讨论和问答
3. **社区聊天**: 实时交流
4. **邮件支持**: 联系维护团队

### 提问指南
```markdown
## 问题报告模板

### 问题描述
简要描述遇到的问题

### 复现步骤
1. 执行操作A
2. 执行操作B
3. 观察到问题

### 期望行为
描述期望的正确行为

### 实际行为
描述实际发生的情况

### 环境信息
- 操作系统: [如 Windows 10, macOS 12, Ubuntu 22.04]
- Node.js版本: [如 18.17.0]
- 浏览器: [如 Chrome 118, Firefox 119]
- 项目版本: [如 v1.0.0]

### 额外信息
- 错误日志
- 截图
- 相关配置
```

### 代码审查请求
```markdown
## 代码审查请求

### 变更描述
简要描述本次变更的内容

### 审查重点
- [ ] 代码逻辑正确性
- [ ] 性能影响
- [ ] 安全考虑
- [ ] 测试覆盖

### 测试结果
- [ ] 单元测试通过
- [ ] 集成测试通过
- [ ] 手动测试通过

### 相关文档
- [ ] API文档已更新
- [ ] 用户文档已更新
- [ ] 开发文档已更新
```

## 贡献者激励

### 贡献者等级
1. **贡献者**: 提交1个有效PR
2. **维护者**: 提交5个有效PR
3. **核心贡献者**: 提交10个有效PR
4. **荣誉贡献者**: 长期贡献者

### 激励措施
- **荣誉认证**: GitHub贡献者徽章
- **优先审核**: 贡献者优先审核权
- **社区角色**: 社区管理员权限
- **技术支持**: 优先技术支持
- **会议邀请**: 技术会议分享机会

## 贡献统计

### 个人贡献统计
```bash
# 查看个人贡献统计
git shortlog -sn --all --no-merges | grep `^$(git config user.name)` | wc -l

# 查看代码行数统计
git log --author="$(git config user.email)" --pretty=tformat: --numstat | awk '{add+=$1; subs+=$2} END {print "added lines:", add, "removed lines:", subs}'

# 查看贡献时间分布
git log --author="$(git config user.email)" --pretty=format:"%ad" --date=short | sort | uniq -c | sort -nr
```

### 项目贡献统计
```bash
# 查看项目整体统计
git log --pretty=format:"%ae" | sort | uniq -c | sort -nr

# 查看活跃贡献者
git log --since="1 month ago" --pretty=format:"%ae" | sort | uniq -c | sort -nr

# 查看代码增长趋势
git log --pretty=format:"%ad" --date=short --stat --numstat | grep -E "^\d{4}" | sort | uniq -c
```

## 行为准则

### 代码审查原则
- **尊重他人**: 建设性的反馈和意见
- **专业礼貌**: 使用专业和礼貌的语言
- **详细具体**: 提供具体的修改建议
- **及时响应**: 尽快响应审查请求

### 社区交流原则
- **友好包容**: 欢迎不同背景的贡献者
- **耐心帮助**: 耐心帮助新手贡献者
- **积极鼓励**: 鼓励和认可社区贡献
- **专业讨论**: 保持专业的技术讨论

### 禁止行为
- **攻击性言论**: 人身攻击或侮辱性言论
- **恶意行为**: 故意破坏或干扰项目
- **抄袭行为**: 抄袭他人代码或文档
- **商业化**: 未经授权的商业使用

## 发布流程

### 版本发布
1. **准备发布**: 确保所有PR已合并
2. **版本标记**: 创建版本标签
3. **发布说明**: 编写发布说明
4. **部署发布**: 部署到生产环境

### 发布说明模板
```markdown
# 发布说明 v1.0.0

## 新功能
- 🎉 功能1: 详细描述
- 🎉 功能2: 详细描述

## 改进
- ✨ 改进1: 详细描述
- ✨ 改进2: 详细描述

## Bug修复
- 🐛 修复1: 详细描述
- 🐛 修复2: 详细描述

## 贡献者
- 感谢 @contributor1 的贡献
- 感谢 @contributor2 的贡献

## 下载
- [npm package](https://www.npmjs.com/package/llmchat)
- [GitHub Release](https://github.com/llmchat/llmchat/releases/tag/v1.0.0)
```

---

感谢您对LLMChat项目的贡献！您的贡献将帮助更多开发者。

*最后更新: 2025-10-18*
*文档版本: v1.0*
*维护者: LLMChat团队*