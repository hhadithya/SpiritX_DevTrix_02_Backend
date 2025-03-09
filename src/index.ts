import express, { Request, Response } from 'express';
import { firestore } from './firebase/firebase';
import bodyParser from 'body-parser';
import cors from 'cors';
import playerrouter from './routes/playerRoutes';

import adminRouter from './routes/adminRouter';
import teamRouter from './routes/teamsRouter';
import gameRouter from './routes/gameRouter';
import tournamentRoutes from "./routes/tournament";

const app = express();

// Add CORS middleware
app.use(cors());

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const port = process.env.PORT || 3005;
const db = firestore;

app.get('/', (req: Request, res: Response) => {
  res.send('Hello, from Express!');
});

app.use('/admin', adminRouter);
app.use('/team', teamRouter);
app.use('/game', gameRouter);
app.use('/players', playerrouter);
app.use("/api/tournament-stats", tournamentRoutes);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});