import { Router } from 'express';

export default function sessionsRouter(sessionManager) {
  const router = Router();

  // Listar todas las sesiones
  router.get('/', async (_req, res) => {
    try {
      const sessions = await sessionManager.listSessions();
      res.json({ sessions });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Crear nueva sesión
  router.post('/', async (req, res) => {
    const { sessionId, name } = req.body || {};
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId es requerido' });
    }

    try {
      const wapp = await sessionManager.createSession(sessionId, name);
      const status = wapp.status();
      res.status(201).json({
        sessionId,
        name,
        status,
        message: 'Sesión creada. Escanea el QR para iniciar sesión.'
      });
    } catch (err) {
      const status = err.message.includes('ya existe') ? 409 : 500;
      res.status(status).json({ error: err.message });
    }
  });

  // Obtener información de una sesión específica
  router.get('/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    try {
      const sessionData = await sessionManager.listSessions();
      const session = sessionData.find(s => s.session_id === sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Sesión no encontrada' });
      }
      res.json(session);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Obtener QR de una sesión (HTML o JSON según Accept header o query param)
  router.get('/:sessionId/qr', async (req, res) => {
    const { sessionId } = req.params;
    const { format } = req.query;
    const acceptJson = format === 'json' || req.headers.accept?.includes('application/json');
    
    const qr = sessionManager.getSessionQR(sessionId);
    if (!qr) {
      const wapp = sessionManager.getSession(sessionId);
      if (!wapp) {
        if (acceptJson) {
          return res.status(404).json({ error: 'Sesión no encontrada' });
        }
        return res.status(404).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>QR Code - Sesión ${sessionId}</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
              .error { color: #d32f2f; }
            </style>
          </head>
          <body>
            <h1 class="error">Sesión no encontrada</h1>
            <p>La sesión "${sessionId}" no existe o no tiene un QR disponible.</p>
          </body>
          </html>
        `);
      }
      if (acceptJson) {
        return res.status(204).end();
      }
      return res.status(204).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>QR Code - Sesión ${sessionId}</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .info { color: #1976d2; }
          </style>
        </head>
        <body>
          <h1 class="info">Sesión lista</h1>
          <p>La sesión "${sessionId}" ya está autenticada y lista para usar.</p>
        </body>
        </html>
      `);
    }

    // Si se solicita JSON explícitamente
    if (acceptJson) {
      return res.json({ qr });
    }

    // Devolver HTML con el QR renderizado
    const sessionData = await sessionManager.listSessions();
    const session = sessionData.find(s => s.session_id === sessionId);
    const sessionName = session?.name || sessionId;

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR Code - ${sessionName}</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          .container {
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            padding: 40px;
            max-width: 500px;
            width: 100%;
            text-align: center;
          }
          h1 {
            color: #333;
            margin-bottom: 10px;
            font-size: 28px;
          }
          .session-info {
            color: #666;
            margin-bottom: 30px;
            font-size: 14px;
          }
          .qr-container {
            background: white;
            padding: 20px;
            border-radius: 15px;
            display: inline-block;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            margin: 20px 0;
          }
          .qr-container img {
            max-width: 100%;
            height: auto;
            display: block;
          }
          .instructions {
            color: #666;
            margin-top: 30px;
            line-height: 1.6;
            font-size: 16px;
          }
          .instructions strong {
            color: #333;
          }
          .auto-refresh {
            margin-top: 20px;
            color: #999;
            font-size: 12px;
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
          }
          .loading {
            animation: pulse 2s ease-in-out infinite;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Escanea el Código QR</h1>
          <div class="session-info">
            Sesión: <strong>${sessionName}</strong> (${sessionId})
          </div>
          <div class="qr-container">
            <img src="${qr}" alt="QR Code" id="qrImage">
          </div>
          <div class="instructions">
            <p><strong>Instrucciones:</strong></p>
            <p>1. Abre WhatsApp en tu teléfono</p>
            <p>2. Ve a <strong>Configuración → Dispositivos vinculados</strong></p>
            <p>3. Toca <strong>"Vincular un dispositivo"</strong></p>
            <p>4. Escanea este código QR</p>
          </div>
          <div class="auto-refresh">
            Esta página se actualiza automáticamente cada 5 segundos
          </div>
        </div>
        <script>
          // Auto-refresh cada 5 segundos para actualizar el QR si cambia
          setInterval(() => {
            fetch(window.location.href + '?format=json')
              .then(res => {
                if (res.status === 204) {
                  // Sesión ya está lista, redirigir o mostrar mensaje
                  window.location.reload();
                } else if (res.ok) {
                  return res.json();
                } else {
                  throw new Error('Error al obtener QR');
                }
              })
              .then(data => {
                if (data && data.qr) {
                  const img = document.getElementById('qrImage');
                  if (img.src !== data.qr) {
                    img.src = data.qr;
                  }
                }
              })
              .catch(err => {
                console.error('Error al actualizar QR:', err);
              });
          }, 5000);
        </script>
      </body>
      </html>
    `);
  });

  // Obtener estado de una sesión
  router.get('/:sessionId/status', async (req, res) => {
    const { sessionId } = req.params;
    const status = sessionManager.getSessionStatus(sessionId);
    if (!status) {
      return res.status(404).json({ error: 'Sesión no encontrada' });
    }
    res.json(status);
  });

  // Reinicializar una sesión
  router.post('/:sessionId/reinit', async (req, res) => {
    const { sessionId } = req.params;
    try {
      await sessionManager.reinitializeSession(sessionId);
      res.json({ ok: true, message: 'Sesión reinicializada' });
    } catch (err) {
      const status = err.message.includes('no encontrada') ? 404 : 500;
      res.status(status).json({ error: err.message });
    }
  });

  // Eliminar una sesión
  router.delete('/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    try {
      const deleted = await sessionManager.deleteSession(sessionId);
      if (!deleted) {
        return res.status(404).json({ error: 'Sesión no encontrada' });
      }
      res.json({ ok: true, message: 'Sesión eliminada' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Actualizar información de una sesión
  router.patch('/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    const { name, is_active } = req.body || {};
    try {
      const updates = {};
      if (name !== undefined) updates.name = name;
      if (is_active !== undefined) updates.is_active = is_active;
      
      const updated = await sessionManager.updateSession(sessionId, updates);
      if (!updated) {
        return res.status(404).json({ error: 'Sesión no encontrada' });
      }
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

