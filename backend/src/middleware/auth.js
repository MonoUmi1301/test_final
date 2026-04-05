const jwt = require('jsonwebtoken');
const { errorResponse } = require('../utils/response');

/**
 * JWT auth middleware with role-based access control.
 * 15m Access Token Check
 */
const auth = (roles = []) => (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json(errorResponse('UNAUTHORIZED', 'No token provided'));
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    // ตรวจสอบสิทธิ์ (RBAC) ตามบรีฟ 1.2
    if (roles.length && !roles.includes(decoded.role)) {
      return res.status(403).json(
        errorResponse('FORBIDDEN', `Requires role: ${roles.join(' or ')}`)
      );
    }

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      // ตอบ 401 พร้อม code TOKEN_EXPIRED เพื่อให้ FE ทำ Auto-Refresh (บรีฟ 1.2/1.4)
      return res.status(401).json(
        errorResponse('TOKEN_EXPIRED', 'Access token expired. Please refresh your token.')
      );
    }
    return res.status(401).json(errorResponse('INVALID_TOKEN', 'Invalid token'));
  }
};

/**
 * เฉพาะ ADMIN เท่านั้นที่ลบ Vehicle ได้ (บรีฟ 1.2)
 */
const canDeleteVehicle = (req, res, next) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json(
      errorResponse('FORBIDDEN', 'Only ADMIN can delete vehicles')
    );
  }
  next();
};

module.exports = auth;
module.exports.canDeleteVehicle = canDeleteVehicle;