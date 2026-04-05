require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { errorResponse } = require('./utils/response');

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/vehicles', require('./routes/vehicles'));
app.use('/api/drivers', require('./routes/drivers'));
app.use('/api/trips', require('./routes/trips'));
app.use('/api/checkpoints', require('./routes/checkpoints'));
app.use('/api/maintenance', require('./routes/maintenance'));
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/audit-logs', require('./routes/auditLogs'));

// 404
app.use((req, res) => {
  res.status(404).json(errorResponse('NOT_FOUND', `Route ${req.originalUrl} not found`));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[UNHANDLED]', err);
  res.status(500).json(errorResponse('SERVER_ERROR', err.message || 'Internal server error'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Fleet API running on port ${PORT}`));
