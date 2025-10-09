/**
 * Service Worker - PWA离线支持
 * 
 * 功能：
 * - 静态资源缓存
 * - API响应缓存
 * - 离线回退
 * - 后台同步
 */

const CACHE_NAME = 'llmchat-v1.0.0';
const RUNTIME_CACHE = 'llmchat-runtime';

// 需要缓存的静态资源
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/logo.svg',
  '/manifest.json',
];

// 安装事件 - 缓存静态资源
self.addEventListener('install', (event) => {
  console.log('[Service Worker] 安装中...');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] 缓存静态资源');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  
  // 强制激活新的Service Worker
  self.skipWaiting();
});

// 激活事件 - 清理旧缓存
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] 激活中...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            console.log('[Service Worker] 删除旧缓存:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  // 立即控制所有客户端
  self.clients.claim();
});

// Fetch事件 - 网络请求拦截
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 跳过非GET请求
  if (request.method !== 'GET') {
    return;
  }

  // API请求 - 网络优先策略
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // 克隆响应用于缓存
          const responseToCache = response.clone();
          
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, responseToCache);
          });
          
          return response;
        })
        .catch(() => {
          // 网络失败，尝试从缓存读取
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            
            // 返回离线提示
            return new Response(
              JSON.stringify({
                success: false,
                message: '网络连接失败，请检查您的网络',
                offline: true,
              }),
              {
                status: 503,
                headers: { 'Content-Type': 'application/json' },
              }
            );
          });
        })
    );
    return;
  }

  // 静态资源 - 缓存优先策略
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then((response) => {
        // 只缓存成功的响应
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }

        const responseToCache = response.clone();
        
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });

        return response;
      });
    })
  );
});

// 后台同步事件
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] 后台同步:', event.tag);
  
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncMessages());
  }
});

// 消息事件 - 与客户端通信
self.addEventListener('message', (event) => {
  console.log('[Service Worker] 收到消息:', event.data);
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.addAll(event.data.urls);
      })
    );
  }
});

// 同步消息函数（示例）
async function syncMessages() {
  try {
    // 从IndexedDB读取待同步消息
    // 发送到服务器
    // 成功后删除本地消息
    console.log('[Service Worker] 同步消息完成');
  } catch (error) {
    console.error('[Service Worker] 同步消息失败:', error);
  }
}

// Push通知事件（可选）
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'LLMChat';
  const options = {
    body: data.body || '您有新消息',
    icon: '/logo.svg',
    badge: '/logo.svg',
    data: data.url || '/',
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// 通知点击事件
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow(event.notification.data || '/')
  );
});

