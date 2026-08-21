import { buildApp } from './build-app.js';
import { configuredPort } from '../core/config.js';

const app = await buildApp({ logger: true });
const port = configuredPort();

await app.listen({ host: process.env.FASTIFY_HOST ?? '0.0.0.0', port });
app.log.info(`Fastify API listening on http://0.0.0.0:${port}/api`);
