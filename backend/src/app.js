const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');


const app = express();


app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());


const authRoutes = require('./routes/auth.routes');
app.use('/auth', authRoutes);

const addressesRoutes = require('./routes/addresses.routes');
app.use('/addresses', addressesRoutes);

const ordersRoutes = require('./routes/orders.routes');
app.use('/orders', ordersRoutes);

const agentsRoutes = require('./routes/agents.routes');
app.use('/agents', agentsRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// centralized error handler — must be LAST middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});







module.exports = app;