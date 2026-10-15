import express from 'express';
import routes from './routes/allRoutes.js';
const app = express();
import { connectDb } from './config/db.js';
import { loadEnvFile } from 'node:process';

loadEnvFile('.env');

app.use(express.json());
app.use('/api', routes);

app.get('/health', (req, res) =>
  res.json({ status: 'ok', service: 'aurik-monitoring' })
);

app.listen(process.env.PORT || 5000, async () => {
  try {
    await connectDb();
    console.log('[db] connected');
  } catch (err) {
    console.error('[db] connection error:', err.message);
    process.exit(1);
  }
  console.log('Server is running on port 3000');
});
