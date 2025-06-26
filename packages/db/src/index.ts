import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';


const absoluteDbPath = '/home/bhumi/Code/chess2/db.sqlite3'; 

export const db = drizzle(new Database(absoluteDbPath), { schema });