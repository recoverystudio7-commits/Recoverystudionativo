/* ==========================================================================
   Recovery Studio — Fichas clínicas y formatos de reembolso (panel admin)
   Plantillas imprimibles de una evaluación Kinésica (MINSAL SIS) y de la
   solicitud de reembolso de una Isapire / Fonasa.
   ========================================================================== */
(function () {
  'use strict';

  const RS = (window.RS = window.RS || {});
  const U = RS.util;
  const UI = RS.UI;

  const STUDIO_RUT = '317873';
  const STUDIO_GIRO_SII = '869092';

  /* Logo del estudio para los documentos imprimibles (favicon/Icon, azul + naranjo). */
  const LOGO_SVG = '<svg width="40" height="40" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><rect width="512" height="512" rx="120" fill="#2563EB"/><path d="M184 392V144h92c48 0 80 29 80 75 0 35-18 61-50 71l70 102" fill="none" stroke="#FFFFFF" stroke-width="38" stroke-linecap="round" stroke-linejoin="round"/><circle cx="376" cy="144" r="35" fill="#E67E22"/></svg>';

  /* Hoja de estilo de un documento imprimible: fondo blanco, acentos azul y naranjo. */
  const DOC_CSS = `
      .cf-doc{
        --blue:#2563EB; --orange:#E67E22; --ink:#0F172A; --muted:#6a7a72; --line:#E5E7EB;
        font-family:Arial,Helvetica,sans-serif; background:#fff; color:var(--ink);
        margin:0; padding:20px 24px;
      }
      .cf-doc .cf-head{display:flex; justify-content:space-between; align-items:flex-start; gap:12px; padding-bottom:10px; border-bottom:2px solid var(--blue); margin-bottom:12px}
      .cf-doc .cf-logo{flex:0 0 auto}
      .cf-doc .cf-brand{flex:1 1 auto; min-width:0}
      .cf-doc .cf-brand-name{font-size:20px; font-weight:700; color:var(--blue)}
      .cf-doc .cf-brand-meta{font-size:10px; color:var(--muted); margin-top:2px}
      .cf-doc .cf-brand-rut{font-size:11px; color:var(--muted); text-align:right}
      .cf-doc h1{font-size:18px; font-weight:700; text-align:center; margin:10px 0 4px; color:var(--blue)}
      .cf-doc .cf-sub{font-size:10px; color:var(--muted); text-align:center; margin:0 0 14px}
      .cf-doc h2{font-size:12px; font-weight:700; color:var(--blue); padding-bottom:5px; border-bottom:2px solid var(--orange); margin:16px 0 6px}
      .cf-doc .kv{display:flex; flex-wrap:wrap; gap:6px 18px; font-size:11px; margin:0 0 10px}
      .cf-doc .kv b{font-weight:700}
      .cf-doc table{width:100%; border-collapse:collapse; margin:6px 0}
      .cf-doc th{color:var(--blue); font-weight:700; font-size:11px; text-align:left; padding:6px 7px; border:1px solid var(--line); border-top:2px solid var(--blue)}
      .cf-doc td{border:1px solid var(--line); font-size:11px; padding:4px 7px}
      .cf-doc td.m-side{width:40%} td.eva{width:10%; text-align:center} td.eva-lbl{width:46%} td.eva-obs{width:44%} td.eva-obs2{width:46%}
      .cf-doc .hint{font-size:10px; color:var(--muted); margin:4px 0 10px}
      .cf-doc .fase{color:var(--orange); font-weight:700}
      .cf-doc .obs-area{min-height:40px; border:1px solid var(--line); background:#FAFAFA; margin:8px 0}
      .cf-doc .sign{margin-top:16px; font-size:11px}
      .cf-doc .printbar{margin-top:20px; text-align:right}
      .cf-doc .printbar button{background:var(--blue); color:#fff; border:0; padding:8px 16px; font-weight:700; border-radius:6px; cursor:pointer}
      @media print{.cf-doc .printbar{display:none}}`;

  function esc(value) {
    return U.esc ? U.esc(value) : String(value == null ? '' : value);
  }

  function todayISO() {
    return U.todayISO ? U.todayISO() : new Date().toISOString().slice(0, 10);
  }

  function fmtDate(value, fallback) {
    if (U.fmtDate && value) return U.fmtDate(value, 'long');
    return esc(value || fallback || '');
  }

  function getUser(id) {
    return (RS.data && typeof RS.data.getUser === 'function') ? RS.data.getUser(id) : null;
  }

  function coachInfo() {
    return (RS.data && typeof RS.data.coachInfo === 'function') ? RS.data.coachInfo() : {};
  }

  function studioHeader() {
    return `<div class="cf-head">
      <div class="cf-logo">${LOGO_SVG}</div>
      <div class="cf-brand"><span class="cf-brand-name">Recovery Studio</span><span class="cf-brand-meta">Gorbea, Región de la Araucanía · ${esc(BRAND_PHONE())}</span></div>
      <div class="cf-brand-rut">R.S.I.S. ${STUDIO_RUT} · Giro SII ${STUDIO_GIRO_SII}</div>
    </div>`;
  }

  function BRAND_PHONE() {
    return (RS.BRAND && RS.BRAND.whatsappDisplay) || '+56 9 6505 8439';
  }

  function printBar() {
    return `<div class="printbar"><button onclick="window.print()">Imprimir / Guardar como PDF</button></div>`;
  }

  /* ----------------------------- ficha clínica ---------------------------- */

  function clinicalEvalHtml(user) {
    const u = user || {};
    const id = coachInfo();
    const created = u.createdAt ? (u.createdAt.slice(0, 10)) : '';
    const rows = [
      'Cuello (rotación)',
      'Hombro (flexión / abducción)',
      'Cadera (flexión / abducción)',
      'Rodilla (flexión / extensión)',
      'Tobillo (dorsiflexión / plantarflexión)',
    ].map((name) => `<tr><td class="m-side">${esc(name)}</td><td class="eva">De °</td><td class="eva">A °</td><td class="eva-obs"></td></tr>`).join('');
    const functional = [
      'Test de empuje estático de extensión',
      'Test de palidez/centrado en articulación',
      'Prueba de flexor funcional (músculos agonistas)',
      'Prueba de fuerza en rango',
      'Prueba de alta / especial',
    ].map((name) => `<tr><td>${esc(name)}</td><td class="eva-obs"></td><td class="eva-obs"></td><td class="eva-obs"></td></tr>`).join('');
    const evaRows = [
      'Cuello', 'Hombro', 'Cadera', 'Rodilla', 'Tobillo', 'Vuelo / costado',
    ].map((region) => `<tr><td class="eva-lbl">${esc(region)}</td><td class="eva"><b>/</b></td><td class="eva-obs"></td></tr>`).join('');
    const evaTable = `
      <h2>EVA (Escala Visual Analógica)</h2>
      <table><thead><tr><th>Región</th><th>MDC EVA (0–10)</th><th>Observaciones</th></tr></thead><tbody>${evaRows}</tbody></table>
      <p class="hint">EVA: 0 = nada, 1-3 leve, 4-6 moderado, 7-8 fuerte, 9-10 intenso. MDC = máximo dolor que puede interpretar en escala 0 a 10.</p>`;
    const romTable = `
      <h2>Rango de movimiento según región</h2>
      <table><thead><tr><th>Región</th><th>Movimiento / Prueba</th><th>De °</th><th>A °</th><th>Observaciones</th></tr></thead><tbody>${rows}</tbody></table>`;
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Ficha clínica Kinésica · ${esc(u.name || '')}</title>
    <style>${DOC_CSS}</style></head><body>
      <div class="cf-doc">
      ${studioHeader()}
      <h1>FICHA CLÍNICA KINÉSICA · MINSAL SIS</h1>
      <p class="cf-sub">Evaluación clínica de movilidad y recuperación · Fecha: ${esc(todayISO())}</p>
      <h2>Datos del usuario</h2>
      <div class="kv">
        <span>Nombre: <b>${esc(u.name || '')}</b></span>
        <span>Teléfono: <b>${esc(u.phone || '')}</b></span>
        <span>Correo: <b>${esc(u.email || '')}</b></span>
        <span>Inscripción: <b>${esc(created || '—')}</b></span>
        <span>Objetivo: <b>${esc(u.goal || '—')}</b></span>
      </div>
      <h2>Diagnóstico y clasificación clínica</h2>
      <div class="kv">
        <span>Diagnóstico / Evaluado: <b>_____</b></span>
        <span>Mecanismo de lesión: <b>_____</b></span>
        <span>Tiempo desde el inicio: <b>_____</b></span>
        <span>Fase clínica: <b class="fase">_____</b></span>
      </div>
      <p class="hint">Ejemplos de tiempo: Acuoso/Agudo — durante los primeros días y hasta ~2 semanas (hasta 72 h tras traumatismo agudo); Subagudo — de ~2 a 6 semanas tras lesión aguda; Crónico — a partir de ~6 semanas o más de 6 semanas tras lesión repetitiva o recaída. Fases: ACUOSO/AGUDO · SUBAGUDO · CRÓNICO.</p>
      ${evaTable}
      ${romTable}
      <h2>Pruebas funcionales</h2>
      <table><thead><tr><th>Prueba</th><th>Resultado / Observación</th><th>Estado</th><th>Notas</th></tr></thead><tbody>${functional}</tbody></table>
      <h2>Fuerza y control</h2>
      <div class="kv"><span>Máximo estimado (P): <b>_____</b></span><span>Máximo SNC: <b>_____</b></span><span>Rango de recuperación: <b>_____</b></span></div>
      <h2>Observaciones del profesional</h2>
      <div class="obs-area"></div>
      <div class="sign">Firma del coach / evaluado: _________________________ · ${esc(id.coachName || 'Coach')} · ${esc(id.coachProfession || '')} · Fecha: ${esc(todayISO())}</div>
      ${printBar()}
      </div>
    </body></html>`;
  }

  /* -------------------------- formato de reembolso ------------------------ */

  function refundFormatHtml(user) {
    const u = user || {};
    const id = coachInfo();
    const today = todayISO();
    const kv = (label, value) => `<span>${esc(label)}: <b>${esc(value)}</b></span>`;
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Reembolso Isapire / Fonasa · ${esc(u.name || '')}</title>
    <style>${DOC_CSS}</style></head><body>
      <div class="cf-doc">
      ${studioHeader()}
      <h1>SOLICITUD DE REEMBOLSO · ISAPIRE / FONASA</h1>
      <p class="cf-sub">Evaluación Kinésica de ${esc(u.name || '')} · Fecha: ${esc(today)}</p>
      <h2>Datos del usuario</h2>
      <div class="kv">
        ${kv('Nombre', u.name || '')}
        ${kv('Correo', u.email || '')}
        ${kv('Teléfono', u.phone || '')}
      </div>
      <h2>Datos del establecimiento (R.S.I.S.)</h2>
      <div class="kv">
        ${kv('R.S.I.S.', STUDIO_RUT)}
        ${kv('Giro SII', STUDIO_GIRO_SII)}
        ${kv('Establecimiento', 'Recovery Studio · Gorbea, Región de la Araucanía')}
        ${kv('Fecha del documento', today)}
      </div>
      <h2>Concepto de evaluación · Reembolso solicitado</h2>
      <div class="kv">
        ${kv('Servicio', u.goal ? `Evaluación Kinésica · objetivo: ${esc(u.goal)}` : 'Evaluación Kinésica')}
        ${kv('Monto del concepto', '$0,00 (Evaluación Kinésica del estudio)')}
        ${kv('Porcentaje gravable', 'Según propia normativa de Isapire/Fonasa')}
      </div>
      <h2>Justificación médica</h2>
      <p>Se adjunta la ficha clínica Kinésica (MINSAL SIS) con la evaluación de movilidad y rango de articulaciones obtenida en el estudio.</p>
      <p>Motivo del reembolso: evaluación preventiva de movilidad y recuperación muscular para ${esc(u.name || '')}. ${esc(u.goal ? '(' + u.goal + ')' : '')}</p>
      <div class="sign">Firma del coach / coach responsable: _________________________ · ${esc(id.coachName || 'Coach')} · Fecha: ${esc(today)}</div>
      ${printBar()}
      </div>
    </body></html>`;
  }

  /* -------------------------------- acciones ------------------------------ */

  function openClinicalEval(user) {
    if (!user) return;
    UI.modal({
      title: 'Ficha clínica Kinésica · MINSAL SIS',
      subtitle: `${user.name} · ${user.email || ''}`,
      size: 'md',
      body: clinicalEvalHtml(user),
      footer: `<button class="btn btn-ghost" data-modal-close>Cerrar</button><button class="btn btn-primary" onclick="window.print()">Imprimir / Guardar como PDF</button>`,
    });
  }

  function openRefundFormat(user) {
    if (!user) return;
    UI.modal({
      title: 'Formato de reembolso · Isapire / Fonasa',
      subtitle: `${user.name} · ${user.email || ''}`,
      size: 'md',
      body: refundFormatHtml(user),
      footer: `<button class="btn btn-ghost" data-modal-close>Cerrar</button><button class="btn btn-primary" onclick="window.print()">Imprimir / Guardar como PDF</button>`,
    });
  }

  RS.actions['admin-clinical-eval'] = (el) => openClinicalEval(getUser(el.dataset.id));
  RS.actions['admin-refund-format'] = (el) => openRefundFormat(getUser(el.dataset.id));
})();
