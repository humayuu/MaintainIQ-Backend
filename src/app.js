import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import routes from './routes/index.js';
import notFound from './middleware/notFound.js';
import errorHandler from './middleware/errorHandler.js';

const app = express();

// Security headers.
app.use(helmet());

// Cross-origin requests.
app.use(cors());

// Request logging (only noisy in development).
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Body parsers.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes.
app.use('/api', routes);

// 404 for anything unmatched, then the central error handler.
app.use(notFound);
app.use(errorHandler);

export default app;
