const apiResponse = {
  success(res, message, data = null, statusCode = 200, meta = null) {
    const payload = { success: true, message }
    if (data !== null) payload.data = data
    if (meta !== null) payload.meta = meta
    return res.status(statusCode).json(payload)
  },

  error(res, message, statusCode = 400, errors = null) {
    return res.status(statusCode).json({
      success: false,
      message,
      ...(errors && { errors })
    })
  }
}

module.exports = apiResponse