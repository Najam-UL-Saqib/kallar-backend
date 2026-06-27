import { isProd } from "../config/env.js";

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function notFoundHandler(req, res) {
  res.status(404).json({ error: "Not found" });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err.name === "MulterError") {
    const message =
      err.code === "LIMIT_FILE_SIZE" ? "Image must be 1MB or smaller" : err.message;
    return res.status(400).json({ error: message });
  }

  const status = err.status || 500;
  if (status >= 500 && !isProd) {
    console.error(err);
  }
  res.status(status).json({
    error: status >= 500 ? "Internal server error" : err.message,
  });
}
