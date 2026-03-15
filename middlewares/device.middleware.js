
export const deviceMiddleware = (req, res, next) => {
    const deviceId = req.params.deviceId;
    if (isNaN(Number(deviceId))) {
        return res.status(400).json({ error: 'Numerical deviceId is required in URL path' });
    }
    req.deviceId = deviceId
    next()
}