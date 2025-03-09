import express from 'express';
import { getPlayers, getPlayerById, createPlayer, updatePlayer, deletePlayer } from '../controllers/playerController';

const adminRouter = express.Router();

// TODO: Add authentication & admin check middleware
// adminRouter.use(checkAuth);
// adminRouter.use(isAdmin);

adminRouter.get('/players', getPlayers);
adminRouter.get('/players/:id', getPlayerById);
adminRouter.post('/player', createPlayer);
adminRouter.put('/players/:id', updatePlayer);
adminRouter.delete('/players/:id', deletePlayer);

export default adminRouter;
