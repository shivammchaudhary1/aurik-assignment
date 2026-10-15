import { queueIngestion } from '../services/ingestionService.js';
export function ingest(vendor) {
  return async (req, res, next) => {
    try {
      const result = await queueIngestion(vendor, req.body);
      return res.status(202).json(result);
    } catch (err) {
      if (/validation|duplicate key/i.test(err.message)) return next(err);
      return res.status(400).json({ error: err.message });
    }
  };
}
