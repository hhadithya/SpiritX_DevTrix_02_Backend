import { Request, Response } from 'express';
import { firestore } from '../firebase/firebase';

export const getPlayers = async (req: Request, res: Response): Promise<any> => {
    try {
        const { category } = req.query;
        let query: FirebaseFirestore.Query = firestore.collection('players');
        query = query.where('activeStatus', '==', true);
        if (category) {
            query = query.where('category', '==', category);
        }

        const snapshot = await query.get();
        if (snapshot.empty) {
            return res.status(404).json({ message: 'No players found' });
        }

        const players = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(players);
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

export const addPlayer = async (req: Request, res: Response): Promise<any> => {
    const { name, category, basePrice } = req.body;

    if (!name || !category || !basePrice) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    if (typeof name !== 'string' || name.length < 1 || name.length > 50) {
        return res.status(400).json({ error: 'Invalid name value' });
    }

    if (typeof category !== 'string' || category.length < 1 || category.length > 30) {
        return res.status(400).json({ error: 'Invalid category value' });
    }

    const parsedBasePrice = parseFloat(basePrice);
    if (isNaN(parsedBasePrice) || parsedBasePrice <= 0) {
        return res.status(400).json({ error: 'Invalid basePrice value' });
    }
        
    req.body.basePrice = parsedBasePrice;

    try {
        const newPlayer = { name, category, basePrice, activeStatus: true };
        const playerRef = await firestore.collection('players').add(newPlayer);

        res.status(201).json({ id: playerRef.id, ...newPlayer });
    } catch (error) {
        console.error('Error adding player:', error);
        res.status(500).json({ error: 'Failed to add player' });
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