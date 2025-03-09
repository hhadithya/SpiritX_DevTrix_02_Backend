import { Request, Response } from 'express';
import { firestore } from '../firebase/firebase';
import { generateNextId } from '../utils/idGenerator';
import { 
  createPlayerStatsFromTournamentData, 
  getCompletePlayerStats, 
  calculateBasePrice 
} from '../services/pointCalculatorService';
import axios from 'axios';

// Configure your Flask backend URL
const FLASK_API_URL = process.env.FLASK_API_URL || 'http://localhost:5000/chatbot/api/update-player-data';

/**
 * Sends all players data to the Flask backend to update the RAG database
 */
const updateRagDatabase = async (playerData: any): Promise<any> => {
  try {
    const response = await axios.post(FLASK_API_URL, playerData);
    console.log('RAG database update response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error updating RAG database:', error);
    throw error;
  }
};

/**
 * Get all player data from Firestore to update RAG
 */
const getAllPlayersForRag = async (): Promise<any[]> => {
  try {
    const playersSnapshot = await firestore.collection('players').get();
    
    const playerPromises = playersSnapshot.docs.map(async (doc) => {
      const playerData = doc.data();
      const playerId = doc.id;
      
      // Get tournament data for this player
      const tournamentsSnapshot = await doc.ref.collection('tournaments').get();
      let tournamentData = {};
      
      if (!tournamentsSnapshot.empty) {
        // Use the first tournament document
        tournamentData = tournamentsSnapshot.docs[0].data();
      }
      
      return {
        playerId,
        name: playerData.name,
        basePrice: playerData.basePrice,
        playerPoints: playerData.stats?.playerPoints.toFixed(2),
        category: playerData.category,
        tournamentData
      };
    });
    
    return Promise.all(playerPromises);
  } catch (error) {
    console.error('Error getting all players for RAG:', error);
    return [];
  }
};

/**
 * Get all players with pagination
 */
export const getPlayers = async (req: Request, res: Response): Promise<any> => {
  try {
    const { limit = 20, offset = 0, category, sortBy = 'name', sortOrder = 'asc' } = req.query;
    
    let query: any = firestore.collection('players');
    
    // Apply category filter if specified
    if (category) {
      query = query.where('category', '==', category);
    }
    
    // Apply sorting
    query = query.orderBy(sortBy as string, sortOrder as 'asc' | 'desc');
    
    // Apply pagination
    const limitNum = parseInt(limit as string);
    const offsetNum = parseInt(offset as string);
    
    // Get total count first (without pagination)
    const totalCountSnapshot = await query.count().get();
    const totalCount = totalCountSnapshot.data().count;
    
    // Apply pagination to query
    query = query.limit(limitNum).offset(offsetNum);
    
    // Execute query
    const snapshot = await query.get();
    
    const players = snapshot.docs.map((doc: { id: any; data: () => any; }) => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return res.status(200).json({
      success: true,
      totalCount,
      players,
      pagination: {
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + players.length < totalCount
      }
    });
    
  } catch (error) {
    console.error('Error fetching players:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return res.status(500).json({ 
      error: 'Failed to fetch players',
      details: errorMessage 
    });
  }
};

/**
 * Get a single player by ID
 */
export const getPlayerById = async (req: Request, res: Response): Promise<any> => {
  try {
    const { playerId } = req.params;
    
    if (!playerId) {
      return res.status(400).json({ error: 'Player ID is required' });
    }
    
    const playerDoc = await firestore.collection('players').doc(playerId).get();
    
    if (!playerDoc.exists) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    // Get player tournaments
    const tournamentsSnapshot = await playerDoc.ref.collection('tournaments').get();
    const tournaments = tournamentsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return res.status(200).json({
      success: true,
      player: {
        id: playerDoc.id,
        ...playerDoc.data(),
        tournaments
      }
    });
    
  } catch (error) {
    console.error('Error fetching player:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return res.status(500).json({ 
      error: 'Failed to fetch player',
      details: errorMessage 
    });
  }
};

/**
 * Create multiple players with calculated stats and tournament subcollections
 * Also updates the RAG system with ALL players
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
        category: playerData.category || "",
        playerPoints: completeStats.playerPoints.toFixed(2),
        calculatedValue: `₹${parseInt(basePrice).toLocaleString('en-IN')}`,
        tournamentData: tournamentData || {},
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
    
    // Get ALL players for RAG update
    const allPlayers = await getAllPlayersForRag();
    
    // Update RAG database with ALL players
    try {
      const ragUpdateData = {
        players: allPlayers
      };
      
      const ragResult = await updateRagDatabase(ragUpdateData);
      
      return res.status(201).json({ 
        success: true, 
        playersCreated: results.length,
        players: results,
        message: 'Players and tournament data added successfully',
        ragUpdate: {
          success: ragResult.success,
          message: ragResult.message,
          playersUpdated: allPlayers.length
        }
      });
    } catch (ragError) {
      // If RAG update fails, still return success for Firestore but include RAG error
      console.error('RAG update failed:', ragError);
      
      return res.status(201).json({ 
        success: true, 
        playersCreated: results.length,
        players: results,
        message: 'Players added to Firestore successfully but RAG database update failed',
        ragUpdate: {
          success: false,
          error: ragError instanceof Error ? ragError.message : 'Unknown error updating RAG database'
        }
      });
    }
    
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
 * Also updates the RAG system with ALL players
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
    
    // Get ALL players for RAG update
    const allPlayers = await getAllPlayersForRag();
    
    // Update RAG database with ALL players
    try {
      const ragUpdateData = {
        players: allPlayers
      };
      
      const ragResult = await updateRagDatabase(ragUpdateData);
      
      return res.status(201).json({ 
        success: true, 
        playerId: nextPlayerId,
        basePrice: basePrice,
        playerPoints: completeStats.playerPoints.toFixed(2),
        calculatedValue: `₹${parseInt(basePrice).toLocaleString('en-IN')}`,
        message: 'Player and tournament data added successfully',
        ragUpdate: {
          success: ragResult.success,
          message: ragResult.message,
          playersUpdated: allPlayers.length
        }
      });
    } catch (ragError) {
      // If RAG update fails, still return success for Firestore but include RAG error
      console.error('RAG update failed:', ragError);
      
      return res.status(201).json({ 
        success: true, 
        playerId: nextPlayerId,
        basePrice: basePrice,
        playerPoints: completeStats.playerPoints.toFixed(2),
        calculatedValue: `₹${parseInt(basePrice).toLocaleString('en-IN')}`,
        message: 'Player added to Firestore successfully but RAG database update failed',
        ragUpdate: {
          success: false,
          error: ragError instanceof Error ? ragError.message : 'Unknown error updating RAG database'
        }
      });
    }
    
  } catch (error) {
    console.error('Error creating player:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return res.status(500).json({ 
      error: 'Failed to create player',
      details: errorMessage 
    });
  }
};

/**
 * Update an existing player
 * Also updates the RAG system with ALL players
 */
export const updatePlayer = async (req: Request, res: Response): Promise<any> => {
  try {
    const { playerId } = req.params;
    const { playerData, tournamentData } = req.body;
    
    if (!playerId) {
      return res.status(400).json({ error: 'Player ID is required' });
    }
    
    if (!playerData) {
      return res.status(400).json({ error: 'Player data is required' });
    }
    
    const playerRef = firestore.collection('players').doc(playerId);
    const playerDoc = await playerRef.get();
    
    if (!playerDoc.exists) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    // Get existing player data
    const existingPlayer = playerDoc.data();
    
    // Prepare update data, preserving existing stats if not recalculating
    const updateData: any = {
      name: playerData.name || existingPlayer?.name,
      category: playerData.category !== undefined ? playerData.category : existingPlayer?.category,
      activeStatus: playerData.activeStatus !== undefined ? playerData.activeStatus : existingPlayer?.activeStatus
    };
    
    // Recalculate stats if tournament data provided
    if (tournamentData) {
      const playerStats = createPlayerStatsFromTournamentData(tournamentData);
      const completeStats = getCompletePlayerStats(playerStats);
      const basePrice = calculateBasePrice(completeStats.playerPoints);
      
      updateData.stats = completeStats;
      updateData.basePrice = basePrice;
      
      // Update or create tournament data
      const tournamentsRef = playerRef.collection('tournaments');
      const tournamentDocs = await tournamentsRef.get();
      
      if (tournamentDocs.empty) {
        // Create new tournament document if none exists
        const nextTournamentId = await generateNextId(`players/${playerId}/tournaments`);
        await tournamentsRef.doc(nextTournamentId).set({
          runs: tournamentData.runs || 0,
          wickets: tournamentData.wickets || 0,
          ballsFaced: tournamentData.ballsFaced || 0,
          inningsPlayed: tournamentData.inningsPlayed || 0,
          oversBowled: tournamentData.oversBowled || 0,
          runsConceded: tournamentData.runsConceded || 0
        });
      } else {
        // Update the first tournament document
        const firstTournamentDoc = tournamentDocs.docs[0];
        await firstTournamentDoc.ref.update({
          runs: tournamentData.runs !== undefined ? tournamentData.runs : firstTournamentDoc.data().runs,
          wickets: tournamentData.wickets !== undefined ? tournamentData.wickets : firstTournamentDoc.data().wickets,
          ballsFaced: tournamentData.ballsFaced !== undefined ? tournamentData.ballsFaced : firstTournamentDoc.data().ballsFaced,
          inningsPlayed: tournamentData.inningsPlayed !== undefined ? tournamentData.inningsPlayed : firstTournamentDoc.data().inningsPlayed,
          oversBowled: tournamentData.oversBowled !== undefined ? tournamentData.oversBowled : firstTournamentDoc.data().oversBowled,
          runsConceded: tournamentData.runsConceded !== undefined ? tournamentData.runsConceded : firstTournamentDoc.data().runsConceded
        });
      }
    }
    
    // Update the player document
    await playerRef.update(updateData);
    
    // Get updated player document
    const updatedPlayerDoc = await playerRef.get();
    const updatedPlayer = updatedPlayerDoc.data();
    
    // Get ALL players for RAG update
    const allPlayers = await getAllPlayersForRag();
    
    // Update RAG database with ALL players
    try {
      const ragUpdateData = {
        players: allPlayers
      };
      
      const ragResult = await updateRagDatabase(ragUpdateData);
      
      return res.status(200).json({
        success: true,
        playerId: playerId,
        player: {
          id: playerId,
          ...updatedPlayer
        },
        message: 'Player updated successfully',
        ragUpdate: {
          success: ragResult.success,
          message: ragResult.message,
          playersUpdated: allPlayers.length
        }
      });
    } catch (ragError) {
      // If RAG update fails, still return success for Firestore but include RAG error
      console.error('RAG update failed:', ragError);
      
      return res.status(200).json({
        success: true,
        playerId: playerId,
        player: {
          id: playerId,
          ...updatedPlayer
        },
        message: 'Player updated in Firestore successfully but RAG database update failed',
        ragUpdate: {
          success: false,
          error: ragError instanceof Error ? ragError.message : 'Unknown error updating RAG database'
        }
      });
    }
    
  } catch (error) {
    console.error('Error updating player:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return res.status(500).json({ 
      error: 'Failed to update player',
      details: errorMessage 
    });
  }
};

/**
 * Delete a player
 * Also updates the RAG system with ALL players
 */
export const deletePlayer = async (req: Request, res: Response): Promise<any> => {
  try {
    const { playerId } = req.params;
    
    if (!playerId) {
      return res.status(400).json({ error: 'Player ID is required' });
    }
    
    const playerRef = firestore.collection('players').doc(playerId);
    const playerDoc = await playerRef.get();
    
    if (!playerDoc.exists) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    // Get player data before deletion for logging
    const playerData = playerDoc.data();
    
    // Delete tournament subcollection
    const tournamentsRef = playerRef.collection('tournaments');
    const tournamentDocs = await tournamentsRef.get();
    
    // Delete tournament documents in a batch
    if (!tournamentDocs.empty) {
      const batch = firestore.batch();
      tournamentDocs.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    }
    
    // Delete the player document
    await playerRef.delete();
    
    // Get ALL remaining players for RAG update
    const allPlayers = await getAllPlayersForRag();
    
    // Update RAG database with ALL players + deletion info
    try {
      const ragUpdateData = {
        players: allPlayers,
        deletedPlayer: {
          playerId: playerId,
          name: playerData?.name
        }
      };
      
      const ragResult = await updateRagDatabase(ragUpdateData);
      
      return res.status(200).json({
        success: true,
        message: 'Player deleted successfully',
        ragUpdate: {
          success: ragResult.success,
          message: ragResult.message,
          playersUpdated: allPlayers.length
        }
      });
    } catch (ragError) {
      // If RAG update fails, still return success for Firestore but include RAG error
      console.error('RAG update failed:', ragError);
      
      return res.status(200).json({
        success: true,
        message: 'Player deleted from Firestore successfully but RAG database update failed',
        ragUpdate: {
          success: false,
          error: ragError instanceof Error ? ragError.message : 'Unknown error updating RAG database'
        }
      });
    }
    
  } catch (error) {
    console.error('Error deleting player:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return res.status(500).json({ 
      error: 'Failed to delete player',
      details: errorMessage 
    });
  }
};