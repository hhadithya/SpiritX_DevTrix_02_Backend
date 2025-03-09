import { PlayerStats, TournamentData } from '../types/player.types';

/**
 * Convert overs to balls
 * @param overs - Number of overs bowled
 * @returns Total number of balls
 */
export function oversToBalls(overs: number): number {
  const fullOvers = Math.floor(overs);
  const remainingBalls = (overs - fullOvers) * 10; // Convert decimal part to balls
  return fullOvers * 6 + remainingBalls;
}

/**
 * Create player stats from tournament data
 * @param tournamentData - Tournament performance data
 * @returns Complete player statistics object
 */
export function createPlayerStatsFromTournamentData(tournamentData: TournamentData): PlayerStats {
  // Convert oversBowled to totalBallsBowled
  const totalBallsBowled = tournamentData.oversBowled
    ? oversToBalls(tournamentData.oversBowled)
    : 0;

  return {
    totalRuns: tournamentData.runs || 0,
    totalBallsFaced: tournamentData.ballsFaced || 0,
    inningsPlayed: tournamentData.inningsPlayed || 0,
    totalBallsBowled: totalBallsBowled,
    totalWicketsTaken: tournamentData.wickets || 0,
    totalRunsConceded: tournamentData.runsConceded || 0,
  };
}

/**
 * Calculate batting strike rate
 * @param stats - Player statistics
 * @returns Batting strike rate
 */
export function calculateBattingStrikeRate(stats: PlayerStats): number {
  if (stats.totalBallsFaced <= 0) return 0;
  return (stats.totalRuns / stats.totalBallsFaced) * 100;
}

/**
 * Calculate batting average
 * @param stats - Player statistics
 * @returns Batting average
 */
export function calculateBattingAverage(stats: PlayerStats): number {
  if (stats.inningsPlayed <= 0) return 0;
  return stats.totalRuns / stats.inningsPlayed;
}

/**
 * Calculate bowling strike rate
 * @param stats - Player statistics
 * @returns Bowling strike rate or undefined if no wickets taken
 */
export function calculateBowlingStrikeRate(stats: PlayerStats): number | undefined {
  if (stats.totalWicketsTaken <= 0) return undefined; // Bowling Strike Rate is undefined if no wickets taken
  return stats.totalBallsBowled / stats.totalWicketsTaken;
}

/**
 * Calculate economy rate
 * @param stats - Player statistics
 * @returns Economy rate
 */
export function calculateEconomyRate(stats: PlayerStats): number {
  if (stats.totalBallsBowled <= 0) return 0;
  return (stats.totalRunsConceded / stats.totalBallsBowled) * 6;
}

/**
 * Calculate player points based on performance metrics
 * @param stats - Player statistics
 * @returns Player points
 */
export function calculatePlayerPoints(stats: PlayerStats): number {
  const battingStrikeRate = calculateBattingStrikeRate(stats);
  const battingAverage = calculateBattingAverage(stats);
  const bowlingStrikeRate = calculateBowlingStrikeRate(stats);
  const economyRate = calculateEconomyRate(stats);

  // Treat undefined Bowling Strike Rate as 0 in the points calculation
  const playerPoints =
    battingStrikeRate / 5 +
    battingAverage * 0.8 +
    (bowlingStrikeRate !== undefined ? 500 / bowlingStrikeRate : 0) +
    (economyRate > 0 ? 140 / economyRate : 0);

  return playerPoints;
}

/**
 * Calculate base price based on player points
 * Value in Rupees = (9 × Points + 100) × 1000
 * Then round to the nearest multiple of 50,000
 * @param points - Player points
 * @returns Base price as string
 */
export function calculateBasePrice(points: number): string {
  // Calculate value using the formula
  const rawValue = (9 * points + 100) * 1000;
  
  // Round to the nearest multiple of 50,000
  const roundedValue = Math.round(rawValue / 50000) * 50000;
  
  // Return as string
  return roundedValue.toString();
}

/**
 * Get complete player statistics including derived metrics
 * @param stats - Raw player statistics
 * @returns Complete player statistics with derived metrics
 */
export function getCompletePlayerStats(stats: PlayerStats): PlayerStats & {
  battingStrikeRate: number;
  battingAverage: number;
  bowlingStrikeRate: number;
  economyRate: number;
  playerPoints: number;
} {
  const battingStrikeRate = calculateBattingStrikeRate(stats);
  const battingAverage = calculateBattingAverage(stats);
  const bowlingStrikeRate = calculateBowlingStrikeRate(stats);
  const economyRate = calculateEconomyRate(stats);
  const playerPoints = calculatePlayerPoints(stats);

  return {
    ...stats,
    battingStrikeRate,
    battingAverage,
    bowlingStrikeRate: bowlingStrikeRate || 0,
    economyRate,
    playerPoints
  };
}