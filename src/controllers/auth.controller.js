const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const { UnauthorizedError, AppError } = require('../errors/AppError');

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET || 'supersecretjwtkey_for_fyp_pqc', { expiresIn: '30d' });

const registerUser = async (req, res) => {
  const { email, password } = req.body;

  const userExists = await User.findOne({ email });
  if (userExists) throw new AppError('User already exists', 409, 'DUPLICATE');

  const user = await User.create({ email, password_hash: password });
  res.status(201).json({
    success: true,
    data: { _id: user.id, email: user.email, token: generateToken(user._id) },
  });
};

const loginUser = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user || !(await user.matchPassword(password))) {
    throw new UnauthorizedError('Invalid credentials');
  }
  res.status(200).json({
    success: true,
    data: { _id: user.id, email: user.email, token: generateToken(user._id) },
  });
};

module.exports = { registerUser, loginUser };
