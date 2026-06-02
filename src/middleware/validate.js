const validate = (schema) => {
  return (req, res, next) => {

    const { error, value } = schema.validate(
      req.body,
      {
        abortEarly: false,
        stripUnknown: true
      }
    );

    if (error) {

      const errors = error.details.map(
        item => item.message
      );

      return res.status(400).json({
        success: false,
        errors
      });
    }

    req.body = value;

    next();
  };
};

export default validate;