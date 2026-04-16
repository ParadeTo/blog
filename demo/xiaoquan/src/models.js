/**
 * @typedef {Object} Attachment
 * @property {string} msgType   - "image" | "file"
 * @property {string} fileKey   - Feishu file_key or image_key
 * @property {string} fileName  - "{image_key}.jpg" for images
 */

/**
 * @typedef {Object} InboundMessage
 * @property {string} routingKey  - "p2p:{open_id}" | "group:{chat_id}" | "thread:{chat_id}:{thread_id}"
 * @property {string} content     - plain text
 * @property {string} msgId       - Feishu message_id
 * @property {string} rootId      - thread root message ID
 * @property {string} senderId    - open_id
 * @property {number} ts          - millisecond timestamp
 * @property {boolean} isCron     - true if from CronService
 * @property {Attachment|null} attachment
 */

/**
 * @param {Object} opts
 * @returns {InboundMessage}
 */
export function createInboundMessage({
  routingKey,
  content = '',
  msgId,
  rootId,
  senderId,
  ts = Date.now(),
  isCron = false,
  attachment = null,
}) {
  return {routingKey, content, msgId, rootId: rootId || msgId, senderId, ts, isCron, attachment}
}

/**
 * @typedef {Object} MessageEntry
 * @property {string} role      - "user" | "assistant"
 * @property {string} content
 * @property {number} ts        - millisecond timestamp
 * @property {string|null} feishuMsgId
 */

/**
 * @typedef {Object} SessionEntry
 * @property {string} id          - "s-{12hex}"
 * @property {string} createdAt   - ISO 8601 UTC
 * @property {boolean} verbose
 * @property {number} messageCount
 */
