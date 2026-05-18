const { z } = require('zod');

const pakwheelsSearchQuery = {
  query: z.object({
    q: z.string().max(200).optional(),
    make: z.string().max(60).optional(),
    model: z.string().max(60).optional(),
    city: z.string().max(60).optional(),
    fuel_type: z.string().max(20).optional(),
    transmission: z.string().max(20).optional(),
    condition: z.enum(['New', 'Used']).optional(),
    body_type: z.string().max(40).optional(),
    province: z.string().max(40).optional(),
    assembly: z.string().max(40).optional(),
    min_year: z.coerce.number().int().min(1900).optional(),
    max_year: z.coerce.number().int().max(2100).optional(),
    min_price: z.coerce.number().nonnegative().optional(),
    max_price: z.coerce.number().nonnegative().optional(),
    sort: z.enum(['price_asc', 'price_desc', 'year_desc', 'newest']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
};

const idParam = { params: z.object({ id: z.string().regex(/^[a-fA-F0-9]{24}$/) }) };

module.exports = { pakwheelsSearchQuery, idParam };
