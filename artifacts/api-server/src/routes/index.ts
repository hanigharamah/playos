import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import hostsRouter from "./hosts";
import gamesRouter from "./games";
import dashboardRouter from "./dashboard";
import paymentRouter from "./payment";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(hostsRouter);
router.use(gamesRouter);
router.use(dashboardRouter);
router.use(paymentRouter);

export default router;
