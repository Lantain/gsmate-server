import fs from 'fs';
import path from 'path';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';

const dbDir = path.join(process.cwd(), 'db');

if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const client = createClient({
    url: 'file:./sqlite.db'
});

export const db = drizzle(client);