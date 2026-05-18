const { z } = require('zod');

const objectIdParam = z.object({
  id: z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid id'),
});

const paginationQuery = z.object({
  page:  z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const searchQuery = {
  query: z.object({
    q:    z.string().min(1, 'Query is required').max(200),
    lang: z.enum(['en', 'ur', 'ro']).optional().default('en'),
  }),
};

const categoryParams = {
  params: z.object({ category: z.string().min(1).max(80) }),
  query:  paginationQuery,
};

const idParams = { params: objectIdParam };
const listQuery = { query: paginationQuery };

module.exports = { searchQuery, categoryParams, idParams, listQuery };
