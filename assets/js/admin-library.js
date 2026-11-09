/* ==========================================================================
   Recovery Studio — Admin: Biblioteca de ejercicios
   ========================================================================== */
(function () {
  'use strict';

  const RS = (window.RS = window.RS || {});
  const U = RS.util;
  const UI = RS.UI;
  const Admin = RS.Admin;

  RS.actions = RS.actions || {};
  RS.forms = RS.forms || {};
  RS.changes = RS.changes || {};
  RS.inputs = RS.inputs || {};

  function ensureUi() {
    RS.ui = RS.ui || {};
    if (!RS.ui.libraryQuery) RS.ui.libraryQuery = '';
    if (!RS.ui.libraryCategory) RS.ui.libraryCategory = 'Todas';
    return RS.ui;
  }

  function mediaFor(ex) {
    const src = ex.gifUrl || ex.imageUrl || '';
    if (src) return '<img src="' + U.esc(src) + '" alt="" loading="lazy">';
    return '<span class="lib-thumb-placeholder">' + UI.icon('image', 18) + '</span>';
  }

  function renderLibrary() {
    const ui = ensureUi();
    const lib = RS.ExerciseLibrary;
    const list = lib ? lib.all({ includeInactive: true, category: ui.libraryCategory, query: ui.libraryQuery }) : [];
    const total = lib ? lib.all({ includeInactive: true }).length : 0;
    const activeCount = lib ? lib.all().length : 0;
    const cats = lib ? lib.categories : [];
    const remote = lib && lib.isRemote();
    const counts = {};
    (lib ? lib.all({ includeInactive: true }) : []).forEach((x) => { counts[x.category] = (counts[x.category] || 0) + 1; });
    return '<div class="view">'
      + '<div class="page-head"><div><span class="eyebrow">Entrenamiento</span><h1 class="page-title">Biblioteca de ejercicios</h1>'
      + '<p class="page-sub">Edita cada ejercicio una vez: foto/GIF, descripción e indicaciones. Al armar rutinas eliges de aquí y el usuario lo ve con imágenes y tu marca. <small class="muted">Imágenes libres: free-exercise-db (Unlicense) y Exercise data by <a href="https://repdb.co" rel="nofollow" target="_blank" rel="noopener">RepDB</a>.</small></p></div>'
      + '<button class="btn btn-accent" data-action="library-new">' + UI.icon('plus', 17) + ' Nuevo ejercicio</button></div>'
      + '<div class="stats-grid">'
      + UI.kpi({ label: 'Ejercicios totales', value: String(total), icon: 'dumbbell', tone: 'blue', helper: activeCount + ' activos' })
      + UI.kpi({ label: 'Categorías', value: String(cats.length), icon: 'layers', tone: 'orange', helper: 'Fuerza, CrossFit, Cardio…' })
      + UI.kpi({ label: 'Fuente', value: remote ? 'Nube' : 'Local', icon: 'refresh', tone: 'green', helper: remote ? 'Sincronizado con Supabase' : 'Respaldo en este equipo' })
      + '</div>'
      + (remote ? '' : '<div class="callout callout-orange" style="margin-bottom:12px">' + UI.icon('alert-triangle', 17) + '<span><strong>Biblioteca en modo local.</strong> Para sincronizar entre equipos, aplica el SQL <code>01_biblioteca_ejercicios.sql</code> en Supabase (1 pegada). Mientras tanto, el selector de rutinas ya funciona con la copia local.</span></div>')
      + '<div class="card"><div class="card-head head-row"><div><h2 class="card-title">Listado (' + list.length + ')</h2><p class="card-sub">Busca, filtra por categoría y edita.</p></div>'
      + '<div class="head-row" style="gap:8px;flex-wrap:wrap">'
      + '<select class="input input-sm" data-change="library-category" style="max-width:190px">' + '<option value="Todas"' + (ui.libraryCategory === 'Todas' ? ' selected' : '') + '>Todas las categorías</option>' + cats.map((c) => '<option value="' + U.esc(c) + '"' + (ui.libraryCategory === c ? ' selected' : '') + '>' + U.esc(c) + ' (' + (counts[c] || 0) + ')</option>').join('') + '</select>'
      + '<div class="input-icon input-search">' + UI.icon('search', 16) + '<input class="input input-sm" placeholder="Buscar ejercicios…" value="' + U.esc(ui.libraryQuery) + '" data-input="library-search"></div></div></div>'
      + '<div class="table-wrap"><table class="table library-table"><thead><tr><th>Ejercicio</th><th>Categoría</th><th>Material</th><th>Nivel</th><th>Media</th><th>Estado</th><th></th></tr></thead><tbody>'
      + (list.length ? list.map((ex) => '<tr class="' + (ex.isActive ? '' : 'row-muted') + '"><td><div class="table-user"><span class="catalog-icon">' + UI.icon('dumbbell', 18) + '</span><div><strong>' + U.esc(ex.name) + '</strong><span>' + U.esc(ex.muscleGroup || '—') + '</span></div></div></td><td>' + U.esc(ex.category) + '</td><td>' + U.esc(ex.equipment || '—') + '</td><td>' + U.esc(ex.difficulty || '—') + '</td><td>' + (ex.gifUrl || ex.imageUrl ? '<span class="pill pill-success">Con imagen</span>' : '<span class="muted small">Sin imagen</span>') + '</td><td>' + (ex.isActive ? UI.pill('Activo', 'success') : UI.pill('Inactivo', 'neutral')) + '</td><td><div class="table-actions"><button class="icon-btn" data-action="library-edit" data-id="' + ex.id + '" title="Editar">' + UI.icon('edit', 16) + '</button><button class="icon-btn ' + (ex.isActive ? 'danger' : '') + '" data-action="library-toggle" data-id="' + ex.id + '" title="' + (ex.isActive ? 'Desactivar' : 'Activar') + '">' + UI.icon(ex.isActive ? 'eye-off' : 'eye', 16) + '</button><button class="icon-btn danger" data-action="library-delete" data-id="' + ex.id + '" title="Eliminar">' + UI.icon('trash', 16) + '</button></div></td></tr>').join('') : '<tr><td colspan="7"><div class="empty">No hay ejercicios con ese filtro.</div></td></tr>')
      + '</tbody></table></div></div></div>';
  }

  function openEditor(existing) {
    const cats = RS.ExerciseLibrary.categories;
    const ex = existing ? JSON.parse(JSON.stringify(existing)) : {
      id: 'ex-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: '',
      category: 'Musculación',
      muscleGroup: '',
      equipment: 'Sin material',
      difficulty: 'Principiante',
      description: '',
      cues: '',
      commonErrors: '',
      variants: '',
      imageUrl: '',
      gifUrl: '',
      videoUrl: '',
      isActive: true,
      sortOrder: 0,
    };
    UI.modal({
      title: existing ? 'Editar ejercicio' : 'Nuevo ejercicio',
      subtitle: 'Esto se usa al armar rutinas y lo ve el usuario con tu marca.',
      size: 'lg',
      body: '<form data-form="library-save" id="library-form"><input type="hidden" name="id" value="' + U.esc(ex.id) + '">'
        + '<div class="grid grid-2 gap-sm">'
        + '<div class="field"><label>Nombre *</label><input class="input" name="name" value="' + U.esc(ex.name) + '" required placeholder="Ej. Sentadilla goblet"></div>'
        + '<div class="field"><label>Categoría *</label><select class="input" name="category">' + cats.map((c) => '<option value="' + U.esc(c) + '"' + (ex.category === c ? ' selected' : '') + '>' + U.esc(c) + '</option>').join('') + '</select></div>'
        + '<div class="field"><label>Músculo / foco</label><input class="input" name="muscleGroup" value="' + U.esc(ex.muscleGroup || '') + '" placeholder="Ej. Cuádriceps / Glúteo"></div>'
        + '<div class="field"><label>Material</label><input class="input" name="equipment" value="' + U.esc(ex.equipment || '') + '" placeholder="Sin material, barra, mancuerna…"></div>'
        + '<div class="field"><label>Nivel</label><select class="input" name="difficulty">' + ['Principiante', 'Intermedio', 'Avanzado'].map((d) => '<option value="' + d + '"' + (ex.difficulty === d ? ' selected' : '') + '>' + d + '</option>').join('') + '</select></div>'
        + '<div class="field"><label>Orden</label><input class="input" name="sortOrder" type="number" value="' + (ex.sortOrder || 0) + '"></div>'
        + '</div>'
        + '<div class="grid grid-2 gap-sm" style="margin-top:10px">'
        + '<div class="field"><label>Foto (URL)</label><input class="input" name="imageUrl" type="url" value="' + U.esc(ex.imageUrl || '') + '" placeholder="https://…"></div>'
        + '<div class="field"><label>GIF animado (URL)</label><input class="input" name="gifUrl" type="url" value="' + U.esc(ex.gifUrl || '') + '" placeholder="https://… (si hay GIF, se prioriza)"></div>'
        + '<div class="field"><label>Video YouTube (URL)</label><input class="input" name="videoUrl" type="url" value="' + U.esc(ex.videoUrl || '') + '" placeholder="https://www.youtube.com/…"></div>'
        + '<div class="field" style="display:flex;align-items:center;gap:8px"><label class="check check-boxed" style="flex:1"><input type="checkbox" name="isActive" ' + (ex.isActive ? 'checked' : '') + '><span>Activo / visible</span></label></div>'
        + '</div>'
        + '<div class="field" style="margin-top:10px"><label>Descripción (qué es / para qué sirve)</label><textarea class="input" name="description" rows="2">' + U.esc(ex.description || '') + '</textarea></div>'
        + '<div class="field"><label>Indicaciones paso a paso</label><textarea class="input" name="cues" rows="3" placeholder="Ej. Pies ancho cadera, baja entre talones, talones apoyados…">' + U.esc(ex.cues || '') + '</textarea></div>'
        + '<div class="grid grid-2 gap-sm"><div class="field"><label>Errores comunes</label><textarea class="input" name="commonErrors" rows="2">' + U.esc(ex.commonErrors || '') + '</textarea></div>'
        + '<div class="field"><label>Variantes / regresiones</label><textarea class="input" name="variants" rows="2">' + U.esc(ex.variants || '') + '</textarea></div></div>'
        + '<p class="form-error" id="library-error" role="alert"></p></form>',
      footer: '<button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" type="submit" form="library-form">' + UI.icon('check', 16) + ' Guardar ejercicio</button>',
    });
  }

  RS.forms['library-save'] = async (form) => {
    const err = document.getElementById('library-error');
    const name = form.name.value.trim();
    if (!name) {
      err.textContent = 'Ingresa un nombre.';
      err.classList.add('show');
      return;
    }
    const item = {
      id: form.id.value,
      name,
      category: form.category.value,
      muscleGroup: form.muscleGroup.value.trim(),
      equipment: form.equipment.value.trim() || 'Sin material',
      difficulty: form.difficulty.value,
      sortOrder: Number(form.sortOrder.value) || 0,
      imageUrl: form.imageUrl.value.trim(),
      gifUrl: form.gifUrl.value.trim(),
      videoUrl: form.videoUrl.value.trim(),
      description: form.description.value.trim(),
      cues: form.cues.value.trim(),
      commonErrors: form.commonErrors.value.trim(),
      variants: form.variants.value.trim(),
      isActive: form.isActive.checked,
    };
    try {
      await RS.ExerciseLibrary.save(item);
      RS.data.addAudit(RS.Auth.getUser().name, 'Biblioteca actualizada', item.name + ' · ' + item.category + '.');
      UI.closeModal();
      UI.toast(RS.ExerciseLibrary.isRemote() ? 'Ejercicio guardado y sincronizado.' : 'Ejercicio guardado en este equipo (modo local).', 'success');
      RS.App.render(true);
    } catch (e) {
      err.textContent = e.message || 'No pudimos guardar.';
      err.classList.add('show');
    }
  };

  RS.actions['library-new'] = () => openEditor(null);
  RS.actions['library-edit'] = (el) => {
    const ex = RS.ExerciseLibrary.get(el.dataset.id);
    if (ex) openEditor(ex);
  };
  RS.actions['library-toggle'] = async (el) => {
    const ex = RS.ExerciseLibrary.get(el.dataset.id);
    if (!ex) return;
    try {
      await RS.ExerciseLibrary.save(Object.assign({}, ex, { isActive: !ex.isActive }));
      UI.toast(ex.isActive ? 'Ejercicio desactivado.' : 'Ejercicio activado.', 'success');
      RS.App.render(true);
    } catch (e) {
      UI.toast(e.message || 'No pudimos actualizar.', 'error');
    }
  };
  RS.actions['library-delete'] = async (el) => {
    const ex = RS.ExerciseLibrary.get(el.dataset.id);
    if (!ex) return;
    const ok = await UI.confirm({ title: 'Eliminar ejercicio', message: 'Se eliminará "' + ex.name + '" de la biblioteca. Las rutinas ya guardadas conservan su copia y no se borran.', okText: 'Eliminar', danger: true });
    if (!ok) return;
    try {
      await RS.ExerciseLibrary.remove(ex.id);
      UI.toast('Ejercicio eliminado.', 'success');
      RS.App.render(true);
    } catch (e) {
      UI.toast(e.message || 'No pudimos eliminar.', 'error');
    }
  };

  RS.inputs['library-search'] = (el) => {
    ensureUi().libraryQuery = el.value;
    clearTimeout(el._t);
    el._t = setTimeout(() => RS.App.render(false), 200);
  };
  RS.changes['library-category'] = (el) => {
    ensureUi().libraryCategory = el.value;
    RS.App.render(false);
  };

  RS.Admin.renderLibrary = renderLibrary;
  RS.Admin.openLibraryEditor = openEditor;
})();
