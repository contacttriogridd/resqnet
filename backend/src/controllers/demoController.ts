import type { Request, Response } from 'express';
import * as demoService from '../services/demoService.js';

type DemoBody = { region: string; count: number };

const actor = (req: Request) => req.auth!.userId;

export async function floodAlert(req: Request, res: Response) {
  const { region } = req.validated.body as DemoBody;
  res.status(201).json({ alert: await demoService.simulateFloodAlert(region, actor(req), req.ip) });
}

export async function rescueRequests(req: Request, res: Response) {
  const { region, count } = req.validated.body as DemoBody;
  res.status(201).json(await demoService.simulateRescueRequests(region, count, actor(req), req.ip));
}

export async function shelterCapacity(req: Request, res: Response) {
  const { region } = req.validated.body as DemoBody;
  res.json(await demoService.simulateShelterCapacity(region, actor(req), req.ip));
}

export async function reset(req: Request, res: Response) {
  res.json(await demoService.resetDemoData(actor(req), req.ip));
}
