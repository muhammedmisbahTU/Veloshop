import express from 'express';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import sessionConfig from "./config/session.js";
import path from 'path';
import { fileURLToPath } from 'url';
import expressLayouts from 'express-ejs-layouts';
import authRoutes from './routes/authRoutes.js';

const app = express();
dotenv.config();
connectDB();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(sessionConfig);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(expressLayouts);
app.set('layout', 'layouts/main');

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, './views'));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', authRoutes);



// 5. Start Server listening immediately
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Express server Running on port ${PORT}`);
});
