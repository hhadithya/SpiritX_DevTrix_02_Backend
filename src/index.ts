import express, { Request, Response } from 'express';
import { firestore } from './firebase/firebase';
import { DocumentSnapshot } from 'firebase-admin/firestore';

const app = express();
const port = process.env.PORT || 3001;
const db = firestore;

app.get('/', (req: Request, res: Response) => {
  res.send('Hello, from Express!');
});

app.get('/add_players', async (req: Request, res: Response) => {
    // const { name, age, country, points } = req.body;

    const name = 'John Doe';
    const age = 25;
    const country = 'USA';
    const points = 100;

    const player = {
      name,
      age,
      country,
    };

    try {
        const playerRef = await db.collection('players').add(player);
        const privateRef = playerRef.collection('private').doc('points');
        await privateRef.set({ points });

        const playerDoc = await playerRef.get();
        const playerData = playerDoc.data();

        res.json({
            ...playerData,
            id: playerDoc.id,
        });
    } catch (error) {
        console.error('Error adding player:', error);
        res.status(500).json({ error: 'Failed to add player' });
    }
});

// Will return all player data, including private data in the /private subcollection
app.get('/players-private', async (req: Request, res: Response) => {
    
    try {
        const players = await db.collection('players').get();
        const playerData = players.docs.map(async (player: DocumentSnapshot) => {
            const privateData = await player.ref.collection('private').doc('points').get();
            return {
                id: player.id,
                ...player.data(),
                private : privateData.data(),
            };
        });

        res.json(await Promise.all(playerData));
    } catch (error) {
        console.error('Error getting players:', error);
        res.status(500).json({ error: 'Failed to get players' });
    }
    
});


// only public player data
app.get('/players', async (req: Request, res: Response) => {
   
    try {
        const players = await db.collection('players').get();
        const playerData = players.docs.map((player: DocumentSnapshot) => {
            return {
                id: player.id,
                ...player.data(),
            };
        });

        res.json(playerData);
    }
    catch (error) {
        console.error('Error getting players:', error);
        res.status(500).json({ error: 'Failed to get players' });
    }
     
 });



app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
