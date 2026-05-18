const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const { UnauthorizedError } = require('../errors/AppError');

const protect = async (req, _res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Not authorized — missing token'));
  }
  const token = auth.split(' ')[1];
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretjwtkey_for_fyp_pqc');
  } catch (_e) {
    return next(new UnauthorizedError('Not authorized — invalid or expired token'));
  }
  req.user = await User.findById(decoded.id).select('-password_hash');
  if (!req.user) return next(new UnauthorizedError('Not authorized — user not found'));
  next();
};

module.exports = { protect };
