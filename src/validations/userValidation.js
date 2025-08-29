const Joi = require("joi");

// Login Validation (username or email)
const validateLogin = (data) => {
  const schema = Joi.object({
    email: Joi.string().required().messages({
      "string.empty": "Email or username is required",
    }),
    password: Joi.string().required().messages({
      "string.empty": "Password is required",
    }),
  });

  return schema.validate(data);
};

module.exports = { validateLogin };
