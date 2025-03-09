import express from 'express';
import {createPlayers,createPlayer,getPlayers} from '../controllers/playerController';

const playerrouter = express.Router();

// Player routes
playerrouter.post('/create', createPlayers);
playerrouter.post('/create/single', createPlayer);
playerrouter.get('/get', getPlayers);


export default playerrouter;