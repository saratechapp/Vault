// Aggregates every consumer-facing router. Mounted at the app root by
// src/app.js (each route file declares its own full `/api/...` path).
const express = require('express');
const consumerRoutes = require('./consumer.routes');

const router = express.Router();

router.use(consumerRoutes);

module.exports = router;
