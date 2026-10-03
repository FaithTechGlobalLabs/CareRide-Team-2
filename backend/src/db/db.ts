import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import { Pool } from "pg";

// .env is at the repo root but dotenv looks in cwd, so running anything from backend/ found
// nothing and pg quietly connected somewhere else. point it at the file instead.
// docker still wins since dotenv won't overwrite vars that are already set.
const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, "../../../.env"), quiet: true });

export const pool = new Pool({
  host: process.env.POSTGRES_HOST ,
  port: Number(process.env.POSTGRES_PORT),
  user: process.env.POSTGRES_USER ,
  password: process.env.POSTGRES_PASSWORD ,
  database: process.env.POSTGRES_DB ,
});
