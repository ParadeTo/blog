/**
 * 内存存储层
 * 使用 Map 作为数据容器，key 为记录 id，value 为记录对象
 */

const store = new Map();

/**
 * 返回所有记录组成的数组
 * @returns {Array}
 */
export function findAll() {
  return Array.from(store.values());
}

/**
 * 根据 id 查询单条记录
 * @param {string} id
 * @returns {object|undefined}
 */
export function findById(id) {
  return store.get(id);
}

/**
 * 保存新记录
 * @param {object} record - 必须包含 id 字段
 * @returns {object} 保存后的记录
 */
export function save(record) {
  store.set(record.id, record);
  return record;
}

/**
 * 合并更新指定 id 的记录
 * @param {string} id
 * @param {object} data - 需要更新的字段
 * @returns {object} 更新后的完整记录
 */
export function update(id, data) {
  const updated = { ...store.get(id), ...data };
  store.set(id, updated);
  return updated;
}

/**
 * 删除指定 id 的记录
 * @param {string} id
 */
export function remove(id) {
  store.delete(id);
}
