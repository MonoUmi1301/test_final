/**
 * Alert Engine — plugin-based architecture.
 * Core never changes. New rules are registered via registerRule().
 * Each rule receives a db pool and returns Alert[] or [].
 *
 * Alert shape:
 * {
 *   severity: 'WARNING' | 'CRITICAL',
 *   affected_resource_type: string,
 *   affected_resource_id: string,
 *   message: string,
 * }
 */

const rules = [];

const alertEngine = {
  /**
   * Register a new alert rule.
   * @param {(db: Pool) => Promise<Alert[]>} ruleFn
   */
  registerRule(ruleFn) {
    rules.push(ruleFn);
  },

  /**
   * Run all registered rules and collect alerts.
   * @param {Pool} db
   * @returns {Promise<Alert[]>}
   */
  async process(db) {
    const alerts = [];
    for (const rule of rules) {
      try {
        const result = await rule(db);
        if (Array.isArray(result)) alerts.push(...result);
      } catch (err) {
        console.error('[AlertEngine] Rule error:', err.message);
      }
    }
    return alerts;
  },
};

module.exports = alertEngine;
