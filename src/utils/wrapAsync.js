const wrapAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      console.error("Async error caught:", err);
      next(err);
    });
  };
};

module.exports = wrapAsync;
