import express from 'express';
import { getPlayers, getPlayerById, addPlayer, updatePlayer } from '../controllers/playerController';

const adminRouter = express.Router();

// TODO: Add authentication & admin check middleware
// adminRouter.use(checkAuth);
// adminRouter.use(isAdmin);

adminRouter.get('/players', getPlayers);
adminRouter.get('/players/:id', getPlayerById);
adminRouter.post('/players', addPlayer);
adminRouter.put('/players/:id', updatePlayer);

export default adminRouter;
