import { Request, Response } from 'express';
import { firestore } from '../firebase/firebase';
import { generateNextId } from '../utils/idGenerator';
import { 
  createPlayerStatsFromTournamentData, 
  getCompletePlayerStats, 
  calculateBasePrice 
} from '../services/pointCalculatorService';

/**
 * Create multiple players with calculated stats and tournament subcollections
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
      
      // Calculate player stats using the service
      const playerStats = createPlayerStatsFromTournamentData(tournamentData || {});
      const completeStats = getCompletePlayerStats(playerStats);
      const basePrice = calculateBasePrice(completeStats.playerPoints);
      
      // Generate player document ID
      const nextPlayerId = await generateNextId('players');
      
      // Create player document ref
      const playerDocRef = firestore.collection('players').doc(nextPlayerId);
      
      // Add player to batch with calculated stats
      batch.set(playerDocRef, {
        activeStatus: playerData.activeStatus || true,
        basePrice: basePrice,
        category: playerData.category || "",
        name: playerData.name,
        stats: completeStats
      });
      
      // Track successful creations
      results.push({
        playerId: nextPlayerId,
        name: playerData.name,
        basePrice: basePrice,
        playerPoints: completeStats.playerPoints.toFixed(2),
        calculatedValue: `₹${parseInt(basePrice).toLocaleString('en-IN')}`,
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
 * Create a single player with calculated stats and tournament subcollection
 */
export const createPlayer = async (req: Request, res: Response): Promise<any> => {
  try {
    const { playerData, tournamentData } = req.body;
    
    if (!playerData || !playerData.name) {
      return res.status(400).json({ error: 'Player data is required with at least a name field' });
    }
    
    // Calculate player stats using the service
    const playerStats = createPlayerStatsFromTournamentData(tournamentData || {});
    const completeStats = getCompletePlayerStats(playerStats);
    const basePrice = calculateBasePrice(completeStats.playerPoints);
    
    // Generate player document ID using the counter approach
    const nextPlayerId = await generateNextId('players');
    
    // Create player document with fields and calculated stats
    const playerDocRef = firestore.collection('players').doc(nextPlayerId);
    await playerDocRef.set({
      activeStatus: playerData.activeStatus || true,
      basePrice: basePrice,
      category: playerData.category || "",
      name: playerData.name,
      stats: completeStats
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
      basePrice: basePrice,
      playerPoints: completeStats.playerPoints.toFixed(2),
      calculatedValue: `₹${parseInt(basePrice).toLocaleString('en-IN')}`,
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