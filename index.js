import express from 'express';
import { deviceRouter } from './routes/device.js';
import { deviceMiddleware } from './middlewares/device.middleware.js';
const app = express();

app.use(express.json());
app.use(express.raw({ type: 'application/octet-stream', limit: '10mb' }));

app.use('/api/devices/:deviceId', deviceRouter, deviceMiddleware)

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});