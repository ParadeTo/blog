/**
 * 控制器层
 * 负责解析请求、调用 Service、统一格式化响应
 */

import * as service from '../services/leavesService.js';

// ── 工具函数 ─────────────────────────────────────────────

/**
 * 从捕获的异常中提取 HTTP 状态码
 * @param {any} err
 * @returns {number}
 */
function resolveHttpStatus(err) {
  const status = err?.status;
  if ([400, 403, 404, 500].includes(status)) return status;
  return 500;
}

// ── 控制器方法 ───────────────────────────────────────────

/**
 * GET /api/leaves
 * 查询休假列表，支持 employee_name / leave_type / status 过滤
 */
export async function list(req, res, next) {
  try {
    const { employee_name, leave_type, status } = req.query;
    const data = service.listLeaves({ employee_name, leave_type, status });
    res.status(200).json({
      code:    200,
      data,
      total:   data.length,
      message: 'success',
    });
  } catch (err) {
    const httpStatus = resolveHttpStatus(err);
    res.status(httpStatus).json({
      code:    httpStatus,
      data:    null,
      message: err?.message || '服务器内部错误',
    });
  }
}

/**
 * GET /api/leaves/:id
 * 查询单条休假记录
 */
export async function getOne(req, res, next) {
  try {
    const { id } = req.params;
    const data = service.getLeave(id);
    res.status(200).json({
      code:    200,
      data,
      message: 'success',
    });
  } catch (err) {
    const httpStatus = resolveHttpStatus(err);
    res.status(httpStatus).json({
      code:    httpStatus,
      data:    null,
      message: err?.message || '服务器内部错误',
    });
  }
}

/**
 * POST /api/leaves
 * 新建休假申请
 */
export async function create(req, res, next) {
  try {
    const data = service.createLeave(req.body);
    res.status(201).json({
      code:    201,
      data,
      message: '申请提交成功',
    });
  } catch (err) {
    const httpStatus = resolveHttpStatus(err);
    res.status(httpStatus).json({
      code:    httpStatus,
      data:    null,
      message: err?.message || '服务器内部错误',
    });
  }
}

/**
 * PUT /api/leaves/:id
 * 编辑休假申请（仅限"待审批"状态）
 */
export async function update(req, res, next) {
  try {
    const { id } = req.params;
    const data = service.updateLeave(id, req.body);
    res.status(200).json({
      code:    200,
      data,
      message: '编辑成功',
    });
  } catch (err) {
    const httpStatus = resolveHttpStatus(err);
    res.status(httpStatus).json({
      code:    httpStatus,
      data:    null,
      message: err?.message || '服务器内部错误',
    });
  }
}

/**
 * DELETE /api/leaves/:id
 * 删除休假申请（仅限"待审批"状态）
 */
export async function remove(req, res, next) {
  try {
    const { id } = req.params;
    service.deleteLeave(id);
    res.status(200).json({
      code:    200,
      data:    null,
      message: '删除成功',
    });
  } catch (err) {
    const httpStatus = resolveHttpStatus(err);
    res.status(httpStatus).json({
      code:    httpStatus,
      data:    null,
      message: err?.message || '服务器内部错误',
    });
  }
}

/**
 * PATCH /api/leaves/:id/status
 * 审批休假申请
 */
export async function approve(req, res, next) {
  try {
    const { id } = req.params;
    const data = service.approveLeave(id, req.body);
    res.status(200).json({
      code:    200,
      data,
      message: '审批成功',
    });
  } catch (err) {
    const httpStatus = resolveHttpStatus(err);
    res.status(httpStatus).json({
      code:    httpStatus,
      data:    null,
      message: err?.message || '服务器内部错误',
    });
  }
}
