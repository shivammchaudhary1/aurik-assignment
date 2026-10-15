export function notFound(req, res) {
  return res.status(404).json({ error: 'Route not found' });
}
export function errorHandler(err, req, res, next) {
  if (err?.type === 'entity.too.large')
    return res.status(413).json({ error: 'JSON payload too large (max 1 MB)' });
  if (err instanceof SyntaxError && 'body' in err)
    return res.status(400).json({ error: 'Invalid JSON' });
  console.error('[api]', err);
  return res.status(500).json({ error: 'Internal server error' });
}
export function optionalApiKey(req, res, next) {
  const configured = process.env.INGEST_API_KEY;
  if (configured && req.get('x-api-key') !== configured)
    return res.status(401).json({ error: 'Invalid or missing x-api-key' });
  next();
}
