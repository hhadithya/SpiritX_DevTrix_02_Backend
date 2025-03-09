export interface PlayerStats {
    totalRuns: number;
    totalBallsFaced: number;
    inningsPlayed: number;
    totalBallsBowled: number;
    totalWicketsTaken: number;
    totalRunsConceded: number;
  }
  
  function calculateBattingStrikeRate(stats: PlayerStats): number {
    if (stats.totalBallsFaced <= 0) return 0;
    return (stats.totalRuns / stats.totalBallsFaced) * 100;
  }
  
  function calculateBattingAverage(stats: PlayerStats): number {
    if (stats.inningsPlayed <= 0) return 0;
    return stats.totalRuns / stats.inningsPlayed;
  }
  
  function calculateBowlingStrikeRate(stats: PlayerStats): number | undefined {
    if (stats.totalWicketsTaken <= 0) return undefined;  // Bowling Strike Rate is undefined if no wickets taken
    return stats.totalBallsBowled / stats.totalWicketsTaken;
  }
  
  function calculateEconomyRate(stats: PlayerStats): number {
    if (stats.totalBallsBowled <= 0) return 0;
    return (stats.totalRunsConceded / stats.totalBallsBowled) * 6;
  }
  
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
  