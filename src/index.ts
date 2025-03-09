import express, { Request, Response } from 'express';
import { firestore } from './firebase/firebase';
import bodyParser from 'body-parser';

import  adminRouter from './routes/adminRouter';
import teamRouter from './routes/teamsRouter';
import gameRouter from './routes/gameRouter';

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const port = process.env.PORT || 3001;
const db = firestore;

app.get('/', (req: Request, res: Response) => {
  res.send('Hello, from Express!');
});

app.use('/admin', adminRouter);
app.use('/team', teamRouter);
app.use('/game', gameRouter);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});