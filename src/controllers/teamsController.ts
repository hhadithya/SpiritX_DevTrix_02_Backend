import { Request, Response } from 'express';
import { firestore } from '../firebase/firebase';
import {  FieldValue } from 'firebase-admin/firestore';


export const getTeam = async (req: Request, res: Response): Promise<any> => {
    try {
        const { teamName,teamId } = req.query;
        if (teamId) {
            const docRef = firestore.collection('userTeams').doc(teamId as string);
            const doc = await docRef.get();
            if (!doc.exists) {
                return res.status(404).json({ message: 'No Team found' });
            }
            const players = doc.data();
            return res.json(players);
        } else if (teamName) {
            const query = firestore.collection('userTeams').where('teamName', '==', teamName).limit(1);
            const snapshot = await query.get();
            if (snapshot.empty) {
                return res.status(404).json({ message: 'No Teams found' });
            }
            const players = snapshot.docs[0].data();
            return res.json(players);
        } else{
            return res.status(400).json({ message: 'teamName or teamId should be provided' });
        }
    } catch (error) {
        console.error('Error fetching players:', error);
        res.status(500).json({ error: 'Failed to fetch players' });
    }
};

export const createTeam = async (req: Request, res: Response): Promise<any> => {
    const { teamName, playerIds , userId } = req.body;

    console.log(`tring to create team ${teamName} for user ${userId}`);

    if (!teamName || !userId) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    if (typeof teamName !== 'string' || teamName.length < 1 || teamName.length > 30) {
        return res.status(400).json({ error: 'Invalid teamName value' });
    }

    if (!Array.isArray(playerIds)  || playerIds.length != 11 || !playerIds.every(player => typeof player === 'string')) {
        return res.status(400).json({ error: 'Invalid playerIds value' });
    }
    // Remove duplicates from playerIds
    const uniquePlayerIds = Array.from(new Set(playerIds));
    if (uniquePlayerIds.length !== 11) {
        return res.status(400).json({ error: 'playerIds must contain 11 unique players' });
    }

    console.log(`team ${teamName} creation basic validation completed`);

    const userRef = firestore.collection('users').doc(userId);
    const userDoc = await userRef.get();

    console.log(`userId ${userId} is exist: ${userDoc.exists} userdoc: ${userDoc.data()}`);
    if (!userDoc.exists) {
        return res.status(404).json({ error: 'user not found' });
    }
    
    const userTeams = userDoc.data()?.teams as string[] || [];
    const userTeamsCreated = userDoc.data()?.teamsCreated as number || 0;
    const userBudget = userDoc.data()?.budgetRemaining as number || 0;
    
    console.log(`user teams ${userTeams} before adding new team`);
    if(userTeams.find((team: string) => team === teamName)){
        return res.status(400).json({ error: 'Team already created' });
    }
    

    // calculate total cost of players
    const playerCosts:number[] = await Promise.all(
        uniquePlayerIds.map(async (player: string) => {
            const playerRef = firestore.collection('players').doc(player);
            const playerDoc = await playerRef.get();
    
            if (!playerDoc.exists || !playerDoc.data()?.activeStatus) {
                res.status(404).json({ error: `Player ${player} not found` });
                throw new Error(`Player for playerId ${player} not found`);
            }
    
            return playerDoc.data()?.basePrice as number || 0;
        })
    );
    const totalCost = playerCosts.reduce((acc, cost) => acc + Number(cost), 0);
    console.log(`total cost of players ${totalCost} user budget ${userBudget}`);
    if (totalCost > userBudget) {
        return res.status(400).json({ error: 'Insufficient budget' });
    }


    const timestamp = new Date();
    
    try {
        const newTeam = { teamName, players:uniquePlayerIds, createdAt: timestamp};
        const teamRef = await firestore.collection('userTeams');
        const snapshot = await teamRef.where('teamName', '==', teamName).get();
        if (!snapshot.empty) {
            return res.status(400).json({ error: 'Team already exists' });
        }
        const newTeamDocName = userId +"-"+ userTeamsCreated.toString();
        await teamRef.doc(newTeamDocName).set(newTeam);
        await userRef.update({ teams: [...userTeams, newTeamDocName], teamsCreated: FieldValue.increment(1) , budgetRemaining: FieldValue.increment(-totalCost)});
        res.status(201).json({ id: teamRef.id, ...newTeam });
    } catch (error) {
        console.error('Error adding team:', error);
        res.status(500).json({ error: 'Failed to add Team' });
    }
};



export const deleteGame = async (req: Request, res: Response): Promise<any> => {
    try {
        const playerRef = firestore.collection('players').doc(req.params.id);
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