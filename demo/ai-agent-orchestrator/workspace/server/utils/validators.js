/**
 * 字段校验工具函数
 */

// ── 枚举常量 ─────────────────────────────────────────────
export const LEAVE_TYPES = ['年假', '病假', '事假', '婚假', '产假', '陪产假', '丧假'];
export const STATUSES    = ['待审批', '已批准', '已拒绝'];

/**
 * 校验日期字符串是否符合 YYYY-MM-DD 格式，且为合法日期
 * @param {string} dateStr
 * @returns {boolean}
 */
export function validateDateFormat(dateStr) {
  if (typeof dateStr !== 'string') return false;
  // 严格匹配 YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  // 验证日期合法性（如 2月30日 应返回 false）
  const date = new Date(dateStr);
  return !isNaN(date.getTime()) && date.toISOString().startsWith(dateStr);
}

/**
 * 校验新建 / 编辑请求体
 * @param {object} body
 * @returns {string[]} 错误信息数组，为空表示校验通过
 */
export function validateLeaveBody(body) {
  const errors = [];

  const { employee_id, employee_name, leave_type, start_date, end_date, reason } = body;

  // ── 必填字段 ──────────────────────────────────────────
  if (!employee_id || String(employee_id).trim() === '') {
    errors.push('employee_id 为必填项');
  }

  if (!employee_name || String(employee_name).trim() === '') {
    errors.push('employee_name 为必填项');
  }

  // ── leave_type 枚举校验 ───────────────────────────────
  if (!leave_type || String(leave_type).trim() === '') {
    errors.push('leave_type 为必填项');
  } else if (!LEAVE_TYPES.includes(leave_type)) {
    errors.push(`leave_type 必须是以下值之一：${LEAVE_TYPES.join('、')}`);
  }

  // ── 日期格式校验 ──────────────────────────────────────
  let startValid = false;
  let endValid   = false;

  if (!start_date || String(start_date).trim() === '') {
    errors.push('start_date 为必填项');
  } else if (!validateDateFormat(start_date)) {
    errors.push('start_date 格式不正确，应为 YYYY-MM-DD');
  } else {
    startValid = true;
  }

  if (!end_date || String(end_date).trim() === '') {
    errors.push('end_date 为必填项');
  } else if (!validateDateFormat(end_date)) {
    errors.push('end_date 格式不正确，应为 YYYY-MM-DD');
  } else {
    endValid = true;
  }

  // ── end_date >= start_date ────────────────────────────
  if (startValid && endValid) {
    if (new Date(end_date) < new Date(start_date)) {
      errors.push('end_date 不能早于 start_date');
    }
  }

  // ── reason 长度校验 ───────────────────────────────────
  if (reason !== undefined && reason !== null) {
    if (String(reason).length > 200) {
      errors.push('reason 最多 200 个字符');
    }
  }

  return errors;
}
