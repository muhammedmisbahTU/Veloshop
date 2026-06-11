export const routeNotFound = (req, res, next) => {
    const error = new Error(`The requested path ${req.originalUrl} was not found.`);
    error.status = 404;
    next(error); 
};

export const globalErrorHandler = (err, req, res, next) => {
  console.error(err.stack || err);
  const statusCode = err.status || 500;
  
  res.status(statusCode);
  return res.render("errors/error", {
    title: `Error ${statusCode}`,
    message: err.message || "Something went wrong.",
    status: statusCode,
    error: process.env.NODE_ENV === "development" ? err : {}
  });
};