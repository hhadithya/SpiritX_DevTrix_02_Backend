import { firestore } from '../firebase/firebase';

const db = firestore;

interface PlayerStats {
  overallRuns: number;
  overallWickets: number;
  highestRunScorer: { player: string; runs: number };
  highestWicketTaker: { player: string; wickets: number };
}

export async function analyzeTournamentStats(tournamentId: string): Promise<PlayerStats> {
  let totalRuns = 0;
  let totalWickets = 0;
  let highestRunScorer = { player: '', runs: 0 };
  let highestWicketTaker = { player: '', wickets: 0 };

  try {
    const playersSnapshot = await db.collection("players").get();

    for (const playerDoc of playersSnapshot.docs) {
      const tournamentRef = playerDoc.ref.collection("tournaments").doc(tournamentId);
      const tournamentSnapshot = await tournamentRef.get();

      if (!tournamentSnapshot.exists) continue;

      const playerStats = tournamentSnapshot.data();
      const playerName = playerDoc.data().name as string; // Ensure 'name' exists in playerDoc

      totalRuns += playerStats?.runs || 0;
      totalWickets += playerStats?.wickets || 0;

      if (playerStats && (playerStats.runs || 0) > highestRunScorer.runs) {
        highestRunScorer = { player: playerName, runs: playerStats.runs };
      }

      if ((playerStats?.wickets || 0) > highestWicketTaker.wickets) {
        highestWicketTaker = { player: playerName, wickets: playerStats?.wickets || 0 };
      }
    }

    return {
      overallRuns: totalRuns,
      overallWickets: totalWickets,
      highestRunScorer,
      highestWicketTaker,
    };
  } catch (error) {
    console.error("Error analyzing tournament stats:", error);
    throw new Error("Failed to analyze tournament statistics");
  }
}
