const { z } = require('zod');

const registerSchema = {
  body: z.object({
    email: z.string().email('Valid email is required'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
  }),
};

const loginSchema = {
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1, 'Password is required'),
  }),
};

module.exports = { registerSchema, loginSchema };
