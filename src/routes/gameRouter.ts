import express from 'express';
import { createGame, getJoinedGames, joinGame } from '../controllers/gameController';

const gameRouter = express.Router();


gameRouter.get('/joinedUsers', getJoinedGames); // userId
gameRouter.post('/joinGame', joinGame);
gameRouter.post('/createGame', createGame);
// gameRouter.put('/players/:id', updatePlayer);
// gameRouter.delete('/players/:id', deletePlayer);

export default gameRouter;
