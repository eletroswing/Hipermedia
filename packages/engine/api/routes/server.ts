import { getServerInfo } from "@api/controllers/server";
import express from "express";

const router = express.Router();

router.get("/", async (_req: express.Request, res: express.Response) => {
	const info = await getServerInfo();
	return res.json(info);
});

export default router;
