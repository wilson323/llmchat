# LLMChat 开发最佳实践指南

## 📋 目录
- [开发环境搭建](#开发环境搭建)
- [代码编写规范](#代码编写规范)
- [测试策略](#测试策略)
- [性能优化](#性能优化)
- [安全实践](#安全实践)
- [调试技巧](#调试技巧)
- [协作流程](#协作流程)

## 开发环境搭建

### 推荐开发工具链

#### IDE和编辑器配置
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
  },
  "tailwindCSS.includeLanguages": {
    "typescript": "html",
    "typescriptreact": "html"
  }
}
```

#### 必备VSCode插件
```json
// .vscode/extensions.json
{
  "recommendations": [
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-typescript-next",
    "ms-vscode.vscode-eslint",
    "ms-vscode.vscode-json",
    "ms-vscode-remote.remote-containers",
    "ms-vscode.vscode-docker",
    "github.copilot",
    "github.copilot-chat",
    "ms-vscode.test-adapter-converter",
    "vitest.explorer"
  ]
}
```

### 环境配置最佳实践

#### Git配置
```bash
# 全局配置
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
git config --global init.defaultBranch main
git config --global pull.rebase false

# 项目配置
git config core.autocrlf input
git config core.safecrlf warn
```

#### 开发环境脚本
```bash
#!/bin/bash
# scripts/setup-dev.sh

echo "🚀 LLMChat 开发环境初始化"

# 1. 检查Node.js版本
node_version=$(node --version | cut -d'v' -f2)
required_version="18.0.0"

if [ "$(printf '%s\n' "$required_version" "$node_version" | sort -V | head -n1)" != "$required_version" ]; then
    echo "❌ Node.js版本过低，需要 >= $required_version"
    exit 1
fi

# 2. 检查pnpm
if ! command -v pnpm &> /dev/null; then
    echo "📦 安装pnpm..."
    npm install -g pnpm
fi

# 3. 安装依赖
echo "📦 安装项目依赖..."
pnpm install

# 4. 环境配置
if [ ! -f "backend/.env" ]; then
    echo "📝 创建环境配置文件..."
    cp backend/.env.example backend/.env
    echo "⚠️ 请编辑 backend/.env 文件配置必要的环境变量"
fi

# 5. 数据库初始化
echo "🗄️ 初始化数据库..."
cd backend && pnpm run migrate:up

# 6. 类型检查
echo "🔍 运行类型检查..."
pnpm run type-check

echo "✅ 开发环境初始化完成！"
echo "🎯 运行 'pnpm run dev' 启动开发服务器"
```

## 代码编写规范

### TypeScript最佳实践

#### 类型定义规范
```typescript
// ✅ 推荐: 使用interface定义对象类型
interface UserConfig {
  readonly id: string;
  name: string;
  email: string;
  avatar?: string;
  preferences: UserPreferences;
  createdAt: Date;
  updatedAt?: Date;
}

// ✅ 推荐: 使用type定义联合类型或工具类型
type UserRole = 'admin' | 'user' | 'moderator';
type ApiResponse<T> = {
  data: T;
  success: boolean;
  message?: string;
};

// ✅ 推荐: 使用泛型提高代码复用性
interface Repository<T> {
  findById(id: string): Promise<T | null>;
  create(entity: Partial<T>): Promise<T>;
  update(id: string, entity: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
}

// ❌ 避免: 使用any类型
function processData(data: any): any { // 不推荐
  return data;
}

// ✅ 推荐: 使用unknown或具体类型
function processData<T>(data: unknown): Promise<T> {
  const validated = validateData<T>(data);
  return processData(validated);
}
```

#### 函数编写规范
```typescript
// ✅ 推荐: 明确的函数签名和JSDoc注释
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
 *   agentId: "agent-123",
 *   stream: true
 * });
 * ```
 */
async function sendMessage(
  message: string,
  agentId: string,
  options: SendMessageOptions = {}
): Promise<ChatResponse> {
  // 参数验证
  if (!message.trim()) {
    throw new ValidationError("消息内容不能为空");
  }

  if (!agentId) {
    throw new ValidationError("智能体ID不能为空");
  }

  // 实现逻辑
  const agent = await agentService.findById(agentId);
  if (!agent) {
    throw new NotFoundError("智能体不存在");
  }

  return await chatService.sendMessage(message, agent, options);
}
```

#### 错误处理最佳实践
```typescript
// ✅ 推荐: 自定义错误类型
class ApplicationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

class ValidationError extends ApplicationError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

class NotFoundError extends ApplicationError {
  constructor(resource: string) {
    super(`${resource}不存在`, 'NOT_FOUND', 404);
  }
}

// ✅ 推荐: 统一错误处理
async function handleRequest<T>(
  operation: () => Promise<T>,
  context: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    logger.error(`操作失败: ${context}`, {
      error: error.message,
      stack: error.stack,
      context
    });

    if (error instanceof ApplicationError) {
      throw error;
    }

    throw new ApplicationError(
      `操作失败: ${context}`,
      'INTERNAL_ERROR',
      500
    );
  }
}
```

### React组件最佳实践

#### 组件设计原则
```typescript
// ✅ 推荐: 单一职责的组件
interface UserAvatarProps {
  user: {
    id: string;
    name: string;
    avatar?: string;
  };
  size?: 'small' | 'medium' | 'large';
  showName?: boolean;
  onClick?: () => void;
}

const UserAvatar: React.FC<UserAvatarProps> = ({
  user,
  size = 'medium',
  showName = false,
  onClick
}) => {
  const sizeClasses = {
    small: 'w-8 h-8',
    medium: 'w-12 h-12',
    large: 'w-16 h-16'
  };

  return (
    <div
      className={`flex items-center space-x-3 ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className={`${sizeClasses[size]} rounded-full overflow-hidden bg-gray-200`}>
        {user.avatar ? (
          <img
            src={user.avatar}
            alt={user.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-blue-500 text-white font-semibold">
            {user.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      {showName && (
        <span className="font-medium text-gray-900">{user.name}</span>
      )}
    </div>
  );
};
```

#### Hooks使用最佳实践
```typescript
// ✅ 推荐: 自定义Hook封装业务逻辑
const useChat = (agentId: string) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const userMessage: Message = {
        id: generateId(),
        role: 'user',
        content,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, userMessage]);

      const response = await chatService.sendMessage(content, agentId);

      const assistantMessage: Message = {
        id: response.id,
        role: 'assistant',
        content: response.content,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送消息失败');
    } finally {
      setIsLoading(false);
    }
  }, [agentId]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages
  };
};
```

### 后端代码最佳实践

#### 控制器层规范
```typescript
// ✅ 推荐: 清晰的控制器结构
@Controller('/api/agents')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Get()
  @UseGuards(AuthGuard)
  async findAll(
    @Query('page', ParseIntPipe) page: number = 1,
    @Query('limit', ParseIntPipe) limit: number = 20,
    @Query('category') category?: string
  ): Promise<PaginatedResponse<Agent>> {
    return await this.agentService.findAll({
      page,
      limit,
      category
    });
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<Agent> {
    const agent = await this.agentService.findById(id);

    if (!agent) {
      throw new NotFoundException('智能体不存在');
    }

    return agent;
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async create(
    @Body() createAgentDto: CreateAgentDto,
    @CurrentUser() user: User
  ): Promise<Agent> {
    return await this.agentService.create(createAgentDto, user.id);
  }
}
```

#### 服务层规范
```typescript
// ✅ 推荐: 服务层专注业务逻辑
@Injectable()
export class AgentService {
  constructor(
    private readonly agentRepository: AgentRepository,
    private readonly cacheService: CacheService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  async create(createAgentDto: CreateAgentDto, userId: string): Promise<Agent> {
    // 1. 验证数据
    await this.validateAgentData(createAgentDto);

    // 2. 创建智能体
    const agent = await this.agentRepository.create({
      ...createAgentDto,
      createdBy: userId,
      createdAt: new Date()
    });

    // 3. 缓存更新
    await this.cacheService.set(`agent:${agent.id}`, agent, 3600);

    // 4. 发送事件
    this.eventEmitter.emit('agent.created', {
      agentId: agent.id,
      userId
    });

    return agent;
  }

  private async validateAgentData(data: CreateAgentDto): Promise<void> {
    // 名称唯一性检查
    const existing = await this.agentRepository.findByName(data.name);
    if (existing) {
      throw new ConflictException('智能体名称已存在');
    }

    // 配置验证
    if (!this.isValidConfiguration(data.configuration)) {
      throw new BadRequestException('智能体配置无效');
    }
  }
}
```

## 测试策略

### 单元测试最佳实践

#### 测试结构
```typescript
// ✅ 推荐: 清晰的测试结构
describe('AgentService', () => {
  let agentService: AgentService;
  let mockRepository: jest.Mocked<AgentRepository>;
  let mockCacheService: jest.Mocked<CacheService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AgentService,
        {
          provide: AgentRepository,
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
            findByName: jest.fn(),
          }
        },
        {
          provide: CacheService,
          useValue: {
            set: jest.fn(),
            get: jest.fn(),
            delete: jest.fn(),
          }
        }
      ]
    }).compile();

    agentService = module.get<AgentService>(AgentService);
    mockRepository = module.get(AgentRepository);
    mockCacheService = module.get(CacheService);
  });

  describe('create', () => {
    it('should create agent successfully', async () => {
      // Arrange
      const createAgentDto: CreateAgentDto = {
        name: 'Test Agent',
        description: 'Test Description',
        provider: 'openai',
        configuration: {
          model: 'gpt-3.5-turbo',
          temperature: 0.7
        }
      };

      const expectedAgent: Agent = {
        id: 'agent-id',
        ...createAgentDto,
        createdBy: 'user-id',
        createdAt: new Date()
      };

      mockRepository.findByName.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(expectedAgent);

      // Act
      const result = await agentService.create(createAgentDto, 'user-id');

      // Assert
      expect(result).toEqual(expectedAgent);
      expect(mockRepository.findByName).toHaveBeenCalledWith('Test Agent');
      expect(mockRepository.create).toHaveBeenCalledWith({
        ...createAgentDto,
        createdBy: 'user-id',
        createdAt: expect.any(Date)
      });
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'agent:agent-id',
        expectedAgent,
        3600
      );
    });

    it('should throw ConflictException when name already exists', async () => {
      // Arrange
      const createAgentDto: CreateAgentDto = {
        name: 'Existing Agent',
        description: 'Test Description',
        provider: 'openai',
        configuration: {}
      };

      mockRepository.findByName.mockResolvedValue({} as Agent);

      // Act & Assert
      await expect(agentService.create(createAgentDto, 'user-id'))
        .rejects.toThrow(ConflictException);
    });
  });
});
```

#### 集成测试
```typescript
// ✅ 推荐: 完整的集成测试
describe('AgentController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.cleanDatabase();
  });

  describe('/api/agents (POST)', () => {
    it('should create agent', async () => {
      // Arrange
      const createAgentDto = {
        name: 'Test Agent',
        description: 'Test Description',
        provider: 'openai',
        configuration: {
          model: 'gpt-3.5-turbo',
          temperature: 0.7
        }
      };

      // Act
      const response = await request(app.getHttpServer())
        .post('/api/agents')
        .set('Authorization', `Bearer ${await getAuthToken()}`)
        .send(createAgentDto)
        .expect(201);

      // Assert
      expect(response.body).toMatchObject({
        id: expect.any(String),
        name: createAgentDto.name,
        description: createAgentDto.description,
        provider: createAgentDto.provider,
        configuration: createAgentDto.configuration
      });
    });
  });
});
```

### 前端测试最佳实践

#### 组件测试
```typescript
// ✅ 推荐: 组件测试
describe('UserAvatar', () => {
  const mockUser = {
    id: '1',
    name: 'John Doe',
    avatar: 'https://example.com/avatar.jpg'
  };

  it('renders avatar with image', () => {
    render(<UserAvatar user={mockUser} />);

    const avatar = screen.getByAltText('John Doe');
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveAttribute('src', mockUser.avatar);
  });

  it('renders avatar with initials when no image', () => {
    const userWithoutAvatar = { ...mockUser, avatar: undefined };

    render(<UserAvatar user={userWithoutAvatar} />);

    const initials = screen.getByText('J');
    expect(initials).toBeInTheDocument();
  });

  it('calls onClick handler when clicked', () => {
    const handleClick = jest.fn();

    render(<UserAvatar user={mockUser} onClick={handleClick} />);

    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('applies correct size classes', () => {
    const { rerender } = render(<UserAvatar user={mockUser} size="large" />);

    expect(screen.getByRole('button')).toHaveClass('w-16', 'h-16');

    rerender(<UserAvatar user={mockUser} size="small" />);
    expect(screen.getByRole('button')).toHaveClass('w-8', 'h-8');
  });
});
```

#### Hook测试
```typescript
// ✅ 推荐: Hook测试
describe('useChat', () => {
  it('should send message successfully', async () => {
    const mockSendMessage = jest.fn().mockResolvedValue({
      id: 'response-id',
      content: 'Hello! How can I help you?',
      role: 'assistant'
    });

    jest.spyOn(chatService, 'sendMessage').mockImplementation(mockSendMessage);

    const { result } = renderHook(() => useChat('agent-id'));

    await act(async () => {
      await result.current.sendMessage('Hello');
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]).toMatchObject({
      role: 'user',
      content: 'Hello'
    });
    expect(result.current.messages[1]).toMatchObject({
      role: 'assistant',
      content: 'Hello! How can I help you?'
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });
});
```

## 性能优化

### 前端性能优化

#### React性能优化
```typescript
// ✅ 推荐: 使用React.memo避免不必要的重渲染
const MessageItem = React.memo<MessageItemProps>(({ message, onEdit, onDelete }) => {
  return (
    <div className="message-item">
      <div className="message-content">{message.content}</div>
      <div className="message-actions">
        <button onClick={() => onEdit(message.id)}>编辑</button>
        <button onClick={() => onDelete(message.id)}>删除</button>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // 自定义比较函数
  return prevProps.message.id === nextProps.message.id &&
         prevProps.message.content === nextProps.message.content;
});

// ✅ 推荐: 使用useMemo缓存计算结果
const useMessageStatistics = (messages: Message[]) => {
  const statistics = useMemo(() => {
    const totalMessages = messages.length;
    const userMessages = messages.filter(m => m.role === 'user').length;
    const assistantMessages = messages.filter(m => m.role === 'assistant').length;

    return {
      totalMessages,
      userMessages,
      assistantMessages,
      averageLength: messages.reduce((sum, m) => sum + m.content.length, 0) / totalMessages
    };
  }, [messages]);

  return statistics;
};

// ✅ 推荐: 使用useCallback缓存函数
const useChatActions = (sessionId: string) => {
  const sendMessage = useCallback(async (content: string) => {
    await chatService.sendMessage(sessionId, content);
  }, [sessionId]);

  const deleteMessage = useCallback(async (messageId: string) => {
    await chatService.deleteMessage(sessionId, messageId);
  }, [sessionId]);

  return { sendMessage, deleteMessage };
};
```

#### 代码分割
```typescript
// ✅ 推荐: 路由级别的代码分割
const HomePage = lazy(() => import('./pages/HomePage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const AgentsPage = lazy(() => import('./pages/AgentsPage'));

const App = () => (
  <Router>
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/agents" element={<AgentsPage />} />
      </Routes>
    </Suspense>
  </Router>
);

// ✅ 推荐: 组件级别的代码分割
const AdminDashboard = lazy(() =>
  import('./components/admin/AdminDashboard').then(module => ({
    default: module.AdminDashboard
  }))
);
```

### 后端性能优化

#### 数据库查询优化
```typescript
// ✅ 推荐: 使用索引优化查询
class MessageRepository {
  // 为查询字段添加索引
  async findBySessionId(
    sessionId: string,
    options: { page?: number; limit?: number } = {}
  ): Promise<Message[]> {
    const { page = 1, limit = 50 } = options;
    const offset = (page - 1) * limit;

    // 使用索引字段查询
    return this.db.query(`
      SELECT * FROM messages
      WHERE session_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `, [sessionId, limit, offset]);
  }

  // 批量操作优化
  async createMany(messages: CreateMessageDto[]): Promise<Message[]> {
    const values = messages.map(m =>
      `('${m.sessionId}', '${m.role}', '${m.content}', '${m.timestamp}')`
    ).join(',');

    return this.db.query(`
      INSERT INTO messages (session_id, role, content, created_at)
      VALUES ${values}
      RETURNING *
    `);
  }
}
```

#### 缓存策略
```typescript
// ✅ 推荐: 多层缓存策略
@Injectable()
export class CacheService {
  constructor(
    private readonly redis: Redis,
    private readonly memoryCache: MemoryCache
  ) {}

  async get<T>(key: string): Promise<T | null> {
    // 1. 先查内存缓存
    let value = this.memoryCache.get<T>(key);
    if (value) {
      return value;
    }

    // 2. 查Redis缓存
    const redisValue = await this.redis.get(key);
    if (redisValue) {
      value = JSON.parse(redisValue);
      // 回填内存缓存
      this.memoryCache.set(key, value, 300); // 5分钟
      return value;
    }

    return null;
  }

  async set<T>(key: string, value: T, ttl: number = 3600): Promise<void> {
    // 同时设置两层缓存
    this.memoryCache.set(key, value, Math.min(ttl, 300));
    await this.redis.setex(key, ttl, JSON.stringify(value));
  }
}
```

## 安全实践

### 输入验证
```typescript
// ✅ 推荐: 使用class-validator进行输入验证
import { IsString, IsEmail, IsOptional, IsEnum, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsEnum(['user', 'admin'])
  role?: 'user' | 'admin';
}

// 在控制器中使用验证管道
@Post()
async create(@Body(ValidationPipe) createUserDto: CreateUserDto) {
  return this.userService.create(createUserDto);
}
```

### 数据加密
```typescript
// ✅ 推荐: 敏感数据加密
@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor() {
    this.key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
  }

  encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.algorithm, this.key);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  decrypt(encryptedText: string): string {
    const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipher(this.algorithm, this.key);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
```

## 调试技巧

### 前端调试
```typescript
// ✅ 推荐: 使用React DevTools
const useDebugValue = (value: any, label?: string) => {
  React.useDebugValue(value, label);
};

// 在自定义Hook中使用调试信息
const useChatState = (sessionId: string) => {
  const [state, setState] = useState(initialState);

  // 调试信息只在开发环境显示
  useDebugValue({
    sessionId,
    messageCount: state.messages.length,
    isLoading: state.isLoading
  }, 'Chat State');

  return [state, setState];
};

// ✅ 推荐: 性能调试
const usePerformanceMonitor = (componentName: string) => {
  useEffect(() => {
    const startTime = performance.now();

    return () => {
      const endTime = performance.now();
      console.log(`${componentName} 渲染耗时: ${endTime - startTime}ms`);
    };
  });
};
```

### 后端调试
```typescript
// ✅ 推荐: 结构化日志
@Injectable()
export class LoggerService {
  private readonly logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    transports: [
      new winston.transports.Console(),
      new winston.transports.File({ filename: 'error.log', level: 'error' }),
      new winston.transports.File({ filename: 'combined.log' })
    ]
  });

  logRequest(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;

      this.logger.info('HTTP Request', {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
    });

    next();
  }
}

// ✅ 推荐: 使用调试断点
const debugAgentCreation = debug('llmchat:agent:creation');

export class AgentService {
  async create(createAgentDto: CreateAgentDto): Promise<Agent> {
    debugAgentCreation('Creating agent with name: %s', createAgentDto.name);

    try {
      const agent = await this.agentRepository.create(createAgentDto);
      debugAgentCreation('Agent created successfully: %s', agent.id);
      return agent;
    } catch (error) {
      debugAgentCreation('Failed to create agent: %O', error);
      throw error;
    }
  }
}
```

## 协作流程

### Git工作流最佳实践
```bash
# ✅ 推荐: 功能分支工作流
git checkout -b feature/user-authentication
git add .
git commit -m "feat: add user authentication with JWT

- Implement login and registration endpoints
- Add JWT token generation and validation
- Create user model and database schema
- Add authentication middleware

🧪 测试状态: 单元测试通过，集成测试待完成
🔒 安全检查: 密码加密已实现

Co-Authored-By: Claude <noreply@anthropic.com>"
git push origin feature/user-authentication

# 创建Pull Request
gh pr create --title "feat: add user authentication" \
  --body "## 变更描述
实现完整的用户认证系统，包括注册、登录、JWT令牌管理等功能。

## 测试
- [ ] 单元测试通过
- [ ] 集成测试通过
- [ ] 手动测试验证

## 检查清单
- [ ] 代码符合项目规范
- [ ] 所有测试通过
- [ ] 文档已更新
- [ ] 安全审查通过"
```

### 代码审查最佳实践
```markdown
## Pull Request 模板

### 变更类型
- [ ] 新功能
- [ ] Bug修复
- [ ] 重构
- [ ] 文档更新
- [ ] 性能优化

### 变更描述
<!-- 详细描述本次变更的内容和原因 -->

### 测试情况
- [ ] 新增单元测试
- [ ] 新增集成测试
- [ ] 手动测试完成
- [ ] 性能测试通过

### 审查要点
- [ ] 代码符合项目规范
- [ ] 错误处理完善
- [ ] 安全性考虑充分
- [ ] 性能影响可接受
- [ ] 文档已同步更新

### 相关Issue
Closes #123
```

---

*最后更新: 2025-10-18*
*文档版本: v1.0*
*维护者: 开发团队*