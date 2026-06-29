import express from 'express';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import sessionConfig from "./config/session.js";
import path from 'path';
import { fileURLToPath } from 'url';
import expressLayouts from 'express-ejs-layouts';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { routeNotFound, globalErrorHandler } from "./middleware/errorHandler.js";
import { noCache } from "./middleware/cacheControl.js";
import morgan from 'morgan';

import passport from './config/passport.js';
import { title } from 'process';

const app = express();
dotenv.config();
connectDB();

app.use(morgan("dev"))

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(sessionConfig);

// Initialize Passport for Google OAuth
app.use(passport.initialize());
app.use(passport.session());

// Session flash & user helper middleware
app.use((req, res, next) => {
  res.locals.errorMessage = req.session.errorMessage || null;
  res.locals.successMessage = req.session.successMessage || null;
  delete req.session.errorMessage;
  delete req.session.successMessage;
  res.locals.user = req.user || req.session.user || null;
  next();
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(expressLayouts);
app.set('layout', 'layouts/user-layout');


app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, './views'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(noCache);

app.use('/', authRoutes);
app.use('/', adminRoutes);
app.use('/', userRoutes);
app.use((req, res, next) => {
    const err = new Error(`Not Found: ${req.originalUrl}`);
    err.status = 404;
    next(err); // Forwarding the 404 to the global error handler below
});

app.use(routeNotFound);  
app.use(globalErrorHandler);

// 5. Start Server listening immediately
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Express server Running on port ${PORT}`);
});
