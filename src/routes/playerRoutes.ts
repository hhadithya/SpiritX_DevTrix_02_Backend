import express from 'express';
import {createPlayers} from '../database/playersupdate';

const playerrouter = express.Router();

// Player routes
playerrouter.post('/create', createPlayers);


export default playerrouter;