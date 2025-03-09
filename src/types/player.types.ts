export interface PlayerStats {
    totalRuns: number;
    totalBallsFaced: number;
    inningsPlayed: number;
    totalBallsBowled: number;
    totalWicketsTaken: number;
    totalRunsConceded: number;
  }
  
  export interface PlayerData {
    name: string;
    activeStatus?: boolean;
    category?: string;
  }
  
  export interface TournamentData {
    runs?: number;
    wickets?: number;
    ballsFaced?: number;
    inningsPlayed?: number;
    oversBowled?: number;
    runsConceded?: number;
  }
  
  export interface PlayerWithStats extends PlayerData {
    basePrice: string;
    stats: PlayerStats & {
      battingStrikeRate: number;
      battingAverage: number;
      bowlingStrikeRate: number;
      economyRate: number;
      playerPoints: number;
    };
  }