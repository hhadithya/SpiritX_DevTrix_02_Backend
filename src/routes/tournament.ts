import express, { Request, Response } from "express";
import { analyzeTournamentStats } from "../services/tournamentStats";

const router = express.Router();

router.get("/:tournamentId", async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;
    const stats = await analyzeTournamentStats(tournamentId);
    res.status(200).json(stats);
  } catch (error) {
    res.status(500).json({ message: "Error fetching tournament stats", error });
  }
});

export default router;
