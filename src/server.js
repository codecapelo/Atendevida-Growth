import express from 'express';
import { env } from '#config/env.js';
import { logger } from '#lib/logger.js';
import { startCronJobs } from '#jobs/instagram-poster.js';
import { startMetricsCollector } from '#jobs/metrics-collector.js';
import healthRoute from '#routes/health.js';
import webhookRoute from '#routes/webhook.js';

const app = express();
app.use(express.json());

app.use('/health', healthRoute);
app.use('/webhook', webhookRoute);

if (env.ENABLE_AUTOPOST) {
  startCronJobs();
}

if (env.ENABLE_METRICS_COLLECTOR) {
  startMetricsCollector();
}

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, dry_run: env.DRY_RUN }, 'Server up');
});
