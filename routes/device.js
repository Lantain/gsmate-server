import { Router } from 'express';
import { db } from '../db/index.js';
import { events, eventData } from '../db/schema.js';
import dotenv from 'dotenv'
dotenv.config()

const router = Router()

router.get('/events',  async (req, res) => {
    try {
        const page = req.query.page || 1
        const perPage = req.query.perPage || 100

        const events = await db.select().from(events).limit(perPage).offset((page - 1) * perPage)
        return res.status(200).json({
            data: events,
            page,
            perPage
        })
    } catch (error) {
        return res.status(500).json({
            error: error.message
        })
    }
})

router.get('/events/:id', async (req, res) => {
    try {
        const id = req.params.id
        if (isNaN(+id)) {
            return res.status(400).send('')
        }

        const event = await db.select().from(events).where(`event_id=${id}`).leftJoin(eventData).limit(1)
        if (!event) {
            return res.status(404).json({ message: "Record not found" })
        }
        return res.status(200).json(event)
    } catch (error) {
        return res.status(500).json({
            error: error.message
        })
    }
})

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

router.post('/events/json', async (req, res) => {
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

router.post('/events/binary', async (req, res) => {
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

export const deviceRouter = router