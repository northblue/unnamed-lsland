// Next standalone can rebuild request.url with its 0.0.0.0 listen address.
// HTTP Host remains the requested authority; forwarded headers are not trusted.
export function checkLocalRequest(request, write = false) {
  const url = new URL(request.url);
  const host = request.headers.get('host') ?? url.host;
  if (!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i.test(host)) return false;
  let origin;
  try { origin = new URL(`${url.protocol}//${host}`).origin; } catch { return false; }
  return !write || request.headers.get('origin') === origin;
}
