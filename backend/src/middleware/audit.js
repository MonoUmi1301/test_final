const { v4: uuidv4 } = require('uuid');
const db = require('../utils/db');

const auditLog = (action, resourceType, getResourceId = null) => {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);

    res.json = function (body) {
      const result = res.statusCode >= 400 ? 'FAIL' : 'SUCCESS';
      const resourceId = getResourceId
        ? getResourceId(req, body)
        : (req.params.id || body?.data?.id || body?.id || null);

      // Fire-and-forget — ไม่ await เพื่อไม่บล็อก response
      db.execute(
        `INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, ip_address, result, detail)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          req.user?.id || null,
          action,
          resourceType,
          resourceId,
          req.ip || req.headers['x-forwarded-for'] || null,
          result,
          JSON.stringify({ method: req.method, body: req.body, status: res.statusCode }),
        ]
      ).catch(err => console.error('[Audit] Failed to write log:', err.message));

      return originalJson(body);
    };

    next();
  };
};

module.exports = auditLog;