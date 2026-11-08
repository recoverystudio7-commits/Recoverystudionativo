/* REFERENCE / BORRADOR — NO IMPORTAR EN PRODUCCIÓN SIN PRUEBAS.
   Reemplaza el comportamiento de admin-user-delete para eliminar también en Supabase. */

(function () {
  'use strict';
  const RS = window.RS = window.RS || {};
  const U = RS.util;
  const UI = RS.UI;

  // Reemplazar RS.actions['admin-user-delete'] existente con esta versión:
  RS.actions = RS.actions || {};
  RS.actions['admin-user-delete'] = async (el) => {
    const user = st().users.find((item) => item.id === el.dataset.id && item.role === 'user');
    if (!user) return;
    const ok = await UI.confirm({
      title: 'Eliminar usuario',
      message: `Se eliminará permanentemente la cuenta de ${user.name} (${user.email}), sus sesiones, pagos y sellos. Esta acción no se puede deshacer. El usuario podrá registrarse nuevamente desde la app.`,
      okText: 'Eliminar usuario',
      danger: true,
    });
    if (!ok) return;

    // Si el usuario tiene cuenta en Supabase, eliminar allá primero.
    const isSupabaseUser = RS.SupabaseSync && RS.SupabaseSync.supabaseUserId && RS.SupabaseSync.supabaseUserId(user);
    if (isSupabaseUser) {
      try {
        const session = RS.Supabase.readSession();
        if (!session || !session.access_token) throw new Error('Inicia sesión como admin.');
        await RS.Supabase.request('/functions/v1/delete-user', {
          method: 'POST',
          body: JSON.stringify({ userId: isSupabaseUser }),
        }, session.access_token);
      } catch (e) {
        UI.toast(e && e.message ? e.message : 'No se pudo eliminar en el servidor. No se eliminó localmente.', 'error');
        return;
      }
    }

    // Limpieza local
    st().users = st().users.filter((u) => u.id !== user.id);
    st().sessions = (st().sessions || []).filter((s) => s.userId !== user.id);
    st().payments = (st().payments || []).filter((p) => p.userId !== user.id);
    RS.DB.save();
    RS.data.addAudit(me().name, 'Usuario eliminado', `${user.name} (${user.email}).`);
    UI.closeModal();
    UI.toast('Usuario eliminado.', 'success');
    RS.App.render(true);
  };
})();