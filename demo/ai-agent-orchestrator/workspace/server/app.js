import express from 'express';
import cors from 'cors';
import leavesRouter from './routes/leaves.js';

const app = express();
const PORT = 3000;

// ── 中间件 ──────────────────────────────────────────────
app.use(cors());                        // 允许所有来源的跨域请求
app.use(express.json());                // 解析 JSON 请求体
app.use(express.static('public'));      // 托管静态文件

// ── 路由 ────────────────────────────────────────────────
app.use('/api/leaves', leavesRouter);

// ── 全局错误处理中间件 ───────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[GlobalError]', err);
  const httpStatus = err.status || 500;
  const code       = err.status || 500;
  const message    = err.message || '服务器内部错误';
  res.status(httpStatus).json({ code, data: null, message });
});

// ── 启动服务 ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅  Server is running at http://localhost:${PORT}`);
});

export default app;
