const { z } = require('zod');

const zameenSearchQuery = {
  query: z.object({
    q: z.string().max(200).optional(),
    city: z.string().max(80).optional(),
    property_type: z.string().max(60).optional(),
    purpose: z.string().max(40).optional(),
    min_price: z.coerce.number().nonnegative().optional(),
    max_price: z.coerce.number().nonnegative().optional(),
    bedrooms: z.coerce.number().int().min(0).optional(),
    baths: z.coerce.number().int().min(0).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
};

const zameenCategoryParams = {
  params: z.object({ type: z.string().min(1).max(60) }),
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
};

module.exports = { zameenSearchQuery, zameenCategoryParams };
