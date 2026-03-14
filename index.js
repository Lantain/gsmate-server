import express from 'express';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { events, eventData } from './schema.js';
import fs from 'fs';
import path from 'path';

// Using file system path for db inside the project root
const dbDir = path.join(process.cwd(), 'db');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Ensure the db client connects to our local SQLite database
const client = createClient({
    url: 'file:./db/sqlite.db'
});
const db = drizzle(client);

const app = express();

app.use(express.json());
// Allow larger payload for our binary endpoint
app.use(express.raw({ type: 'application/octet-stream', limit: '10mb' }));

// Shared business logic
async function processIoTData(deviceId, preEventRecords, postEventRecords) {
    const timestamp = new Date();
    
    // Insert event
    const [event] = await db.insert(events).values({
        deviceId: parseInt(deviceId, 10),
        time: timestamp,
    }).returning();
    
    const eventId = event.id;
    const recordsToInsert = [];
    
    // Add pre-event records mapping
    for (const record of preEventRecords) {
        recordsToInsert.push({
            eventId,
            prePost: 'pre',
            accX: record[0],
            accY: record[1],
            accZ: record[2],
            gyrX: record[3],
            gyrY: record[4],
            gyrZ: record[5]
        });
    }
    
    // Add post-event records mapping
    for (const record of postEventRecords) {
        recordsToInsert.push({
            eventId,
            prePost: 'post',
            accX: record[0],
            accY: record[1],
            accZ: record[2],
            gyrX: record[3],
            gyrY: record[4],
            gyrZ: record[5]
        });
    }

    // Insert all data if we have records
    if (recordsToInsert.length > 0) {
        // Drizzle sqlite allows chunk inserts if payload is extremely large, but for standard IoT packets it's fine
        await db.insert(eventData).values(recordsToInsert);
    }
    
    return { success: true, eventId, insertedItems: recordsToInsert.length };
}

// 1. JSON Endpoint
app.post('/api/data/:deviceId/json', async (req, res) => {
    try {
        const deviceId = req.params.deviceId;
        const { preEvent, postEvent } = req.body;
        
        if (isNaN(Number(deviceId))) {
            return res.status(400).json({ error: 'Numerical deviceId is required in URL path' });
        }
        
        const result = await processIoTData(
            deviceId, 
            preEvent || [], 
            postEvent || []
        );
        
        res.json(result);
    } catch (error) {
        console.error("Error processing JSON data:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 2. Binary Endpoint
// Payload expected:
// First 4 bytes: number of pre-event records (Int32 LE)
// Next 4 bytes: number of post-event records (Int32 LE)
// Block of pre-event floats (N * 6 * 4 bytes)
// Block of post-event floats (M * 6 * 4 bytes)
app.post('/api/data/:deviceId/binary', async (req, res) => {
    try {
        const deviceId = req.params.deviceId;
        const buffer = req.body;
        
        if (isNaN(Number(deviceId))) {
            return res.status(400).json({ error: 'Numerical deviceId is required in URL path' });
        }

        if (!Buffer.isBuffer(buffer)) {
             return res.status(400).json({ error: 'Expected binary payload of type application/octet-stream' });
        }
        
        let offset = 0;
        
        // Read lengths
        const preCount = buffer.readInt32LE(offset); offset += 4;
        const postCount = buffer.readInt32LE(offset); offset += 4;
        
        const preEventRecords = [];
        for (let i = 0; i < preCount; i++) {
            const record = [];
            for(let j=0; j<6; j++) {
               record.push(buffer.readFloatLE(offset)); offset += 4;
            }
            preEventRecords.push(record);
        }
        
        const postEventRecords = [];
        for (let i = 0; i < postCount; i++) {
            const record = [];
            for(let j=0; j<6; j++) {
               record.push(buffer.readFloatLE(offset)); offset += 4;
            }
            postEventRecords.push(record);
        }

        const result = await processIoTData(deviceId, preEventRecords, postEventRecords);
        res.json(result);
    } catch (error) {
        console.error("Error processing binary data:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});