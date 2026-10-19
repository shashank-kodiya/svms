export const notFound = (req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
};

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  let status = err.statusCode || 500;
  let message = err.message || 'Something went wrong.';

  if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'value';
    message = `An account with this ${field} already exists.`;
  } else if (err.name === 'ValidationError') {
    status = 422;
    message = Object.values(err.errors)[0]?.message || 'Invalid data.';
  } else if (err.name === 'CastError') {
    status = 400;
    message = 'Invalid ID.';
  }

  if (status >= 500) console.error(err);
  res.status(status).json({
    message: status >= 500 && process.env.NODE_ENV === 'production' ? 'Server error. Please try again.' : message,
    ...(err.details ? { details: err.details } : {})
  });
};
