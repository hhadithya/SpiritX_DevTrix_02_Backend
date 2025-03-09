import { Request, Response } from 'express';
import { firestore } from '../firebase/firebase';
import { generateNextId } from '../utils/idGenerator';

/**
 * Create multiple players with tournament subcollections
 */
export const createPlayers = async (req: Request, res: Response): Promise<any> => {
  try {
    const { players } = req.body;
    
    if (!players || !Array.isArray(players) || players.length === 0) {
      return res.status(400).json({ error: 'An array of player data is required' });
    }
    
    const results = [];
    const batch = firestore.batch();
    const tournamentBatches = [];
    
    // Process each player in the array
    for (const player of players) {
      const { playerData, tournamentData } = player;
      
      if (!playerData || !playerData.name) {
        continue; 
      }
      
      // Generate player document ID
      const nextPlayerId = await generateNextId('players');
      
      // Create player document ref
      const playerDocRef = firestore.collection('players').doc(nextPlayerId);
      
      // Add player to batch
      batch.set(playerDocRef, {
        activeStatus: playerData.activeStatus || true,
        basePrice: playerData.basePrice || "0",
        category: playerData.category || "",
        name: playerData.name
      });
      
      // Track successful creations
      results.push({
        playerId: nextPlayerId,
        name: playerData.name,
        success: true
      });
      
      // If tournament data is provided, prepare tournament subcollection
      if (tournamentData) {
        tournamentBatches.push({
          playerId: nextPlayerId,
          tournamentData
        });
      }
    }
    
    // Commit the batch for player documents
    await batch.commit();
    
    // Create tournament subcollections
    for (const item of tournamentBatches) {
      const { playerId, tournamentData } = item;
      const tournamentsRef = firestore.collection('players').doc(playerId).collection('tournaments');
      const nextTournamentId = await generateNextId(`players/${playerId}/tournaments`);
      
      // Create tournament document with provided data
      await tournamentsRef.doc(nextTournamentId).set({
        runs: tournamentData.runs || 0,
        wickets: tournamentData.wickets || 0,
        ballsFaced: tournamentData.ballsFaced || 0,
        inningsPlayed: tournamentData.inningsPlayed || 0,
        oversBowled: tournamentData.oversBowled || 0,
        runsConceded: tournamentData.runsConceded || 0
      });
    }
    
    return res.status(201).json({ 
      success: true, 
      playersCreated: results.length,
      players: results,
      message: 'Players and tournament data added successfully' 
    });
    
  } catch (error) {
    console.error('Error creating players:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return res.status(500).json({ 
      error: 'Failed to create players',
      details: errorMessage 
    });
  }
};

/**
 *  single player creation function
 */
export const createPlayer = async (req: Request, res: Response): Promise<any> => {
  try {
    const { playerData, tournamentData } = req.body;
    
    if (!playerData || !playerData.name) {
      return res.status(400).json({ error: 'Player data is required with at least a name field' });
    }
    
    // Generate player document ID using the counter approach
    const nextPlayerId = await generateNextId('players');
    
    // Create player document with fields
    const playerDocRef = firestore.collection('players').doc(nextPlayerId);
    await playerDocRef.set({
      activeStatus: playerData.activeStatus || true,
      basePrice: playerData.basePrice || "0",
      category: playerData.category || "",
      name: playerData.name
    });
    
    // If tournament data is provided, create a tournament subcollection
    if (tournamentData) {
      const tournamentsRef = playerDocRef.collection('tournaments');
      const nextTournamentId = await generateNextId(`players/${nextPlayerId}/tournaments`);
      
      // Create tournament document with provided data
      await tournamentsRef.doc(nextTournamentId).set({
        runs: tournamentData.runs || 0,
        wickets: tournamentData.wickets || 0,
        ballsFaced: tournamentData.ballsFaced || 0,
        inningsPlayed: tournamentData.inningsPlayed || 0,
        oversBowled: tournamentData.oversBowled || 0,
        runsConceded: tournamentData.runsConceded || 0
      });
    }
    
    return res.status(201).json({ 
      success: true, 
      playerId: nextPlayerId,
      message: 'Player and tournament data added successfully' 
    });
    
  } catch (error) {
    console.error('Error creating player:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return res.status(500).json({ 
      error: 'Failed to create player',
      details: errorMessage 
    });
  }
};