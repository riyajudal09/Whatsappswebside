const jwt = require('jsonwebtoken');

module.exports = (id) => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured');
  return jwt.sign({ userId: id.toString() }, process.env.JWT_SECRET, { expiresIn: '30d' });
};
