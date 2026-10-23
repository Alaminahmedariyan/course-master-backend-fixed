// middleware to validate request bodies against Zod schemas

const validate = (schema) => (req, res, next) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (err) {
    // FIX (BUG-015): Zod v4 exposes the details as `issues` (not `errors`)
    return res.status(400).json({
      message: "Validation error",
      errors: (err.issues || []).map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })),
    });
  }
};

module.exports = validate;