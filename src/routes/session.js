import { Router } from 'express';

export default function sessionRouter(sessionManager) {
  const router = Router();

  // Health check - mostrar todas las sesiones
  router.get('/health', async (_req, res) => {
    try {
      const sessions = await sessionManager.listSessions();
      const summary = {
        status: 'ok',
        totalSessions: sessions.length,
        activeSessions: sessions.filter(s => s.status?.ready).length,
        sessions: sessions.map(s => ({
          sessionId: s.session_id,
          name: s.name,
          phoneNumber: s.phone_number,
          status: s.status
        }))
      };
      res.json(summary);
    } catch (err) {
      res.status(500).json({ status: 'error', error: err.message });
    }
  });

  return router;
}
