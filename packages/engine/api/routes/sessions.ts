import { getSessionInfo } from "@api/controllers/sessions";
import express from "express";

const router = express.Router();

router.get("/", (_req: express.Request, res: express.Response) => {
	const info = getSessionInfo();
	return res.json(info);
});

export default router;
