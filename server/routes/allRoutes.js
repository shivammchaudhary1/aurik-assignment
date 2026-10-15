import { Router } from 'express';

import { ingest } from '../controllers/ingest.controller.js';
import { getJob } from '../controllers/jobs.controller.js';
import { getMachine } from '../controllers/machine.controller.js';
import { getPlantSummary, getLineSummary } from '../controllers/summary.controller.js';
import { optionalApiKey } from '../middleware/errorHandler.js';

const router = Router();

router.post('/ingest/pulseforge', optionalApiKey, ingest('pulseforge'));
router.post('/ingest/thermexwatch', optionalApiKey, ingest('thermexwatch'));
router.post('/ingest/maintaflow', optionalApiKey, ingest('maintaflow'));
router.get('/jobs/:jobId', getJob);
router.get('/machines/:machineId/status', getMachine);
router.get('/plants/:plantId/summary', getPlantSummary);
router.get('/plants/:plantId/lines/:lineId/summary', getLineSummary);

export default router;
