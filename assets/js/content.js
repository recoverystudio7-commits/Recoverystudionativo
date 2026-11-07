/* ==========================================================================
   Recovery Studio — Descuentos y cápsulas de video
   ========================================================================== */
(function () {
  'use strict';

  const RS = (window.RS = window.RS || {});
  const U = RS.util;
  const UI = RS.UI;

  RS.actions = RS.actions || {};
  RS.forms = RS.forms || {};

  function st() {
    return RS.DB.get();
  }

  function discountCodes() {
    st().settings.discountCodes = Array.isArray(st().settings.discountCodes) ? st().settings.discountCodes : [];
    return st().settings.discountCodes;
  }

  function videoCapsules() {
    st().videoCapsules = Array.isArray(st().videoCapsules) ? st().videoCapsules : [];
    return st().videoCapsules;
  }

  function authToken() {
    const session = RS.Supabase.readSession();
    if (!session || !session.access_token) throw new Error('Tu sesión expiró. Ingresa nuevamente para administrar contenido.');
    return session.access_token;
  }

  function discountFromRow(row) {
    return {
      id: row.id,
      code: row.code,
      type: row.discount_type,
      value: Number(row.value),
      startsAt: row.starts_at || '',
      endsAt: row.ends_at || '',
      active: row.active,
      createdAt: row.created_at,
    };
  }

  function videoFromRow(row) {
    return {
      id: row.id,
      title: row.title,
      category: row.category,
      url: row.url,
      description: row.description,
      active: row.active,
      createdAt: row.created_at,
    };
  }

  async function load() {
    let session = RS.Supabase.readSession();
    const retrySession = async (error) => {
      if (!session || !session.refresh_token || (error.status !== 401 && error.status !== 403)) throw error;
      try {
        session = await RS.Supabase.refreshSession(session);
      } catch (refreshError) {
        if (refreshError.status === 400 || refreshError.status === 401 || refreshError.status === 403) {
          RS.Supabase.writeSession(null);
          return null;
        }
        throw refreshError;
      }
      if (!session || !session.access_token) {
        RS.Supabase.writeSession(null);
        return null;
      }
      return session.access_token;
    };
    const fetchRows = (path, token) => RS.Supabase.request(path, { method: 'GET' }, token);
    const paths = [
      '/rest/v1/discount_codes?select=id,code,discount_type,value,starts_at,ends_at,active,created_at&order=created_at.desc',
      '/rest/v1/video_capsules?select=id,title,category,url,description,active,created_at&order=created_at.desc',
      '/rest/v1/studio_settings?select=config&id=eq.studio&limit=1',
    ];
    let token = session && session.access_token;
    let rows;
    try {
      rows = await Promise.all(paths.map((path) => fetchRows(path, token)));
    } catch (error) {
      token = await retrySession(error);
      if (!token) return;
      rows = await Promise.all(paths.map((path) => fetchRows(path, token)));
    }
    const [discountRows, videoRows, studioRows] = rows;
    if (!Array.isArray(studioRows) || !studioRows.length || !studioRows[0].config || typeof studioRows[0].config !== 'object') {
      throw new Error('No pudimos cargar la configuración del studio desde Supabase.');
    }
    st().settings.discountCodes = (Array.isArray(discountRows) ? discountRows : []).map(discountFromRow);
    st().videoCapsules = (Array.isArray(videoRows) ? videoRows : []).map(videoFromRow);
    st().settings.clubRecoveryReward = String(
      studioRows[0].config.clubRecoveryReward || st().settings.clubRecoveryReward || 'Sesión de sauna'
    );
  }

  async function saveClubRecoveryReward(reward) {
    const token = authToken();
    const rows = await RS.Supabase.request(
      '/rest/v1/studio_settings?select=config&id=eq.studio&limit=1',
      { method: 'GET' },
      token
    );
    if (!Array.isArray(rows) || !rows.length || !rows[0].config || typeof rows[0].config !== 'object') {
      throw new Error('No pudimos leer la configuración del studio para guardar el premio.');
    }
    const config = Object.assign({}, rows[0].config, { clubRecoveryReward: reward });
    const result = await RS.Supabase.request('/rest/v1/studio_settings?id=eq.studio', {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ config }),
    }, token);
    if (!Array.isArray(result) || !result.length) {
      throw new Error('Supabase no confirmó el cambio del premio. Verifica los permisos de administrador.');
    }
  }

  async function saveRow(table, id, row) {
    const token = authToken();
    let result;
    if (id) {
      result = await RS.Supabase.request(`/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(row),
      }, token);
    } else {
      result = await RS.Supabase.request(`/rest/v1/${table}`, {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(row),
      }, token);
    }
    if (!Array.isArray(result) || !result.length) throw new Error('Supabase no confirmó el cambio. Verifica los permisos de administrador.');
  }

  async function deleteRow(table, id) {
    const result = await RS.Supabase.request(`/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Prefer: 'return=representation' },
    }, authToken());
    if (!Array.isArray(result) || !result.length) throw new Error('Supabase no confirmó la eliminación. Verifica los permisos de administrador.');
  }

  function videoSource(value) {
    let url;
    try {
      url = new URL(String(value || '').trim());
    } catch (error) {
      throw new Error('Ingresa un enlace válido de YouTube, Vimeo o video MP4/WebM.');
    }
    if (url.protocol !== 'https:' || url.username || url.password) {
      throw new Error('El enlace debe usar HTTPS.');
    }
    const host = url.hostname.toLowerCase();
    if (host === 'youtu.be' || host === 'youtube.com' || host === 'www.youtube.com' || host === 'm.youtube.com') {
      const id = host === 'youtu.be' ? url.pathname.split('/').filter(Boolean)[0] : url.searchParams.get('v') || url.pathname.split('/').filter(Boolean).pop();
      if (!id || !/^[\w-]{6,20}$/.test(id)) throw new Error('No pudimos identificar el video de YouTube.');
      return { kind: 'embed', src: `https://www.youtube-nocookie.com/embed/${id}` };
    }
    if (host === 'vimeo.com' || host === 'www.vimeo.com' || host === 'player.vimeo.com') {
      const id = url.pathname.split('/').filter(Boolean).pop();
      if (!id || !/^\d{6,12}$/.test(id)) throw new Error('No pudimos identificar el video de Vimeo.');
      return { kind: 'embed', src: `https://player.vimeo.com/video/${id}` };
    }
    if (/\.(mp4|webm|ogg)$/i.test(url.pathname)) {
      return { kind: 'file', src: url.href };
    }
    throw new Error('Usa un enlace de YouTube, Vimeo o un archivo MP4/WebM/OGG con HTTPS.');
  }

  function renderAdmin() {
    const s = st();
    const codes = discountCodes();
    const videos = videoCapsules();
    const editingCode = codes.find((item) => item.id === (RS.ui && RS.ui.editingDiscountId)) || null;
    const editingVideo = videos.find((item) => item.id === (RS.ui && RS.ui.editingVideoId)) || null;
    return `<div class="view">
      <div class="page-head">
        <div><span class="eyebrow">Marketing</span><h1 class="page-title">Promociones y cápsulas</h1><p class="page-sub">Administra códigos de descuento para planes y contenido de video para tus visitantes.</p></div>
      </div>

      <section class="card">
        <div class="card-head"><h2 class="card-title">Códigos de descuento</h2><p class="card-sub">Los códigos activos se pueden aplicar al comprar planes y packs.</p></div>
        <div class="card-body">
          <form data-form="discount-save" class="stack">
            <input type="hidden" name="id" value="${U.esc(editingCode ? editingCode.id : '')}">
            <div class="grid grid-2 gap-sm">
              <div class="field"><label for="discount-code">Palabra o código</label><input class="input" id="discount-code" name="code" maxlength="30" value="${U.esc(editingCode ? editingCode.code : '')}" placeholder="Ej. RECOVERY10" required></div>
              <div class="field"><label for="discount-type">Tipo</label><select class="input" id="discount-type" name="type"><option value="percent" ${!editingCode || editingCode.type === 'percent' ? 'selected' : ''}>Porcentaje (%)</option><option value="fixed" ${editingCode && editingCode.type === 'fixed' ? 'selected' : ''}>Monto fijo (CLP)</option></select></div>
              <div class="field"><label for="discount-value">Descuento</label><input class="input" id="discount-value" name="value" type="number" min="1" step="1" value="${U.esc(editingCode ? editingCode.value : '')}" required></div>
              <div class="field"><label for="discount-start">Válido desde (opcional)</label><input class="input" id="discount-start" name="startsAt" type="date" value="${U.esc(editingCode ? editingCode.startsAt || '' : '')}"></div>
              <div class="field"><label for="discount-end">Válido hasta (opcional)</label><input class="input" id="discount-end" name="endsAt" type="date" value="${U.esc(editingCode ? editingCode.endsAt || '' : '')}"></div>
            </div>
            <label class="check"><input type="checkbox" name="active" ${!editingCode || editingCode.active ? 'checked' : ''}><span>Código activo</span></label>
            <div class="page-actions wrap"><button class="btn btn-primary" type="submit">${UI.icon('check', 16)} ${editingCode ? 'Guardar cambios' : 'Crear código'}</button>${editingCode ? '<button class="btn btn-ghost" type="button" data-action="discount-cancel-edit">Cancelar</button>' : ''}</div>
          </form>
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>Código</th><th>Descuento</th><th>Vigencia</th><th>Estado</th><th></th></tr></thead>
              <tbody>${codes.map((item) => `<tr>
                <td><strong class="mono">${U.esc(item.code)}</strong></td>
                <td>${item.type === 'percent' ? `${item.value}%` : U.fmtMoney(item.value)}</td>
                <td>${item.startsAt || item.endsAt ? `${U.esc(item.startsAt || 'Sin inicio')} – ${U.esc(item.endsAt || 'Sin vencimiento')}` : 'Sin vencimiento'}</td>
                <td>${item.active ? UI.pill('Activo', 'success') : UI.pill('Inactivo', 'neutral')}</td>
                <td><div class="table-actions"><button class="icon-btn" data-action="discount-edit" data-id="${U.esc(item.id)}" title="Editar">${UI.icon('edit', 16)}</button><button class="icon-btn" data-action="discount-toggle" data-id="${U.esc(item.id)}" title="${item.active ? 'Desactivar' : 'Activar'}">${UI.icon(item.active ? 'eye-off' : 'eye', 16)}</button><button class="icon-btn danger" data-action="discount-delete" data-id="${U.esc(item.id)}" title="Eliminar">${UI.icon('trash', 16)}</button></div></td>
              </tr>`).join('') || '<tr><td colspan="5" class="muted">Aún no hay códigos de descuento.</td></tr>'}</tbody>
            </table>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="card-head"><h2 class="card-title">Cápsulas de video</h2><p class="card-sub">Publica consejos, ejercicios o información útil. Los videos activos aparecen en la página pública de cápsulas.</p></div>
        <div class="card-body">
          <form data-form="video-save" class="stack">
            <input type="hidden" name="id" value="${U.esc(editingVideo ? editingVideo.id : '')}">
            <div class="grid grid-2 gap-sm">
              <div class="field"><label for="video-title">Título</label><input class="input" id="video-title" name="title" maxlength="100" value="${U.esc(editingVideo ? editingVideo.title : '')}" required></div>
              <div class="field"><label for="video-category">Categoría</label><input class="input" id="video-category" name="category" maxlength="40" value="${U.esc(editingVideo ? editingVideo.category : '')}" placeholder="Recuperación, movilidad, entrenamiento" required></div>
            </div>
            <div class="field"><label for="video-url">Enlace del video</label><input class="input" id="video-url" name="url" type="url" value="${U.esc(editingVideo ? editingVideo.url : '')}" placeholder="https://youtu.be/..." required><span class="field-hint">Acepta YouTube, Vimeo y archivos MP4, WebM u OGG por HTTPS.</span></div>
            <div class="field"><label for="video-description">Descripción</label><textarea class="input" id="video-description" name="description" rows="3" maxlength="500" required>${U.esc(editingVideo ? editingVideo.description : '')}</textarea></div>
            <label class="check"><input type="checkbox" name="active" ${!editingVideo || editingVideo.active ? 'checked' : ''}><span>Publicar cápsula</span></label>
            <div class="page-actions wrap"><button class="btn btn-primary" type="submit">${UI.icon('check', 16)} ${editingVideo ? 'Guardar cambios' : 'Agregar cápsula'}</button>${editingVideo ? '<button class="btn btn-ghost" type="button" data-action="video-cancel-edit">Cancelar</button>' : ''}</div>
          </form>
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>Cápsula</th><th>Categoría</th><th>Estado</th><th></th></tr></thead>
              <tbody>${videos.map((item) => `<tr>
                <td><strong>${U.esc(item.title)}</strong><br><span class="muted small">${U.esc(item.url)}</span></td>
                <td>${U.esc(item.category)}</td>
                <td>${item.active ? UI.pill('Publicada', 'success') : UI.pill('Oculta', 'neutral')}</td>
                <td><div class="table-actions"><button class="icon-btn" data-action="video-edit" data-id="${U.esc(item.id)}" title="Editar">${UI.icon('edit', 16)}</button><button class="icon-btn" data-action="video-toggle" data-id="${U.esc(item.id)}" title="${item.active ? 'Ocultar' : 'Publicar'}">${UI.icon(item.active ? 'eye-off' : 'eye', 16)}</button><button class="icon-btn danger" data-action="video-delete" data-id="${U.esc(item.id)}" title="Eliminar">${UI.icon('trash', 16)}</button></div></td>
              </tr>`).join('') || '<tr><td colspan="4" class="muted">Aún no hay cápsulas de video.</td></tr>'}</tbody>
            </table>
          </div>
        </div>
      </section>
    </div>`;
  }

  function renderPublic() {
    const videos = videoCapsules().filter((item) => item.active).slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return `<div class="view">
      <div class="page-head">
        <div><span class="eyebrow">Recovery Studio · Aprende y recupera</span><h1 class="page-title">Cápsulas de recuperación</h1><p class="page-sub">Ideas prácticas de movilidad, entrenamiento y recuperación para acompañarte en tu día a día.</p></div>
        <a class="btn btn-outline" href="#/login">${UI.icon('user', 16)} Agenda tu sesión</a>
      </div>
      ${videos.length ? `<div class="plan-grid">${videos.map((item) => `<article class="card">
        <div class="card-body">
          <span class="eyebrow">${U.esc(item.category)}</span>
          <h2 class="card-title">${U.esc(item.title)}</h2>
          <p class="card-sub">${U.esc(item.description)}</p>
          <button class="btn btn-primary" data-action="video-watch" data-id="${U.esc(item.id)}">${UI.icon('play', 16)} Ver cápsula</button>
        </div>
      </article>`).join('')}</div>` : UI.empty({ icon: 'play', title: 'Pronto habrá nuevas cápsulas', text: 'Estamos preparando contenido práctico para ayudarte a entrenar y recuperarte mejor.' })}
    </div>`;
  }

  function playVideo(item) {
    let media;
    try {
      media = videoSource(item.url);
    } catch (error) {
      UI.toast(error.message, 'error');
      return;
    }
    const player = media.kind === 'file'
      ? `<video controls playsinline preload="metadata" style="width:100%;border-radius:12px;background:#071b34" src="${U.esc(media.src)}"></video>`
      : `<div style="position:relative;padding-top:56.25%"><iframe src="${U.esc(media.src)}" title="${U.esc(item.title)}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen style="position:absolute;inset:0;width:100%;height:100%;border:0;border-radius:12px"></iframe></div>`;
    UI.modal({
      title: item.title,
      subtitle: item.category,
      size: 'lg',
      body: `${player}<p class="muted">${U.esc(item.description)}</p>`,
      footer: '<button class="btn btn-primary" data-modal-close>Cerrar</button>',
    });
  }

  RS.forms['discount-save'] = async (form) => {
    const code = String(form.code.value || '').trim().toUpperCase();
    const type = form.type.value;
    const value = Number(form.value.value);
    const startsAt = form.startsAt.value;
    const endsAt = form.endsAt.value;
    const id = form.id.value;
    if (!/^[A-Z0-9_-]{3,30}$/.test(code)) return UI.toast('Usa de 3 a 30 letras, números, guiones o guiones bajos.', 'error');
    if (!Number.isInteger(value) || value < 1 || (type === 'percent' && value > 100)) {
      return UI.toast(type === 'percent' ? 'El porcentaje debe ser un número entero entre 1 y 100.' : 'Ingresa un descuento fijo en pesos mayor que cero.', 'error');
    }
    if (startsAt && endsAt && startsAt > endsAt) return UI.toast('La fecha de término debe ser posterior al inicio.', 'error');
    const codes = discountCodes();
    if (codes.some((item) => item.id !== id && item.code.toUpperCase() === code)) return UI.toast('Ya existe un código con ese nombre.', 'error');
    const current = codes.find((item) => item.id === id);
    const item = {
      id: id || U.uid('discount'),
      code, type, value, startsAt, endsAt, active: form.active.checked,
    };
    await saveRow('discount_codes', id, {
      id: item.id,
      code: item.code,
      discount_type: item.type,
      value: item.value,
      starts_at: item.startsAt || null,
      ends_at: item.endsAt || null,
      active: item.active,
    });
    if (current) Object.assign(current, item);
    else codes.unshift(Object.assign(item, { createdAt: new Date().toISOString() }));
    RS.ui.editingDiscountId = '';
    RS.DB.save();
    RS.data.addAudit(RS.Auth.getUser().name, current ? 'Descuento actualizado' : 'Descuento creado', `${code} · ${type === 'percent' ? `${value}%` : U.fmtMoney(value)}.`);
    UI.toast('Código de descuento guardado.', 'success');
    RS.App.render(true);
  };

  RS.forms['video-save'] = async (form) => {
    const title = String(form.title.value || '').trim();
    const category = String(form.category.value || '').trim();
    const url = String(form.url.value || '').trim();
    const description = String(form.description.value || '').trim();
    const id = form.id.value;
    if (title.length < 3 || category.length < 2 || description.length < 10) return UI.toast('Completa título, categoría y una descripción de al menos 10 caracteres.', 'error');
    try {
      videoSource(url);
    } catch (error) {
      return UI.toast(error.message, 'error');
    }
    const items = videoCapsules();
    const current = items.find((item) => item.id === id);
    const item = {
      id: id || U.uid('video'),
      title, category, url, description, active: form.active.checked,
    };
    await saveRow('video_capsules', id, item);
    if (current) Object.assign(current, item);
    else items.unshift(Object.assign(item, { createdAt: new Date().toISOString() }));
    RS.ui.editingVideoId = '';
    RS.DB.save();
    RS.data.addAudit(RS.Auth.getUser().name, current ? 'Cápsula actualizada' : 'Cápsula agregada', title);
    UI.toast('Cápsula guardada.', 'success');
    RS.App.render(true);
  };

  RS.actions['discount-edit'] = (el) => { RS.ui.editingDiscountId = el.dataset.id; RS.App.render(); };
  RS.actions['discount-cancel-edit'] = () => { RS.ui.editingDiscountId = ''; RS.App.render(); };
  RS.actions['discount-toggle'] = async (el) => {
    const item = discountCodes().find((entry) => entry.id === el.dataset.id);
    if (!item) return;
    const active = !item.active;
    await saveRow('discount_codes', item.id, { active });
    item.active = active;
    RS.DB.save();
    RS.App.render();
  };
  RS.actions['discount-delete'] = async (el) => {
    const item = discountCodes().find((entry) => entry.id === el.dataset.id);
    if (!item) return;
    if (!await UI.confirm({ title: 'Eliminar código', message: `¿Eliminar el código ${item.code}?`, okText: 'Eliminar', danger: true })) return;
    await deleteRow('discount_codes', item.id);
    RS.DB.get().settings.discountCodes = discountCodes().filter((entry) => entry.id !== item.id);
    RS.DB.save();
    RS.App.render();
  };

  RS.actions['video-edit'] = (el) => { RS.ui.editingVideoId = el.dataset.id; RS.App.render(); };
  RS.actions['video-cancel-edit'] = () => { RS.ui.editingVideoId = ''; RS.App.render(); };
  RS.actions['video-toggle'] = async (el) => {
    const item = videoCapsules().find((entry) => entry.id === el.dataset.id);
    if (!item) return;
    const active = !item.active;
    await saveRow('video_capsules', item.id, { active });
    item.active = active;
    RS.DB.save();
    RS.App.render();
  };
  RS.actions['video-delete'] = async (el) => {
    const item = videoCapsules().find((entry) => entry.id === el.dataset.id);
    if (!item) return;
    if (!await UI.confirm({ title: 'Eliminar cápsula', message: `¿Eliminar “${item.title}”?`, okText: 'Eliminar', danger: true })) return;
    await deleteRow('video_capsules', item.id);
    RS.DB.get().videoCapsules = videoCapsules().filter((entry) => entry.id !== item.id);
    RS.DB.save();
    RS.App.render();
  };
  RS.actions['video-watch'] = (el) => {
    const item = videoCapsules().find((entry) => entry.id === el.dataset.id && entry.active);
    if (item) playVideo(item);
  };

  RS.forms['discount-apply'] = (form) => {
    const checkout = RS.ui.checkout;
    if (!checkout || checkout.category !== 'Planes') return UI.toast('Este código solo se aplica a la compra de planes.', 'error');
    const code = String(form.code.value || '').trim().toUpperCase();
    const today = U.todayISO();
    const item = discountCodes().find((entry) => entry.active && entry.code.toUpperCase() === code);
    if (!item) {
      RS.ui.discountFeedback = 'Ese código no existe o no está activo.';
      RS.User.refreshCheckout();
      return UI.toast('Revisa el código ingresado.', 'error');
    }
    if ((item.startsAt && today < item.startsAt) || (item.endsAt && today > item.endsAt)) {
      RS.ui.discountFeedback = 'Ese código está fuera de vigencia.';
      RS.User.refreshCheckout();
      return UI.toast('El código no está vigente en esta fecha.', 'error');
    }
    const originalAmount = Number(checkout.originalAmount) || Number(checkout.amount) || 0;
    const discountAmount = item.type === 'percent'
      ? Math.round(originalAmount * item.value / 100)
      : Math.min(originalAmount, item.value);
    checkout.promoCode = item.code;
    checkout.discountAmount = discountAmount;
    checkout.amount = Math.max(0, originalAmount - discountAmount);
    RS.ui.checkout = checkout;
    RS.ui.discountFeedback = `Código ${item.code} aplicado: ahorras ${U.fmtMoney(discountAmount)}. El descuento se valida con la revisión del pago.`;
    RS.User.refreshCheckout();
  };

  RS.VideoContent = { load, saveClubRecoveryReward, renderAdmin, renderPublic };
})();
