/**
 * Mock 服务器
 * 使用 Node.js 内置 http 模块实现，监听 3001 端口，支持 CORS
 */

const http = require('http');

const PORT = 3001;

// ─── Mock 数据 ────────────────────────────────────────────────────────────────

const MOCK_LEAVE_1 = {
  id: 'mock-1',
  employee_id: 'E001',
  employee_name: '张三',
  leave_type: '年假',
  start_date: '2024-01-15',
  end_date: '2024-01-19',
  days: 5,
  apply_time: '2024-01-10T09:00:00.000Z',
  status: '待审批',
  approver: '',
  reason: '年度休假',
};

const MOCK_LEAVE_NEW = {
  id: 'mock-new',
  employee_id: 'E002',
  employee_name: '李四',
  leave_type: '病假',
  start_date: '2024-02-01',
  end_date: '2024-02-03',
  days: 3,
  apply_time: '2024-01-20T10:00:00.000Z',
  status: '待审批',
  approver: '',
  reason: '身体不适',
};

const MOCK_LEAVE_1_UPDATED = {
  ...MOCK_LEAVE_1,
  reason: '年度休假（已更新）',
  end_date: '2024-01-20',
  days: 6,
};

const MOCK_LEAVE_1_APPROVED = {
  ...MOCK_LEAVE_1,
  status: '已批准',
  approver: '王五',
};

// ─── CORS 响应头 ───────────────────────────────────────────────────────────────

function setCORSHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// ─── 统一 JSON 响应 ────────────────────────────────────────────────────────────

function sendJSON(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

// ─── 读取请求体 ────────────────────────────────────────────────────────────────

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

// ─── 路由表 ───────────────────────────────────────────────────────────────────
//
// 路由匹配优先级：
//   1. 精确匹配（exactRoutes）
//   2. 正则匹配 /api/leaves/:id/status
//   3. 正则匹配 /api/leaves/:id
//
// ─────────────────────────────────────────────────────────────────────────────

// 精确路由：[method, path, handler]
const exactRoutes = [
  // GET /api/leaves → 列表
  [
    'GET',
    '/api/leaves',
    async (_req, res, _params) => {
      sendJSON(res, 200, {
        success: true,
        data: [MOCK_LEAVE_1],
        total: 1,
      });
    },
  ],

  // POST /api/leaves → 新建
  [
    'POST',
    '/api/leaves',
    async (_req, res, _params) => {
      sendJSON(res, 201, {
        success: true,
        data: MOCK_LEAVE_NEW,
      });
    },
  ],
];

// 正则路由：[method, regexp, handler(req, res, match)]
const regexRoutes = [
  // PATCH /api/leaves/:id/status → 审批（必须在 /:id 之前注册，优先匹配）
  [
    'PATCH',
    /^\/api\/leaves\/([^/]+)\/status$/,
    async (_req, res, match) => {
      const id = match[1];
      if (id !== 'mock-1') {
        return sendJSON(res, 404, { success: false, message: '记录不存在' });
      }
      sendJSON(res, 200, {
        success: true,
        data: MOCK_LEAVE_1_APPROVED,
      });
    },
  ],

  // GET /api/leaves/:id → 单条
  [
    'GET',
    /^\/api\/leaves\/([^/]+)$/,
    async (_req, res, match) => {
      const id = match[1];
      if (id !== 'mock-1') {
        return sendJSON(res, 404, { success: false, message: '记录不存在' });
      }
      sendJSON(res, 200, {
        success: true,
        data: MOCK_LEAVE_1,
      });
    },
  ],

  // PUT /api/leaves/:id → 编辑
  [
    'PUT',
    /^\/api\/leaves\/([^/]+)$/,
    async (_req, res, match) => {
      const id = match[1];
      if (id !== 'mock-1') {
        return sendJSON(res, 404, { success: false, message: '记录不存在' });
      }
      sendJSON(res, 200, {
        success: true,
        data: MOCK_LEAVE_1_UPDATED,
      });
    },
  ],

  // DELETE /api/leaves/:id → 删除
  [
    'DELETE',
    /^\/api\/leaves\/([^/]+)$/,
    async (_req, res, match) => {
      const id = match[1];
      if (id !== 'mock-1') {
        return sendJSON(res, 404, { success: false, message: '记录不存在' });
      }
      sendJSON(res, 200, {
        success: true,
        message: '删除成功',
      });
    },
  ],
];

// ─── 请求分发 ─────────────────────────────────────────────────────────────────

async function dispatch(req, res) {
  const method = req.method.toUpperCase();
  // 去掉查询字符串，只保留路径部分
  const pathname = req.url.split('?')[0];

  // 1. 处理 CORS 预检
  if (method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // 2. 精确匹配
  for (const [m, p, handler] of exactRoutes) {
    if (m === method && p === pathname) {
      return handler(req, res, null);
    }
  }

  // 3. 正则匹配
  for (const [m, regexp, handler] of regexRoutes) {
    if (m === method) {
      const match = pathname.match(regexp);
      if (match) {
        return handler(req, res, match);
      }
    }
  }

  // 4. 未匹配 → 404
  sendJSON(res, 404, { success: false, message: '接口不存在' });
}

// ─── 创建并启动服务器 ─────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  // 统一设置 CORS 头
  setCORSHeaders(res);

  dispatch(req, res).catch((err) => {
    console.error('[Mock Server Error]', err);
    sendJSON(res, 500, { success: false, message: '服务器内部错误' });
  });
});

server.listen(PORT, () => {
  console.log(`✅ Mock 服务器已启动，监听端口 ${PORT}`);
  console.log(`   Base URL: http://localhost:${PORT}`);
  console.log('');
  console.log('   支持的路由：');
  console.log('   GET    /api/leaves');
  console.log('   POST   /api/leaves');
  console.log('   GET    /api/leaves/:id');
  console.log('   PUT    /api/leaves/:id');
  console.log('   DELETE /api/leaves/:id');
  console.log('   PATCH  /api/leaves/:id/status');
});
