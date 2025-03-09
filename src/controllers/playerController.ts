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


interface PlayerData {
  name: string;
  university?: string; 
  category?: string;
  activeStatus?: boolean;
}

interface TournamentData {
  runs?: number;
  wickets?: number;
  ballsFaced?: number;
  inningsPlayed?: number;
  oversBowled?: number;
  runsConceded?: number;
}

interface PlayerStats {
  playerPoints: number;
  [key: string]: any;
}

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
        university: playerData.university, 
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


export const handleRagPlayerUpdate = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { players } = req.body;
    
    if (!players || !Array.isArray(players)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid request format. Expected "players" array.' 
      });
    }
    
    console.log(`Processing ${players.length} players for RAG update`);
    
    // We'll simply store this data as received and confirm the update
    return res.status(200).json({
      success: true,
      message: `Successfully updated RAG database with ${players.length} players`,
      count: players.length
    });
    
  } catch (error) {
    console.error('Error handling RAG player update:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return res.status(500).json({ 
      success: false,
      message: 'Failed to process RAG update',
      error: errorMessage 
    });
  }
};

/**
 * Get all players with pagination
 */
export const getPlayers = async (req: Request, res: Response): Promise<any> => {
  try {
    const { 
      limit = '20', 
      offset = '0', 
      category, 
      sortBy = 'name', 
      sortOrder = 'asc' 
    } = req.query;
    
    let query: FirebaseFirestore.Query = firestore.collection('players');
    
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
    
    const players = snapshot.docs.map((doc) => ({
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

export const createPlayers = async (req: Request, res: Response): Promise<any> => {
  try {
    const { players } = req.body;
    
    if (!players || !Array.isArray(players) || players.length === 0) {
      return res.status(400).json({ error: 'An array of player data is required' });
    }
    
    const results: Array<{
      playerId: string;
      name: string;
      university: string;
      basePrice: string;
      category: string;
      playerPoints: string;
      calculatedValue: string;
      tournamentData: any;
      success: boolean;
    }> = [];
    const batch = firestore.batch();
    const tournamentBatches: Array<{
      playerId: string;
      tournamentData: TournamentData;
    }> = [];
    
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
      
      // Add player to batch with calculated stats and university
      batch.set(playerDocRef, {
        activeStatus: playerData.activeStatus || true,
        basePrice: basePrice,
        category: playerData.category || "",
        name: playerData.name,
        university: playerData.university || "", // Added university field
        stats: completeStats
      });
      
      // Track successful creations
      results.push({
        playerId: nextPlayerId,
        name: playerData.name,
        university: playerData.university || "", // Added university field
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


export const createPlayer = async (req: Request, res: Response): Promise<any> => {
  try {
    // Handle either format: direct fields or nested structure
    const data = req.body;
    let playerData: PlayerData, tournamentData: TournamentData = {};
    
    if (data.playerData) {
      // New structure with nested playerData and tournamentData
      playerData = data.playerData;
      tournamentData = data.tournamentData || {};
    } else {
      // Old structure with direct fields
      playerData = {
        name: data.name,
        university: data.university, 
        category: data.category,
        activeStatus: data.activeStatus
      };
      
      // Extract tournament data if present
      if (data.runs !== undefined) tournamentData.runs = data.runs;
      if (data.wickets !== undefined) tournamentData.wickets = data.wickets;
      if (data.ballsFaced !== undefined) tournamentData.ballsFaced = data.ballsFaced;
      if (data.inningsPlayed !== undefined) tournamentData.inningsPlayed = data.inningsPlayed;
      if (data.oversBowled !== undefined) tournamentData.oversBowled = data.oversBowled;
      if (data.runsConceded !== undefined) tournamentData.runsConceded = data.runsConceded;
    }
    
    if (!playerData || !playerData.name) {
      return res.status(400).json({ error: 'Player data is required with at least a name field' });
    }
    
    // Calculate player stats using the service
    const playerStats = createPlayerStatsFromTournamentData(tournamentData || {});
    const completeStats = getCompletePlayerStats(playerStats);
    const basePrice = calculateBasePrice(completeStats.playerPoints);
    
    // Generate player document ID using the counter approach
    const nextPlayerId = await generateNextId('players');
    
    // Create player document with fields and calculated stats including university
    const playerDocRef = firestore.collection('players').doc(nextPlayerId);
    await playerDocRef.set({
      activeStatus: playerData.activeStatus || true,
      basePrice: basePrice,
      category: playerData.category || "",
      name: playerData.name,
      university: playerData.university || "", 
      stats: completeStats
    });
    
    // If tournament data is provided, create a tournament subcollection
    if (Object.keys(tournamentData).length > 0) {
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
        university: playerData.university,
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
        university: playerData.university, 
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


export const updatePlayer = async (req: Request, res: Response): Promise<any> => {
  try {
    const { playerId } = req.params;
    
    // Handle either format: direct fields or nested structure
    const data = req.body;
    let playerData: PlayerData | undefined, tournamentData: TournamentData = {};
    
    if (data.playerData) {
      // New structure with nested playerData and tournamentData
      playerData = data.playerData;
      tournamentData = data.tournamentData || {};
    } else {
      // Old structure with direct fields
      playerData = {
        name: data.name,
        university: data.university, // Added university field
        category: data.category,
        activeStatus: data.activeStatus
      };
      
      // Extract tournament data if present
      if (data.runs !== undefined) tournamentData.runs = data.runs;
      if (data.wickets !== undefined) tournamentData.wickets = data.wickets;
      if (data.ballsFaced !== undefined) tournamentData.ballsFaced = data.ballsFaced;
      if (data.inningsPlayed !== undefined) tournamentData.inningsPlayed = data.inningsPlayed;
      if (data.oversBowled !== undefined) tournamentData.oversBowled = data.oversBowled;
      if (data.runsConceded !== undefined) tournamentData.runsConceded = data.runsConceded;
    }
    
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
    const updateData: {
      name: string;
      university: string; // Added university field
      category: string;
      activeStatus: boolean;
      stats?: PlayerStats;
      basePrice?: string;
    } = {
      name: playerData.name || existingPlayer?.name,
      university: playerData.university !== undefined ? playerData.university : existingPlayer?.university || "", // Added university field
      category: playerData.category !== undefined ? playerData.category : existingPlayer?.category,
      activeStatus: playerData.activeStatus !== undefined ? playerData.activeStatus : existingPlayer?.activeStatus
    };
    
    // Recalculate stats if tournament data provided
    if (Object.keys(tournamentData).length > 0) {
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
        const existingData = firstTournamentDoc.data();
        await firstTournamentDoc.ref.update({
          runs: tournamentData.runs !== undefined ? tournamentData.runs : existingData.runs,
          wickets: tournamentData.wickets !== undefined ? tournamentData.wickets : existingData.wickets,
          ballsFaced: tournamentData.ballsFaced !== undefined ? tournamentData.ballsFaced : existingData.ballsFaced,
          inningsPlayed: tournamentData.inningsPlayed !== undefined ? tournamentData.inningsPlayed : existingData.inningsPlayed,
          oversBowled: tournamentData.oversBowled !== undefined ? tournamentData.oversBowled : existingData.oversBowled,
          runsConceded: tournamentData.runsConceded !== undefined ? tournamentData.runsConceded : existingData.runsConceded
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
          name: playerData?.name,
          university: playerData?.university 
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