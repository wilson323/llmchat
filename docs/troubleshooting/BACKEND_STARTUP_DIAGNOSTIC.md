# 后端启动失败诊断报告

**日期**: 2025-10-17 21:13 UTC  
**问题**: 后端服务启动后立即以 exit code 1 退出  
**状态**: 🔴 诊断完成，需要修复

---

## 🔍 诊断发现

### 启动流程日志
✅ **成功的步骤**:
1. 环境变量加载成功 (101个变量)
2. 必需环境变量验证成功
3. `startServer()` 函数被正确调用

❌ **失败的步骤**:
- 在 `initDB()` 调用过程中发生错误
- 错误被catch块捕获，但错误信息没有完整显示
- 进程以 exit code 1 退出

---

## 💻 立即尝试的修复

### 快速方案：改进错误日志

编辑 `backend/src/index.ts` 的 catch 块（第487-489行）：

```typescript
} catch (error: any) {
  console.error("=== 启动失败的完整错误 ===");
  console.error("错误消息:", error?.message);
  console.error("错误堆栈:", error?.stack);
  logger.error("服务器启动失败", { error });
  process.exit(1);
}
```

然后重新运行: `pnpm run dev`

---

## 📊 当前配置

**数据库**: 171.43.138.237:5443 (zkteco)  
**Redis**: localhost:6379 ✅  
**网络状态**: 数据库端口可访问

---

## 🔧 如果是数据库问题

临时禁用initDB来测试：

```bash
# 编辑 backend/src/index.ts，第389行改为：
if (process.env.SKIP_DB_INIT !== 'true') {
  await initDB();
}

# 运行
SKIP_DB_INIT=true pnpm run dev
```

---

**建议**: 先尝试改进日志方案，获取详细错误信息后可以精准诊断问题。
