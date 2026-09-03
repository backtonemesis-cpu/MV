import { Request, Response } from 'express';

interface ClientConnection {
  id: string;
  userEmail: string;
  res: Response;
}

const clients: ClientConnection[] = [];

export function handleEventStream(req: Request, res: Response): void {
  if (!req.user || req.user.role === 'pending' || req.user.role === 'removed') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const clientId = Date.now() + '-' + Math.random().toString(36).substring(2, 7);
  const client: ClientConnection = {
    id: clientId,
    userEmail: req.user.email,
    res,
  };

  clients.push(client);

  // Send initial connected event
  res.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`);

  // Keep-alive heartbeat every 20 seconds
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch (e) {
      clearInterval(heartbeat);
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    const index = clients.findIndex((c) => c.id === clientId);
    if (index !== -1) {
      clients.splice(index, 1);
    }
  });
}

export function broadcastHouseholdUpdate(version: number, actorEmail: string): void {
  const payload = JSON.stringify({
    type: 'household_updated',
    version,
    actorEmail,
    timestamp: new Date().toISOString(),
  });

  for (const client of clients) {
    try {
      client.res.write(`data: ${payload}\n\n`);
    } catch (err) {
      // client disconnected
    }
  }
}
