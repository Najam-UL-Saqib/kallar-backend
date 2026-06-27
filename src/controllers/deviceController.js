// The deviceIdMiddleware already issues/rotates the cookie (httpOnly) on
// every request; this endpoint hands the frontend the plain device id value
// so it can tell "my" comments/likes apart in the UI. The id itself isn't a
// credential — it only matters paired with the signed cookie a browser can't
// forge — so returning it in the body is safe.
export function getDevice(req, res) {
  res.json({ deviceId: req.deviceId });
}
