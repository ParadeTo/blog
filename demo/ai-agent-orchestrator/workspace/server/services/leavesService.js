/**
 * 业务逻辑层
 */

import { v4 as uuidv4 } from 'uuid';
import * as store from '../store/leavesStore.js';
import { validateLeaveBody } from '../utils/validators.js';

// ── 工具函数 ─────────────────────────────────────────────

/**
 * 计算请假天数（自然日，含首尾）
 * @param {string} start_date - YYYY-MM-DD
 * @param {string} end_date   - YYYY-MM-DD
 * @returns {number}
 */
function calcDays(start_date, end_date) {
  return Math.round((new Date(end_date) - new Date(start_date)) / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * 统一抛出业务异常
 * @param {number} status  - HTTP 状态码
 * @param {string} message - 错误描述
 */
function throwError(status, message) {
  throw { status, message };
}

// ── Service 方法 ─────────────────────────────────────────

/**
 * 查询休假列表（支持过滤 + 降序排列）
 * @param {{ employee_name?: string, leave_type?: string, status?: string }} filters
 * @returns {object[]}
 */
export function listLeaves(filters = {}) {
  const { employee_name, leave_type, status } = filters;

  let records = store.findAll();

  // employee_name 模糊匹配
  if (employee_name && employee_name.trim() !== '') {
    records = records.filter(r => r.employee_name.includes(employee_name.trim()));
  }

  // leave_type 精确匹配
  if (leave_type && leave_type.trim() !== '') {
    records = records.filter(r => r.leave_type === leave_type.trim());
  }

  // status 精确匹配
  if (status && status.trim() !== '') {
    records = records.filter(r => r.status === status.trim());
  }

  // 按 apply_time 降序排列（最新申请排在前面）
  records.sort((a, b) => new Date(b.apply_time) - new Date(a.apply_time));

  return records;
}

/**
 * 查询单条休假记录
 * @param {string} id
 * @returns {object}
 */
export function getLeave(id) {
  const record = store.findById(id);
  if (!record) {
    throwError(404, `记录不存在，id: ${id}`);
  }
  return record;
}

/**
 * 新建休假申请
 * @param {object} body
 * @returns {object} 新建的记录
 */
export function createLeave(body) {
  // 字段校验
  const errors = validateLeaveBody(body);
  if (errors.length > 0) {
    throwError(400, errors.join('；'));
  }

  const { employee_id, employee_name, leave_type, start_date, end_date, reason } = body;

  const record = {
    id:            uuidv4(),
    employee_id:   String(employee_id).trim(),
    employee_name: String(employee_name).trim(),
    leave_type,
    start_date,
    end_date,
    days:          calcDays(start_date, end_date),
    apply_time:    new Date().toISOString(),
    status:        '待审批',
    approver:      '',
    reason:        reason !== undefined && reason !== null ? String(reason) : '',
  };

  return store.save(record);
}

/**
 * 编辑休假申请（仅限"待审批"状态）
 * @param {string} id
 * @param {object} body
 * @returns {object} 更新后的记录
 */
export function updateLeave(id, body) {
  // 确认记录存在
  const existing = getLeave(id);

  // 业务规则：仅待审批可编辑
  if (existing.status !== '待审批') {
    throwError(403, `仅"待审批"状态的记录可以编辑，当前状态：${existing.status}`);
  }

  // 字段校验
  const errors = validateLeaveBody(body);
  if (errors.length > 0) {
    throwError(400, errors.join('；'));
  }

  const { employee_id, employee_name, leave_type, start_date, end_date, reason } = body;

  const patch = {
    employee_id:   String(employee_id).trim(),
    employee_name: String(employee_name).trim(),
    leave_type,
    start_date,
    end_date,
    days:          calcDays(start_date, end_date),
    reason:        reason !== undefined && reason !== null ? String(reason) : '',
  };

  return store.update(id, patch);
}

/**
 * 删除休假申请（仅限"待审批"状态）
 * @param {string} id
 */
export function deleteLeave(id) {
  // 确认记录存在
  const existing = getLeave(id);

  // 业务规则：仅待审批可删除
  if (existing.status !== '待审批') {
    throwError(403, `仅"待审批"状态的记录可以删除，当前状态：${existing.status}`);
  }

  store.remove(id);
}

/**
 * 审批休假申请
 * @param {string} id
 * @param {{ status: string, approver: string }} body
 * @returns {object} 更新后的记录
 */
export function approveLeave(id, body) {
  // 确认记录存在
  const existing = getLeave(id);

  // 业务规则：仅待审批可审批
  if (existing.status !== '待审批') {
    throwError(403, `仅"待审批"状态的记录可以审批，当前状态：${existing.status}`);
  }

  // 校验目标状态
  const { status, approver } = body;
  if (!status || !['已批准', '已拒绝'].includes(status)) {
    throwError(400, 'status 必须为"已批准"或"已拒绝"');
  }

  // 校验审批人非空
  if (!approver || String(approver).trim() === '') {
    throwError(400, 'approver 为必填项');
  }

  return store.update(id, {
    status,
    approver: String(approver).trim(),
  });
}
