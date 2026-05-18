const express = require('express');
const { registerUser, loginUser } = require('../controllers/auth.controller');
const { validate } = require('../middlewares/validate');
const { authLimiter } = require('../middlewares/rateLimit');
const { registerSchema, loginSchema } = require('../validators/auth.schema');

const router = express.Router();

router.post('/register', authLimiter, validate(registerSchema), registerUser);
router.post('/login', authLimiter, validate(loginSchema), loginUser);

module.exports = router;
