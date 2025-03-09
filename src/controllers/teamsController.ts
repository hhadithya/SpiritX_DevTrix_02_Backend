import { Request, Response } from 'express';
import { firestore } from '../firebase/firebase';

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

export const getPlayerById = async (req: Request, res: Response): Promise<any> => {
    try {
        const playerRef = firestore.collection('players').doc(req.params.id);
        const playerDoc = await playerRef.get();

        if (!playerDoc.exists || !playerDoc.data()?.activeStatus) {
            return res.status(404).json({ error: 'Player not found' });
        }

        res.json({ id: playerDoc.id, ...playerDoc.data() });
    } catch (error) {
        console.error('Error fetching player details:', error);
        res.status(500).json({ error: 'Failed to fetch player details' });
    }
};

export const createTeam = async (req: Request, res: Response): Promise<any> => {
    const { tournamentId, teamName, players, budgetRemaining } = req.body;

    if (!tournamentId || !teamName || !players) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    if (typeof tournamentId !== 'string' || tournamentId.length < 1 || tournamentId.length > 50) {
        return res.status(400).json({ error: 'Invalid tournamentId value' });
    }

    if (typeof teamName !== 'string' || teamName.length < 1 || teamName.length > 30) {
        return res.status(400).json({ error: 'Invalid teamName value' });
    }

    if (!Array.isArray(players) || players.length < 10 || players.length > 11 || !players.every(player => typeof player === 'string')) {
        return res.status(400).json({ error: 'Invalid players value' });
    }

    const tournamentRef = firestore.collection('tournaments').where("tournamentId","==",tournamentId);
    const tournamentDoc = await tournamentRef.get();

    if (tournamentDoc.empty) {
        return res.status(404).json({ error: 'Tournament not found' });
    }

    try {
        const newTeam = { tournamentId, teamName, players, budgetRemaining, };
        const teamRef = await firestore.collection('userTeams').add(newTeam);

        res.status(201).json({ id: teamRef.id, ...newTeam });
    } catch (error) {
        console.error('Error adding team:', error);
        res.status(500).json({ error: 'Failed to add Team' });
    }
};

export const updatePlayer = async (req: Request, res: Response): Promise<any> => {
    try {
        const { name, category, basePrice, activeStatus } = req.body;
        const playerRef = firestore.collection('players').doc(req.params.id);

        const playerDoc = await playerRef.get();
        if (!playerDoc.exists || !playerDoc.data()?.activeStatus) {
            return res.status(404).json({ error: 'Player not found' });
        }

        const updates: any = {};
        if (name && typeof name === 'string' && name.length >= 1 && name.length <= 50) updates.name = name;
        if (category && typeof category === 'string' && category.length >= 1 && category.length <= 30) updates.category = category;


        if (basePrice && typeof basePrice === 'number' && basePrice > 0) updates.basePrice = basePrice;
        if (basePrice) {
            const parsedBasePrice = parseFloat(basePrice);
            if (!isNaN(parsedBasePrice) && parsedBasePrice > 0) {
            updates.basePrice = parsedBasePrice;
            }
        }   
        
        if (typeof activeStatus === 'boolean') updates.activeStatus = activeStatus;

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No valid fields provided for update' });
        }

        await playerRef.update(updates);
        res.json({ id: req.params.id, ...updates });  // returns the fields that were updated
    } catch (error) {
        console.error('Error updating player:', error);
        res.status(500).json({ error: 'Failed to update player' });
    }
};


export const deletePlayer = async (req: Request, res: Response): Promise<any> => {
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