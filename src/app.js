import express from 'express';
import dotenv from 'dotenv';
import connectDB from './config/db.js';

const app = express();

dotenv.config();

connectDB();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

//  Test Route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'healthy', message: 'Veloshop API is running' });
});

// 5. Start Server listening immediately
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Express server Running on port ${PORT}`);
});
