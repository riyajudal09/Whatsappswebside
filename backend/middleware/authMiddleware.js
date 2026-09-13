const jwt = require('jsonwebtoken');
const response = require('../utils/responseHandler');

module.exports = (req, res, next) => {
  try {
    const bearer = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null;
    const token = req.cookies?.auth_token || bearer;
    if (!token) return response(res, 401, 'Unauthorized');
    if (!process.env.JWT_SECRET) return response(res, 500, 'JWT_SECRET is not configured');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { ...decoded, userId: decoded.userId || decoded.id };
    if (!req.user.userId) return response(res, 401, 'Invalid authentication token');
    next();
  } catch (error) {
    return response(res, 401, 'Unauthorized: invalid or expired token');
  }
};
