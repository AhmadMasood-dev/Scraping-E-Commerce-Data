/**
 * Zod runner: pass `{ body, query, params }` schemas; mutates req with parsed
 * (coerced) values. Throws ZodError → caught by global error middleware.
 */
const validate = (schemas = {}) => (req, _res, next) => {
  if (schemas.body)   req.body   = schemas.body.parse(req.body);
  if (schemas.query)  req.query  = schemas.query.parse(req.query);
  if (schemas.params) req.params = schemas.params.parse(req.params);
  next();
};

module.exports = { validate };
