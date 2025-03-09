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
    const { teamName, players , userId } = req.body;

    console.log(`tring to create team ${teamName} for user ${userId}`);

    if (!teamName || !userId) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    if (typeof teamName !== 'string' || teamName.length < 1 || teamName.length > 30) {
        return res.status(400).json({ error: 'Invalid teamName value' });
    }

    if (!Array.isArray(players) || players.length < 10 || players.length > 11 || !players.every(player => typeof player === 'string')) {
        return res.status(400).json({ error: 'Invalid players value' });
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

    console.log(`user teams ${userTeams} before adding new team`);
    if(userTeams.find((team: string) => team === teamName)){
        return res.status(400).json({ error: 'Team already created' });
    }

    const timestamp = new Date();

    try {
        const newTeam = { teamName, players, createdAt: timestamp};
        const teamRef = await firestore.collection('userTeams');
        const snapshot = await teamRef.where('teamName', '==', teamName).get();
        if (!snapshot.empty) {
            return res.status(400).json({ error: 'Team already exists' });
        }
        const newTeamDocName = userId +"-"+ userTeamsCreated.toString();
        await teamRef.doc(newTeamDocName).set(newTeam);
        await userRef.update({ teams: [...userTeams, newTeamDocName], teamsCreated: FieldValue.increment(1) });
        res.status(201).json({ id: teamRef.id, ...newTeam });
    } catch (error) {
        console.error('Error adding team:', error);
        res.status(500).json({ error: 'Failed to add Team' });
    }
};

