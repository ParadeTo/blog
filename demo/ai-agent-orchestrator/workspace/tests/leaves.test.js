/**
 * 员工休假记录管理系统 - 接口测试
 *
 * 运行方式：
 *   1. 先启动后端服务：node server/app.js
 *   2. 再运行测试：  node --test tests/leaves.test.js
 *
 * 依赖：Node.js 18+（使用内置 node:test、node:assert、fetch）
 */

import test from 'node:test';
import assert from 'node:assert/strict';

/* ------------------------------------------------------------------ */
/*  基础配置                                                            */
/* ------------------------------------------------------------------ */

const BASE_URL = 'http://localhost:3000';

/** 通用 JSON 请求封装，返回 { status, body } */
async function request(method, path, body) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE_URL}${path}`, options);
  const json = await res.json();
  return { status: res.status, body: json };
}

/** 快捷方法 */
const api = {
  get:   (path)         => request('GET',    path),
  post:  (path, body)   => request('POST',   path, body),
  put:   (path, body)   => request('PUT',    path, body),
  del:   (path)         => request('DELETE', path),
  patch: (path, body)   => request('PATCH',  path, body),
};

/* ------------------------------------------------------------------ */
/*  测试数据工厂                                                        */
/* ------------------------------------------------------------------ */

/** 生成一条合法的休假申请 body，可通过 overrides 覆盖任意字段 */
function makeLeave(overrides = {}) {
  return {
    employee_id:   'EMP001',
    employee_name: '张三',
    leave_type:    '年假',
    start_date:    '2025-08-01',
    end_date:      '2025-08-03',
    reason:        '家庭旅游',
    ...overrides,
  };
}

/**
 * 创建一条休假记录并断言成功，返回创建后的 data 对象。
 * 供需要"先有数据"的测试用例复用。
 */
async function createLeave(overrides = {}) {
  const { status, body } = await api.post('/api/leaves', makeLeave(overrides));
  assert.equal(status, 201, `创建辅助数据失败，HTTP ${status}：${JSON.stringify(body)}`);
  assert.equal(body.code, 201);
  return body.data;
}

/* ================================================================== */
/*  1. GET /api/leaves  查询列表                                        */
/* ================================================================== */

test('GET /api/leaves - 无参数应返回列表及统一响应结构', async () => {
  const { status, body } = await api.get('/api/leaves');

  assert.equal(status, 200);
  assert.equal(body.code, 200);
  assert.ok(Array.isArray(body.data),          'data 应为数组');
  assert.ok(typeof body.total === 'number',    'total 应为数字');
  assert.ok(typeof body.message === 'string',  'message 应为字符串');
});

test('GET /api/leaves - 按 employee_name 模糊筛选', async () => {
  // 创建两条不同姓名的记录
  await createLeave({ employee_id: 'EMP101', employee_name: '李四_筛选测试' });
  await createLeave({ employee_id: 'EMP102', employee_name: '王五_筛选测试' });

  const { status, body } = await api.get('/api/leaves?employee_name=李四_筛选测试');

  assert.equal(status, 200);
  assert.equal(body.code, 200);
  assert.ok(body.data.length >= 1, '应至少返回 1 条记录');
  body.data.forEach((item) => {
    assert.ok(
      item.employee_name.includes('李四_筛选测试'),
      `返回记录的 employee_name 应包含"李四_筛选测试"，实际：${item.employee_name}`,
    );
  });
});

test('GET /api/leaves - 按 leave_type 精确筛选', async () => {
  await createLeave({ employee_id: 'EMP103', leave_type: '病假' });

  const { status, body } = await api.get('/api/leaves?leave_type=病假');

  assert.equal(status, 200);
  assert.equal(body.code, 200);
  assert.ok(body.data.length >= 1, '应至少返回 1 条记录');
  body.data.forEach((item) => {
    assert.equal(item.leave_type, '病假', `leave_type 应精确匹配"病假"，实际：${item.leave_type}`);
  });
});

test('GET /api/leaves - 按 status 精确筛选（默认待审批）', async () => {
  await createLeave({ employee_id: 'EMP104', employee_name: 'status筛选测试' });

  const { status, body } = await api.get('/api/leaves?status=待审批');

  assert.equal(status, 200);
  assert.equal(body.code, 200);
  assert.ok(body.data.length >= 1, '应至少返回 1 条记录');
  body.data.forEach((item) => {
    assert.equal(item.status, '待审批', `status 应精确匹配"待审批"，实际：${item.status}`);
  });
});

/* ================================================================== */
/*  2. POST /api/leaves  新建休假申请                                   */
/* ================================================================== */

test('POST /api/leaves - 成功新建，返回201及完整字段', async () => {
  const payload = makeLeave({ employee_id: 'EMP201', employee_name: '新建测试用户' });
  const { status, body } = await api.post('/api/leaves', payload);

  assert.equal(status, 201);
  assert.equal(body.code, 201);

  const data = body.data;
  assert.ok(data.id,                              'data.id 不应为空');
  assert.equal(data.employee_id,   payload.employee_id);
  assert.equal(data.employee_name, payload.employee_name);
  assert.equal(data.leave_type,    payload.leave_type);
  assert.equal(data.start_date,    payload.start_date);
  assert.equal(data.end_date,      payload.end_date);
  assert.equal(data.reason,        payload.reason);
  assert.equal(data.status,        '待审批',       '默认状态应为"待审批"');
  assert.equal(data.days,          3,              'days 应为 3（8-01 到 8-03）');
  assert.ok(data.apply_time,                      'apply_time 不应为空');
  // apply_time 应符合 ISO 8601
  assert.ok(
    !isNaN(Date.parse(data.apply_time)),
    `apply_time 应为合法 ISO 8601 字符串，实际：${data.apply_time}`,
  );
});

test('POST /api/leaves - 缺少必填字段 employee_id 应返回400', async () => {
  const payload = makeLeave();
  delete payload.employee_id;

  const { status, body } = await api.post('/api/leaves', payload);

  assert.equal(status, 400);
  assert.equal(body.code, 400);
});

test('POST /api/leaves - 缺少必填字段 employee_name 应返回400', async () => {
  const payload = makeLeave();
  delete payload.employee_name;

  const { status, body } = await api.post('/api/leaves', payload);

  assert.equal(status, 400);
  assert.equal(body.code, 400);
});

test('POST /api/leaves - 缺少必填字段 leave_type 应返回400', async () => {
  const payload = makeLeave();
  delete payload.leave_type;

  const { status, body } = await api.post('/api/leaves', payload);

  assert.equal(status, 400);
  assert.equal(body.code, 400);
});

test('POST /api/leaves - 缺少必填字段 start_date 应返回400', async () => {
  const payload = makeLeave();
  delete payload.start_date;

  const { status, body } = await api.post('/api/leaves', payload);

  assert.equal(status, 400);
  assert.equal(body.code, 400);
});

test('POST /api/leaves - 缺少必填字段 end_date 应返回400', async () => {
  const payload = makeLeave();
  delete payload.end_date;

  const { status, body } = await api.post('/api/leaves', payload);

  assert.equal(status, 400);
  assert.equal(body.code, 400);
});

test('POST /api/leaves - 缺少必填字段 reason 应返回400', async () => {
  const payload = makeLeave();
  delete payload.reason;

  const { status, body } = await api.post('/api/leaves', payload);

  assert.equal(status, 400);
  assert.equal(body.code, 400);
});

test('POST /api/leaves - end_date 早于 start_date 应返回400', async () => {
  const payload = makeLeave({
    start_date: '2025-08-10',
    end_date:   '2025-08-05', // 早于 start_date
  });

  const { status, body } = await api.post('/api/leaves', payload);

  assert.equal(status, 400);
  assert.equal(body.code, 400);
});

test('POST /api/leaves - reason 超过200字应返回400', async () => {
  const payload = makeLeave({
    reason: '超'.repeat(201), // 201 个字符
  });

  const { status, body } = await api.post('/api/leaves', payload);

  assert.equal(status, 400);
  assert.equal(body.code, 400);
});

/* ================================================================== */
/*  3. GET /api/leaves/:id  查询单条                                    */
/* ================================================================== */

test('GET /api/leaves/:id - 成功查询已存在的记录', async () => {
  const created = await createLeave({ employee_id: 'EMP301', employee_name: '单条查询测试' });

  const { status, body } = await api.get(`/api/leaves/${created.id}`);

  assert.equal(status, 200);
  assert.equal(body.code, 200);
  assert.equal(body.data.id,            created.id);
  assert.equal(body.data.employee_name, created.employee_name);
  assert.equal(body.data.leave_type,    created.leave_type);
  assert.equal(body.data.status,        '待审批');
});

test('GET /api/leaves/:id - 不存在的 id 应返回404', async () => {
  const { status, body } = await api.get('/api/leaves/nonexistent-id-99999');

  assert.equal(status, 404);
  assert.equal(body.code, 404);
});

/* ================================================================== */
/*  4. PUT /api/leaves/:id  编辑休假申请                               */
/* ================================================================== */

test('PUT /api/leaves/:id - 成功编辑待审批状态的记录', async () => {
  const created = await createLeave({ employee_id: 'EMP401', employee_name: '编辑测试用户' });

  const updatePayload = makeLeave({
    employee_id:   'EMP401',
    employee_name: '编辑测试用户',
    leave_type:    '事假',
    start_date:    '2025-09-01',
    end_date:      '2025-09-02',
    reason:        '私人事务处理',
  });

  const { status, body } = await api.put(`/api/leaves/${created.id}`, updatePayload);

  assert.equal(status, 200);
  assert.equal(body.code, 200);
  assert.equal(body.data.leave_type, '事假',      '假期类型应已更新');
  assert.equal(body.data.start_date, '2025-09-01', 'start_date 应已更新');
  assert.equal(body.data.end_date,   '2025-09-02', 'end_date 应已更新');
  assert.equal(body.data.reason,     '私人事务处理', 'reason 应已更新');
  assert.equal(body.data.days,       2,            'days 应重新计算为 2');
  assert.equal(body.data.status,     '待审批',     '状态不应改变');
});

test('PUT /api/leaves/:id - 编辑已批准状态的记录应返回403', async () => {
  // 创建 → 审批通过 → 尝试编辑
  const created = await createLeave({ employee_id: 'EMP402', employee_name: '编辑403测试' });
  await api.patch(`/api/leaves/${created.id}/status`, { status: '已批准', approver: '审批人A' });

  const { status, body } = await api.put(`/api/leaves/${created.id}`, makeLeave());

  assert.equal(status, 403);
  assert.equal(body.code, 403);
});

test('PUT /api/leaves/:id - 编辑已拒绝状态的记录应返回403', async () => {
  const created = await createLeave({ employee_id: 'EMP403', employee_name: '编辑拒绝403测试' });
  await api.patch(`/api/leaves/${created.id}/status`, { status: '已拒绝', approver: '审批人B' });

  const { status, body } = await api.put(`/api/leaves/${created.id}`, makeLeave());

  assert.equal(status, 403);
  assert.equal(body.code, 403);
});

test('PUT /api/leaves/:id - 不存在的 id 应返回404', async () => {
  const { status, body } = await api.put('/api/leaves/nonexistent-id-99999', makeLeave());

  assert.equal(status, 404);
  assert.equal(body.code, 404);
});

/* ================================================================== */
/*  5. DELETE /api/leaves/:id  删除休假申请                            */
/* ================================================================== */

test('DELETE /api/leaves/:id - 成功删除待审批状态的记录', async () => {
  const created = await createLeave({ employee_id: 'EMP501', employee_name: '删除测试用户' });

  const { status, body } = await api.del(`/api/leaves/${created.id}`);

  assert.equal(status, 200);
  assert.equal(body.code, 200);

  // 验证记录已被删除
  const { status: getStatus, body: getBody } = await api.get(`/api/leaves/${created.id}`);
  assert.equal(getStatus, 404, '删除后再查询应返回404');
  assert.equal(getBody.code, 404);
});

test('DELETE /api/leaves/:id - 删除已批准状态的记录应返回403', async () => {
  const created = await createLeave({ employee_id: 'EMP502', employee_name: '删除403测试' });
  await api.patch(`/api/leaves/${created.id}/status`, { status: '已批准', approver: '审批人C' });

  const { status, body } = await api.del(`/api/leaves/${created.id}`);

  assert.equal(status, 403);
  assert.equal(body.code, 403);
});

test('DELETE /api/leaves/:id - 删除已拒绝状态的记录应返回403', async () => {
  const created = await createLeave({ employee_id: 'EMP503', employee_name: '删除拒绝403测试' });
  await api.patch(`/api/leaves/${created.id}/status`, { status: '已拒绝', approver: '审批人D' });

  const { status, body } = await api.del(`/api/leaves/${created.id}`);

  assert.equal(status, 403);
  assert.equal(body.code, 403);
});

test('DELETE /api/leaves/:id - 不存在的 id 应返回404', async () => {
  const { status, body } = await api.del('/api/leaves/nonexistent-id-99999');

  assert.equal(status, 404);
  assert.equal(body.code, 404);
});

/* ================================================================== */
/*  6. PATCH /api/leaves/:id/status  审批                              */
/* ================================================================== */

test('PATCH /api/leaves/:id/status - 成功审批（批准）', async () => {
  const created = await createLeave({ employee_id: 'EMP601', employee_name: '审批批准测试' });

  const { status, body } = await api.patch(
    `/api/leaves/${created.id}/status`,
    { status: '已批准', approver: '张经理' },
  );

  assert.equal(status, 200);
  assert.equal(body.code, 200);
  assert.equal(body.data.status,   '已批准', 'status 应更新为"已批准"');
  assert.equal(body.data.approver, '张经理', 'approver 应被记录');
  assert.equal(body.data.id,       created.id);
});

test('PATCH /api/leaves/:id/status - 成功审批（拒绝）', async () => {
  const created = await createLeave({ employee_id: 'EMP602', employee_name: '审批拒绝测试' });

  const { status, body } = await api.patch(
    `/api/leaves/${created.id}/status`,
    { status: '已拒绝', approver: '李经理' },
  );

  assert.equal(status, 200);
  assert.equal(body.code, 200);
  assert.equal(body.data.status,   '已拒绝', 'status 应更新为"已拒绝"');
  assert.equal(body.data.approver, '李经理', 'approver 应被记录');
  assert.equal(body.data.id,       created.id);
});

test('PATCH /api/leaves/:id/status - 对已批准记录再次审批应返回403', async () => {
  const created = await createLeave({ employee_id: 'EMP603', employee_name: '重复审批403测试' });
  // 第一次审批
  await api.patch(`/api/leaves/${created.id}/status`, { status: '已批准', approver: '王经理' });
  // 第二次审批
  const { status, body } = await api.patch(
    `/api/leaves/${created.id}/status`,
    { status: '已拒绝', approver: '王经理' },
  );

  assert.equal(status, 403);
  assert.equal(body.code, 403);
});

test('PATCH /api/leaves/:id/status - 对已拒绝记录再次审批应返回403', async () => {
  const created = await createLeave({ employee_id: 'EMP604', employee_name: '拒绝后再审批403测试' });
  await api.patch(`/api/leaves/${created.id}/status`, { status: '已拒绝', approver: '赵经理' });

  const { status, body } = await api.patch(
    `/api/leaves/${created.id}/status`,
    { status: '已批准', approver: '赵经理' },
  );

  assert.equal(status, 403);
  assert.equal(body.code, 403);
});

test('PATCH /api/leaves/:id/status - approver 为空应返回400', async () => {
  const created = await createLeave({ employee_id: 'EMP605', employee_name: 'approver空400测试' });

  const { status, body } = await api.patch(
    `/api/leaves/${created.id}/status`,
    { status: '已批准', approver: '' },
  );

  assert.equal(status, 400);
  assert.equal(body.code, 400);
});

test('PATCH /api/leaves/:id/status - 缺少 approver 字段应返回400', async () => {
  const created = await createLeave({ employee_id: 'EMP606', employee_name: 'approver缺失400测试' });

  const { status, body } = await api.patch(
    `/api/leaves/${created.id}/status`,
    { status: '已批准' },
  );

  assert.equal(status, 400);
  assert.equal(body.code, 400);
});

test('PATCH /api/leaves/:id/status - 不存在的 id 应返回404', async () => {
  const { status, body } = await api.patch(
    '/api/leaves/nonexistent-id-99999/status',
    { status: '已批准', approver: '审批人' },
  );

  assert.equal(status, 404);
  assert.equal(body.code, 404);
});
