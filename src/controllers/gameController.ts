import { Request, Response } from 'express';
import { firestore } from '../firebase/firebase';
import { join } from 'path';

export const deleteGame = async (req: Request, res: Response): Promise<any> => {
    try {
        const playerRef = firestore.collection('games').doc(req.params.id);
        const playerDoc = await playerRef.get();

        if (!playerDoc.exists || !playerDoc.data()?.activeStatus) {
            return res.status(404).json({ error: 'Player not found' });
        }

        // await playerRef.delete();  // THIS IS PERMANENT DELETE

        // instead, we update the activeStatus field to false
        await playerRef.update({ activeStatus: false });
        res.json({ message: 'Player deleted successfully' });
    } catch (error) {
        console.error('Error deleting player:', error);
        res.status(500).json({ error: 'Failed to delete player' });
    }
}
export const createGame = async (req: Request, res: Response): Promise<any> => {

    const { gameName, gameStartDateTime, gameEndDateTime } = req.body;
    const gameDocName = gameName.replace(/ /g, '_');


    if (!gameName || !gameStartDateTime || !gameEndDateTime) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    if (typeof gameName !== 'string' || gameName.length < 1 || gameName.length > 50 || !/^[a-zA-Z0-9 ]*$/.test(gameName)) {
        return res.status(400).json({ error: 'Invalid gameName value' });
    }

    const startDateTime = new Date(gameStartDateTime);
    const endDateTime = new Date(gameEndDateTime);

    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
        return res.status(400).json({ error: 'Invalid date format' });
    }

    if (startDateTime >= endDateTime) {
        return res.status(400).json({ error: 'gameStartDateTime must be before gameEndDateTime' });
    }

    const timestamp = new Date();

    try {
        const newGame = { gameName, gameStartDateTime: startDateTime, gameEndDateTime: endDateTime, createdAt: timestamp, joinedTeamsIds: [] };
        const gameRef = await firestore.collection('games');
        const snapshot = await gameRef.where('gameName', '==', gameName).get();
        if (!snapshot.empty) {
            return res.status(400).json({ error: 'Game already exists. GameName should be unique' });
        }
        const newGameDoc = await gameRef.doc(gameDocName).set(newGame);
        res.status(201).json( newGame );
    } catch (error) {
        console.error('Error adding game:', error);
        res.status(500).json({ error: 'Failed to add game' });
    }
};

export const joinGame = async (req: Request, res: Response): Promise<any> => {
    const { gameId, teamId , userId } = req.body;

    if (!gameId || !teamId || !userId) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const userRef = firestore.collection('users').doc(userId);
        const userDoc = await userRef.get();

        if(!userDoc.exists){
            return res.status(404).json({ error: 'User not found' });
        }

        const joinedGameIds = userDoc.data()?.joinedGameIds as string[] || [];

        if (joinedGameIds.length > 0) {
            return res.status(403).json({ error: 'User can join only onegame at a time' });
        }

        const teamRef = firestore.collection('userTeams').doc(teamId as string);
        const teamDoc = await teamRef.get();
        const teamName = teamDoc.data()?.teamName as string;
        
        if(!teamDoc.exists){
            return res.status(404).json({ error: 'Team not found' });
        }
        console.log(`teamId: ${teamId} is tring to join game ${gameId}`);


        if (!userDoc.data()?.teams.includes(teamId)) {
            return res.status(403).json({ error: 'User does not own the team' });
        }

        const gameRef = firestore.collection('games').doc(gameId);
        const gameDoc = await gameRef.get();

        if (!gameDoc.exists) {
            return res.status(404).json({ error: 'Game not found' });
        }

        const joinedTeamIds = gameDoc.data()?.joinedTeamIds || [];
        if (joinedTeamIds.includes(teamName)) {
            return res.status(400).json({ error: 'Team already joined the game' });
        }

        joinedTeamIds.push(teamName);
        await gameRef.update({ joinedTeamIds });
        await userRef.update({ joinedGameIds:[...joinedGameIds, gameId] });

        res.status(200).json({ message: 'Team joined the game successfully' });
    } catch (error) {
        console.error('Error joining game:', error);
        res.status(500).json({ error: 'Failed to join game' });
    }
};

export const getJoinedGames = async (req: Request, res: Response): Promise<any> => {
    const userId  = req.params.userId;
    console.log(`userId: ${userId} is tring to get joined games`);
    console.log(req);

    if (!userId) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const userRef = firestore.collection('users').doc(userId);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found' });
        }

        const joinedGameIds = userDoc.data()?.joinedGameIds as string[] || [];

        if (joinedGameIds.length === 0) {
            return res.status(200).json({ games: [] });
        }

        const gamesPromises = joinedGameIds.map(gameId => firestore.collection('games').doc(gameId).get());
        const gamesSnapshots = await Promise.all(gamesPromises);
        const games = gamesSnapshots.map(gameDoc => gameDoc.data());

        res.status(200).json({ games });
    } catch (error) {
        console.error('Error getting joined games:', error);
        res.status(500).json({ error: 'Failed to get joined games' });
    }
};