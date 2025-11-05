import { WApp } from './wapp.js';
import { createSession, getSession, listSessions, updateSession, deleteSession } from './db.js';
import logger from './logger.js';

const MAX_SESSIONS = Number(process.env.MAX_SESSIONS || 10);

export class SessionManager {
  constructor(options = {}) {
    this.sessions = new Map();
    this.maxSessions = options.maxSessions || MAX_SESSIONS;
  }

  /**
   * Crea una nueva sesión de WhatsApp
   * @param {string} sessionId - ID único de la sesión
   * @param {string} name - Nombre opcional para la sesión
   * @returns {Promise<WApp>}
   */
  async createSession(sessionId, name = null) {
    if (this.sessions.has(sessionId)) {
      throw new Error(`La sesión ${sessionId} ya existe`);
    }

    if (this.sessions.size >= this.maxSessions) {
      throw new Error(`Se alcanzó el límite máximo de sesiones (${this.maxSessions})`);
    }

    try {
      // Crear registro en BD
      await createSession(sessionId, name);

      // Crear instancia de WApp
      const wapp = new WApp({ sessionId });
      this.sessions.set(sessionId, wapp);

      // Inicializar la sesión
      await wapp.initialize();

      logger.info({ sessionId, name }, 'Sesión creada e inicializada');
      return wapp;
    } catch (err) {
      logger.error({ err, sessionId }, 'Error al crear sesión');
      // Limpiar si falla
      this.sessions.delete(sessionId);
      await deleteSession(sessionId);
      throw err;
    }
  }

  /**
   * Obtiene una sesión existente
   * @param {string} sessionId - ID de la sesión
   * @returns {WApp|null}
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Obtiene una sesión o la crea si no existe
   * @param {string} sessionId - ID de la sesión
   * @param {string} name - Nombre opcional
   * @returns {Promise<WApp>}
   */
  async getOrCreateSession(sessionId, name = null) {
    let wapp = this.getSession(sessionId);
    if (!wapp) {
      // Verificar si existe en BD pero no está cargada
      const sessionData = await getSession(sessionId);
      if (sessionData) {
        wapp = new WApp({ sessionId });
        this.sessions.set(sessionId, wapp);
        await wapp.initialize();
      } else {
        wapp = await this.createSession(sessionId, name);
      }
    }
    return wapp;
  }

  /**
   * Elimina una sesión
   * @param {string} sessionId - ID de la sesión
   * @returns {Promise<boolean>}
   */
  async deleteSession(sessionId) {
    const wapp = this.sessions.get(sessionId);
    if (wapp) {
      try {
        // Cerrar el cliente si está disponible
        if (wapp.client && typeof wapp.client.destroy === 'function') {
          await wapp.client.destroy();
        }
      } catch (err) {
        logger.warn({ err, sessionId }, 'Error al cerrar cliente al eliminar sesión');
      }
      this.sessions.delete(sessionId);
    }

    const deleted = await deleteSession(sessionId);
    if (deleted) {
      logger.info({ sessionId }, 'Sesión eliminada');
    }
    return deleted;
  }

  /**
   * Lista todas las sesiones con su estado
   * @returns {Promise<Array>}
   */
  async listSessions() {
    const dbSessions = await listSessions();
    return dbSessions.map(session => {
      const wapp = this.sessions.get(session.session_id);
      const status = wapp ? wapp.status() : { ready: false, hasQr: false };
      return {
        ...session,
        status
      };
    });
  }

  /**
   * Carga todas las sesiones activas desde la BD
   * @returns {Promise<void>}
   */
  async loadSessions() {
    const dbSessions = await listSessions();
    const activeSessions = dbSessions.filter(s => s.is_active);

    logger.info({ count: activeSessions.length }, 'Cargando sesiones activas desde BD');

    for (const session of activeSessions) {
      try {
        const wapp = new WApp({ sessionId: session.session_id });
        this.sessions.set(session.session_id, wapp);
        await wapp.initialize();
        logger.info({ sessionId: session.session_id }, 'Sesión cargada e inicializada');
      } catch (err) {
        logger.error({ err, sessionId: session.session_id }, 'Error al cargar sesión');
        // No eliminar de BD, solo no cargarla en memoria
      }
    }
  }

  /**
   * Obtiene el estado de una sesión específica
   * @param {string} sessionId - ID de la sesión
   * @returns {Object|null}
   */
  getSessionStatus(sessionId) {
    const wapp = this.getSession(sessionId);
    if (!wapp) {
      return null;
    }
    return {
      sessionId,
      ...wapp.status(),
      hasQr: !!wapp.qr()
    };
  }

  /**
   * Reinicializa una sesión
   * @param {string} sessionId - ID de la sesión
   * @returns {Promise<void>}
   */
  async reinitializeSession(sessionId) {
    const wapp = this.getSession(sessionId);
    if (!wapp) {
      throw new Error(`Sesión ${sessionId} no encontrada`);
    }
    await wapp.initialize();
    logger.info({ sessionId }, 'Sesión reinicializada');
  }

  /**
   * Obtiene el QR de una sesión
   * @param {string} sessionId - ID de la sesión
   * @returns {string|null}
   */
  getSessionQR(sessionId) {
    const wapp = this.getSession(sessionId);
    if (!wapp) {
      return null;
    }
    return wapp.qr();
  }

  /**
   * Actualiza información de una sesión en BD
   * @param {string} sessionId - ID de la sesión
   * @param {Object} updates - Campos a actualizar
   * @returns {Promise<Object>}
   */
  async updateSession(sessionId, updates) {
    return await updateSession(sessionId, updates);
  }
}

