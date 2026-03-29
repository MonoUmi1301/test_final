const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { errorResponse, successResponse } = require('../utils/response');
const alertEngine = require('../utils/alertEngine');

// Register all rules on startup
require('../utils/alertRules');

// GET /api/alerts (ข้อ 4.2)
router.get('/', auth(), async (req, res) => {
  const db = require('../utils/db');
  const { severity, resource_type } = req.query;

  try {
    let alerts = await alertEngine.process(db);

    if (severity) alerts = alerts.filter(a => a.severity === severity);
    if (resource_type) alerts = alerts.filter(a => a.affected_resource_type === resource_type);

    return res.json(successResponse(alerts, { total: alerts.length }));
  } catch (err) {
    return res.status(500).json(errorResponse('SERVER_ERROR', err.message));
  }
});

module.exports = router;
