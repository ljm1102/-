import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import * as dotenv from 'dotenv';
import groupRoutes from './routes/groupRoutes.js';
import postRoutes from './routes/postRoutes.js';
import commentRoutes from './routes/commentRoutes.js';

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

//DB 연결
mongoose.connect(process.env.DATABASE_URL).then(() => console.log('Connected to DB'));

// 라우터 설정
app.use('/api/groups', groupRoutes);
app.use('/api', postRoutes);
app.use('/api', commentRoutes);

app.listen(process.env.PORT || 3000, () => console.log('Server Started'));
