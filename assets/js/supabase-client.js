/* ==========================================================================
   Recovery Studio — Supabase Auth and REST client
   ========================================================================== */
(function () {
  'use strict';

  const RS = (window.RS = window.RS || {});
  const AUTH_STORAGE_KEY = 'recoveryStudio.supabase.auth.v1';

  function config() {
    const value = RS.SupabaseConfig;
    if (!value || !value.url || !value.anonKey) {
      throw new Error('La conexión con Supabase no está configurada.');
    }
    return value;
  }

  function readSession() {
    try {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY) || sessionStorage.getItem(AUTH_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      throw new Error('No pudimos leer la sesión segura del navegador.');
    }
  }

  function writeSession(session) {
    try {
      if (session) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
        sessionStorage.removeItem(AUTH_STORAGE_KEY);
      } else {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        sessionStorage.removeItem(AUTH_STORAGE_KEY);
      }
    } catch (error) {
      throw new Error('No pudimos guardar la sesión. Habilita el almacenamiento del navegador e inténtalo de nuevo.');
    }
  }

  async function request(path, options, accessToken) {
    const settings = options || {};
    const base = config().url.replace(/\/$/, '');
    const headers = Object.assign({
      apikey: config().anonKey,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    }, settings.headers || {});
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    let response;
    try {
      response = await fetch(`${base}${path}`, Object.assign({}, settings, { headers }));
    } catch (error) {
      throw new Error('No pudimos conectar con Supabase. Revisa tu conexión e inténtalo de nuevo.');
    }

    const text = await response.text();
    let result = null;
    if (text) {
      try {
        result = JSON.parse(text);
      } catch (error) {
        if (response.ok) throw new Error('Supabase devolvió una respuesta no válida.');
      }
    }
    if (!response.ok) {
      const detail = result && (result.msg || result.message || result.error_description || result.error);
      const error = new Error(detail || `La operación en Supabase falló (${response.status}).`);
      error.status = response.status;
      throw error;
    }
    return result;
  }

  async function refreshSession(session) {
    if (!session || !session.refresh_token) return null;
    const refreshed = await request('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    writeSession(refreshed);
    return refreshed;
  }

  /* Devuelve una sesión válida; renueva el token si está por vencer. */
  async function ensureSession() {
    let session = readSession();
    if (!session || !session.access_token) return null;
    const expiresAt = Number(session.expires_at) || 0;
    if (expiresAt && expiresAt * 1000 < Date.now() + 120000 && session.refresh_token) {
      try {
        session = await refreshSession(session);
      } catch (error) {
        if (error.status === 400 || error.status === 401) {
          writeSession(null);
          return null;
        }
        throw error;
      }
    }
    return session;
  }

  async function getUser() {
    const session = readSession();
    if (!session || !session.access_token) return null;
    try {
      return await request('/auth/v1/user', { method: 'GET' }, session.access_token);
    } catch (error) {
      if (error.status !== 401) throw error;
      if (!session.refresh_token) {
        writeSession(null);
        return null;
      }
      let refreshed;
      try {
        refreshed = await refreshSession(session);
      } catch (refreshError) {
        if (refreshError.status === 400 || refreshError.status === 401) {
          writeSession(null);
          return null;
        }
        throw refreshError;
      }
      try {
        return await request('/auth/v1/user', { method: 'GET' }, refreshed.access_token);
      } catch (retryError) {
        writeSession(null);
        throw retryError;
      }
    }
  }

  RS.Supabase = {
    request,
    readSession,
    writeSession,
    refreshSession,
    ensureSession,
    auth: {
      signInWithPassword(email, password) {
        return request('/auth/v1/token?grant_type=password', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
      },
      signUp(email, password, metadata) {
        return request('/auth/v1/signup', {
          method: 'POST',
          body: JSON.stringify({ email, password, data: metadata || {} }),
        });
      },
      getUser,
      signOut(token) {
        return request('/auth/v1/logout', { method: 'POST' }, token);
      },
      updatePassword(password, token) {
        return request('/auth/v1/user', {
          method: 'PUT',
          body: JSON.stringify({ password }),
        }, token);
      },
    },
  };
})();
