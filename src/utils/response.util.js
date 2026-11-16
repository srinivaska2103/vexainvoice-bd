const sendSuccess = (res, message, data = null, statusCode = 200, pagination = undefined) => {
  const response = {
    success: true,
    message
  };
  if (data !== null) response.data = data;
  if (pagination) response.pagination = pagination;
  return res.status(statusCode).json(response);
};

const sendError = (res, message, statusCode = 400, errors = null, data = null) => {
  const response = {
    success: false,
    message
  };
  if (errors) response.errors = errors;
  if (data !== null) response.data = data;
  return res.status(statusCode).json(response);
};

module.exports = {
  sendSuccess,
  sendError
};
