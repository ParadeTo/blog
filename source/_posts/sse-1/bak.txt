## 性能优化与最佳实践

### 1. 连接管理

```javascript
// 连接池管理
class SSEConnectionManager {
  constructor() {
    this.connections = new Map()
    this.maxConnections = 1000
  }

  addConnection(id, response) {
    // 检查连接数限制
    if (this.connections.size >= this.maxConnections) {
      this.cleanupStaleConnections()
    }

    this.connections.set(id, {
      response,
      lastPing: Date.now(),
      created: Date.now(),
    })
  }

  cleanupStaleConnections() {
    const now = Date.now()
    const staleThreshold = 5 * 60 * 1000 // 5分钟

    for (const [id, conn] of this.connections.entries()) {
      if (now - conn.lastPing > staleThreshold) {
        try {
          conn.response.end()
        } catch (e) {
          console.log('清理连接时出错:', e.message)
        }
        this.connections.delete(id)
      }
    }
  }

  broadcast(message) {
    const deadConnections = []

    for (const [id, conn] of this.connections.entries()) {
      try {
        conn.response.write(`data: ${JSON.stringify(message)}\n\n`)
        conn.lastPing = Date.now()
      } catch (error) {
        deadConnections.push(id)
      }
    }

    // 清理失效连接
    deadConnections.forEach((id) => this.connections.delete(id))
  }
}
```

### 2. 消息压缩

```javascript
const zlib = require('zlib')

function compressMessage(data) {
  const jsonString = JSON.stringify(data)

  // 对于大消息启用压缩
  if (jsonString.length > 1024) {
    return zlib.gzipSync(jsonString).toString('base64')
  }

  return jsonString
}

// 发送压缩消息
function sendCompressedMessage(res, data) {
  const compressed = compressMessage(data)
  const isCompressed = compressed !== JSON.stringify(data)

  res.write(
    `data: ${JSON.stringify({
      compressed: isCompressed,
      data: compressed,
    })}\n\n`
  )
}
```

### 3. 错误处理与监控

```javascript
class SSEMonitor {
  constructor() {
    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      messagesSent: 0,
      errors: 0,
      reconnections: 0,
    }
  }

  recordConnection() {
    this.metrics.totalConnections++
    this.metrics.activeConnections++
  }

  recordDisconnection() {
    this.metrics.activeConnections = Math.max(
      0,
      this.metrics.activeConnections - 1
    )
  }

  recordMessage() {
    this.metrics.messagesSent++
  }

  recordError() {
    this.metrics.errors++
  }

  recordReconnection() {
    this.metrics.reconnections++
  }

  getMetrics() {
    return {
      ...this.metrics,
      timestamp: new Date().toISOString(),
    }
  }
}

const monitor = new SSEMonitor()

// 在SSE端点中使用
app.get('/events', (req, res) => {
  monitor.recordConnection()

  // ... SSE逻辑

  req.on('close', () => {
    monitor.recordDisconnection()
  })

  req.on('error', () => {
    monitor.recordError()
    monitor.recordDisconnection()
  })
})

// 监控端点
app.get('/metrics', (req, res) => {
  res.json(monitor.getMetrics())
})
```

## 安全考虑

### 1. 认证与授权

```javascript
const jwt = require('jsonwebtoken')

function authenticateSSE(req, res, next) {
  const token = req.query.token || req.headers.authorization?.split(' ')[1]

  if (!token) {
    return res.status(401).json({error: '缺少认证token'})
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = decoded
    next()
  } catch (error) {
    return res.status(401).json({error: '无效的token'})
  }
}

// 受保护的SSE端点
app.get('/secure-events', authenticateSSE, (req, res) => {
  // ... SSE逻辑
  console.log(`用户 ${req.user.userId} 连接到安全事件流`)
})
```

### 2. 速率限制

```javascript
const rateLimit = require('express-rate-limit')

const sseRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 10, // 每个IP最多10个连接
  message: '连接过于频繁，请稍后再试',
  standardHeaders: true,
  legacyHeaders: false,
})

app.get('/events', sseRateLimit, (req, res) => {
  // ... SSE逻辑
})
```

### 3. CORS 配置

```javascript
const cors = require('cors')

const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  optionsSuccessStatus: 200,
}

app.use(cors(corsOptions))

// 或者在SSE端点中手动设置
app.get('/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': req.headers.origin || '*',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Cache-Control, Last-Event-ID',
  })

  // ... 其他逻辑
})
```

## 调试与测试

### 1. SSE 调试工具

```javascript
// 调试中间件
function sseDebugger(req, res, next) {
  const originalWrite = res.write

  res.write = function (chunk, encoding) {
    console.log('📤 发送SSE数据:', chunk.toString())
    return originalWrite.call(this, chunk, encoding)
  }

  next()
}

app.use('/events', sseDebugger)
```

### 2. 客户端调试

```javascript
class DebugSSEClient {
  constructor(url) {
    this.url = url
    this.eventSource = null
    this.stats = {
      connected: false,
      messagesReceived: 0,
      errors: 0,
      reconnects: 0,
      lastMessage: null,
    }

    this.connect()
  }

  connect() {
    console.log('🔗 连接SSE:', this.url)
    this.eventSource = new EventSource(this.url)

    this.eventSource.onopen = (event) => {
      console.log('✅ SSE连接已建立', event)
      this.stats.connected = true
      this.logStats()
    }

    this.eventSource.onmessage = (event) => {
      console.log('📨 收到消息:', event.data)
      this.stats.messagesReceived++
      this.stats.lastMessage = {
        data: event.data,
        timestamp: new Date().toISOString(),
        lastEventId: event.lastEventId,
      }
      this.logStats()
    }

    this.eventSource.onerror = (event) => {
      console.error('❌ SSE连接错误:', event)
      this.stats.connected = false
      this.stats.errors++
      this.stats.reconnects++
      this.logStats()
    }
  }

  logStats() {
    console.table(this.stats)
  }

  getStats() {
    return this.stats
  }
}

// 使用
const debugClient = new DebugSSEClient('/events')
```

### 3. 单元测试示例

```javascript
const request = require('supertest')
const app = require('../app') // 你的Express应用

describe('SSE端点测试', () => {
  test('应该建立SSE连接', (done) => {
    const req = request(app)
      .get('/events')
      .expect(200)
      .expect('Content-Type', /text\/event-stream/)

    let messageCount = 0

    req.on('data', (chunk) => {
      const data = chunk.toString()
      if (data.includes('data:')) {
        messageCount++
        if (messageCount >= 2) {
          req.destroy()
          done()
        }
      }
    })

    req.on('error', done)
  })

  test('应该支持Last-Event-ID', (done) => {
    request(app)
      .get('/events')
      .set('Last-Event-ID', '123')
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)
        // 验证响应包含续传消息
        done()
      })
  })
})
```

## 生产环境部署

### 1. Nginx 反向代理配置

```nginx
server {
    listen 80;
    server_name example.com;

    location /events {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection '';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE特定配置
        proxy_cache off;
        proxy_buffering off;
        proxy_read_timeout 24h;
        proxy_send_timeout 24h;
    }
}
```

### 2. Docker 配置

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

# 设置健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "server.js"]
```

### 3. 集群部署考虑

```javascript
// 使用Redis进行跨实例消息广播
const redis = require('redis')
const client = redis.createClient()

// 订阅消息
client.subscribe('sse-broadcast')

client.on('message', (channel, message) => {
  if (channel === 'sse-broadcast') {
    const data = JSON.parse(message)
    // 广播给当前实例的所有连接
    broadcastToLocalConnections(data)
  }
})

// 发布消息到所有实例
function broadcastToCluster(message) {
  client.publish('sse-broadcast', JSON.stringify(message))
}
```
