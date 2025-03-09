import express, { Request, Response } from 'express';
import { calculatePlayerPoints, PlayerStats } from '../services/pointCalculatorService';

const router = express.Router();

// Endpoint to calculate player points
router.post('/calculate-points', (req: Request, res: Response): any => {
    // totalRuns: number;
    // totalBallsFaced: number;
    // inningsPlayed: number;
    // totalBallsBowled: number;
    // totalWicketsTaken: number;
    // totalRunsConceded: number;

  const {
    totalRuns,
    totalBallsFaced,
    inningsPlayed,
    totalBallsBowled,
    totalWicketsTaken,
    totalRunsConceded,
  } = req.body;

    const stats: PlayerStats = {
        totalRuns,
        totalBallsFaced,
        inningsPlayed,
        totalBallsBowled,
        totalWicketsTaken,
        totalRunsConceded,
    };

  if (!stats || !stats.totalRuns || !stats.totalBallsFaced) {
    return res.status(400).json({ error: 'Invalid player stats data' });
  }

  const points = calculatePlayerPoints(stats);
  res.json({ playerPoints: points });
});

export default router;
