/* REFERENCE / BORRADOR — NO IMPORTAR EN PRODUCCIÓN SIN PRUEBAS.
   Fragmentos de referencia para notificaciones push (Web Push / VAPID). */

(function () {
  'use strict';
  const RS = window.RS = window.RS || {};
  const U = RS.util;
  const UI = RS.UI;

  // Clave pública VAPID (generada; la privada NUNCA en frontend)
  const VAPID_PUBLIC_KEY = 'BLTaGBdzBzCgK-msTtvoEvv8AAXk5C4LmxWIY0p_81xiML9b1NEXvQv_MD-mU7u74hbUJ8zEWtIvQrYNmKb0GWw';

  RS.Push = RS.Push || {};

  // Convertir clave VAPID base64url a Uint8Array
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
  }

  // Suscribir al usuario a push
  RS.Push.subscribe = async function subscribe() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      UI.toast('Tu navegador no soporta notificaciones push.', 'info');
      return false;
    }
    if (!RS.SupabaseSync.configured()) {
      UI.toast('Inicia sesión para activar notificaciones.', 'info');
      return false;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        UI.toast('No se activaron las notificaciones. Puedes cambiarlo en la configuración del navegador.', 'info');
        return false;
      }
      const reg = await navigator.serviceWorker.ready;
      let subscription = await reg.pushManager.getSubscription();
      if (!subscription) {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }
      // Enviar suscripción al backend
      const token = await RS.Supabase.ensureSession().then((s) => s && s.access_token);
      const sub = subscription.toJSON();
      await RS.Supabase.request('/rest/v1/push_subscriptions', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({
          user_id: (RS.SupabaseSync.supabaseUserId ? RS.SupabaseSync.supabaseUserId(RS.Auth.getUser()) : null),
          endpoint: sub.endpoint,
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth,
          user_agent: navigator.userAgent.slice(0, 200),
          enabled: true,
        }),
      }, token);
      UI.toast('Notificaciones activadas.', 'success');
      return true;
    } catch (e) {
      console.error('Push subscribe error:', e);
      UI.toast(e && e.message ? e.message : 'No se pudo activar las notificaciones.', 'error');
      return false;
    }
  };

  // Desuscribir
  RS.Push.unsubscribe = async function unsubscribe() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        const token = await RS.Supabase.ensureSession().then((s) => s && s.access_token);
        await RS.Supabase.request(`/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(subscription.endpoint)}`, {
          method: 'DELETE',
        }, token);
      }
      UI.toast('Notificaciones desactivadas.', 'info');
      return true;
    } catch (e) {
      console.error('Push unsubscribe error:', e);
      UI.toast('No se pudo desactivar.', 'error');
      return false;
    }
  };

  // Verificar si está suscrito
  RS.Push.isSubscribed = async function isSubscribed() {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      return !!sub;
    } catch (e) {
      return false;
    }
  };

  // UI: botón para activar/desactivar (agregar en perfil o settings)
  // <button data-action="push-toggle">Activar notificaciones</button>
  RS.actions = RS.actions || {};
  RS.actions['push-toggle'] = async (el) => {
    const subscribed = await RS.Push.isSubscribed();
    if (subscribed) {
      await RS.Push.unsubscribe();
    } else {
      await RS.Push.subscribe();
    }
    // Actualizar texto del botón
    const nowSubscribed = await RS.Push.isSubscribed();
    el.textContent = nowSubscribed ? 'Desactivar notificaciones' : 'Activar notificaciones';
  };
})();

/* ----------------- Cambios en sw.js (agregar) ----------------- */
// En sw.js, agregar estos handlers:
//
// self.addEventListener('push', (event) => {
//   let data = { title: 'Recovery Studio', body: 'Tienes una nueva notificación.' };
//   try { data = event.data.json(); } catch (e) { /* usar default */ }
//   event.waitUntil(
//     self.registration.showNotification(data.title || 'Recovery Studio', {
//       body: data.body || '',
//       icon: '/assets/icon-192.png',
//       badge: '/assets/icon-192.png',
//       tag: data.tag || 'rs-notification',
//       data: { url: data.url || '/' },
//     })
//   );
// });
//
// self.addEventListener('notificationclick', (event) => {
//   event.notification.close();
//   const url = (event.notification.data && event.notification.data.url) || '/';
//   event.waitUntil(
//     clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
//       for (const client of clientList) {
//         if (client.url.includes(url) && 'focus' in client) return client.focus();
//       }
//       if (clients.openWindow) return clients.openWindow(url);
//     })
//   );
// });
//
// ----------------- VAPID key generation -----------------
// Generar una vez (no en el repo):
// npx web-push generate-vapid-keys
// O en PowerShell con node:
// node -e "const wp=require('web-push'); const k=wp.generateVAPIDKeys(); console.log('PUBLIC:',k.publicKey); console.log('PRIVATE:',k.privateKey);"
// Guardar pública en frontend (VAPID_PUBLIC_KEY) y privada como secreto VAPID_PRIVATE_KEY.