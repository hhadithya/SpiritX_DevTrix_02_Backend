import express from 'express';
import {createPlayers,createPlayer} from '../controllers/playerController';

const playerrouter = express.Router();

// Player routes
playerrouter.post('/create', createPlayers);
playerrouter.post('/create/single', createPlayer);


export default playerrouter;