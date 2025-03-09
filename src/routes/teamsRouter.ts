import express from 'express';
import { createTeam, getTeam } from '../controllers/teamsController';

const teamRouter = express.Router();

// TODO: Add authentication & admin check middleware
// adminRouter.use(checkAuth);
// adminRouter.use(isAdmin);

teamRouter.get('/teams', getTeam);
// adminRouter.get('/players/:id', getPlayerById);
teamRouter.post('/createTeam', createTeam);
// adminRouter.put('/players/:id', updatePlayer);
// adminRouter.delete('/players/:id', deletePlayer);

export default teamRouter;
