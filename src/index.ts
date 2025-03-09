import express, { Request, Response } from 'express';
import { firestore } from './firebase/firebase';

import  adminRouter from './routes/adminRouter';

const app = express();
const port = process.env.PORT || 3001;
const db = firestore;

app.get('/', (req: Request, res: Response) => {
  res.send('Hello, from Express!');
});

app.use('/admin', adminRouter);