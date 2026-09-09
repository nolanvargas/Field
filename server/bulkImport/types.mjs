/**
 * @typedef {'new' | 'update' | 'conflict' | 'error'} ImportRowStatus
 */

/**
 * @typedef {Object} ImportPreviewRow
 * @property {number} rowIndex
 * @property {ImportRowStatus} status
 * @property {string[]} [errors]
 * @property {Record<string, string>} imported
 * @property {Record<string, string>} [existing]
 * @property {string} [matchId]
 */

/**
 * @typedef {Object} ImportApplyRow
 * @property {number} rowIndex
 * @property {ImportRowStatus} status
 * @property {Record<string, string>} imported
 * @property {Record<string, string>} [existing]
 * @property {string} [matchId]
 * @property {Record<string, 'imported' | 'existing'>} [resolution]
 */

export {};
