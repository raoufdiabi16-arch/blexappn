import { neon } from '@neondatabase/serverless';
// DATABASE_URL lives only in the host's environment variables, never in the browser.
// (Tests set BLEX_TEST_SQL to a module exporting a compatible tagged-template `sql`.)
export const sql = process.env.BLEX_TEST_SQL
  ? (await import(process.env.BLEX_TEST_SQL)).sql
  : neon(process.env.DATABASE_URL);
