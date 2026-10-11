import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from './data-source';

// Loaded only by the TypeORM CLI (`npm run migration:*`), after `node --env-file=.env`.
// Without this check, pg falls back to localhost:5432 and fails with ECONNREFUSED.
const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL is missing. Set it in backend/.env (copy backend/.env.example).');
}

export default new DataSource(buildDataSourceOptions(url));
