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
    ].map((name) => `<tr><td class="m-side">${esc(name)}</td><td class="m-num"></td><td class="m-num"></td><td class="m-obs"></td></tr>`).join('');
    const functional = [
      'Test de empuje estático de extensión',
      'Test de palidez/centrado en articulación',
      'Prueba de flexor funcional (músculos agonistas)',
      'Prueba de fuerza en rango',
      'Prueba de alta / especial',
    ].map((name) => `<tr><td>${esc(name)}</td><td class="m-obs2"></td><td class="m-num2"></td><td class="m-obs"></td></tr>`).join('');
    const evaRows = [
      'Cuello', 'Hombro', 'Cadera', 'Rodilla', 'Tobillo', 'Vuelo / costado',
    ].map((region) => `<tr><td class="m-side">${esc(region)}</td><td class="m-num"></td><td class="m-obs"></td></tr>`).join('');
    const evaTable = `
      <h2>EVA (Escala Visual Analógica)</h2>
      <table><thead><tr><th>Región</th><th>MDC EVA (0–10)</th><th>Observaciones</th></tr></thead><tbody>${evaRows}</tbody></table>
      <p class="hint">EVA: 0 = nada, 1-3 leve, 4-6 moderado, 7-8 fuerte, 9-10 intenso. MDC = máxima dolor que puede interpretar en escala 0 a 10.</p>`;
    const romTables = (title, bodyRows) => `
      <h2>${esc(title)}</h2>
      <table><thead><tr><th>Región</th><th>Movimiento / Prueba</th><th>De °</th><th>A °</th><th>Observaciones</th></tr></thead><tbody>${bodyRows}</tbody></table>`;
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Ficha clínica Kinésica · ${esc(u.name || '')}</title>
    <style>
      body{font-family:Arial,Helvetica,sans-serif;color:#222;margin:22px;padding:0}
      .cf-head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #1E2C25;padding-bottom:8px;margin-bottom:14px}
      .cf-brand-name{font-size:20px;font-weight:700;color:#1E2C25}
      .cf-brand-meta{font-size:10px;color:#555}
      .cf-brand-rut{font-size:11px;color:#555;text-align:right}
      h1{font-size:18px;font-weight:700;text-align:center;margin:0 0 6px}
      .cf-sub{font-size:10px;color:#555;text-align:center;margin:0 0 14px}
      h2{font-size:13px;font-weight:700;border-bottom:1px solid #999;padding-bottom:2px;margin:14px 0 6px}
      .kv{display:flex;flex-wrap:wrap;gap:4px 18px;margin:0 0 10px;font-size:11px}
      .kv b{font-weight:700}
      .hint{font-size:10px;color:#555;margin:4px 0 10px}
      table{width:100%;border-collapse:collapse;margin-top:4px}
      td{border:1px solid #999;padding:3px 4px;font-size:11px}
      td.m-side{width:46%}td.m-num{width:16%;text-align:center}td.m-obs{width:38%;font-size:10px}
      td.m-num2{width:26%;text-align:center}td.m-obs2{width:28%;font-size:10px}
      .obs-area{min-height:42px;border:1px solid #999;margin:8px 0}
      .sign{margin-top:18px;font-size:11px}
      .printbar{margin-top:20px;text-align:right}
      .printbar button{background:#2563EB;color:#fff;border:0;padding:8px 16px;font-weight:700;border-radius:6px;cursor:pointer}
      @media print{.printbar{display:none}}
    </style></head><body>
      ${studioHeader()}
      <h1>FICHA CLÍNICA KINÉSICA · MINSAL SIS</h1>
      <p class="cf-sub">Evaluación clínica · Fecha: ${esc(todayISO())}</p>
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
        <span>Tiempo desde el inicio: <b>_____</b> (ej. hace 2 semanas)</span>
        <span>Fase clínica: <b>ACUOSO · SUBAGUDO · CRÓNICO</b></span>
      </div>
      <p class="hint">Fases con ejemplos de tiempo (conceptos estándar de Kinésica Clínica): Acuoso (hasta 72 h tras traumatismo agudo); Subagudo (de ~2 semanas a 6 semanas tras lesión aguda); Crónico (a partir de ~6 semanas o más de 6 semanas tras lesión repetitiva o recaída).</p>
      ${evaTable}
      ${romTables('Rango de movimiento según región (De ° a °)', rows)}
      <h2>Pruebas funcionales</h2>
      <table><thead><tr><th>Prueba</th><th>Resultado / Observación</th><th>Estado</th><th>Notas</th></tr></thead><tbody>${functional}</tbody></table>
      <h2>Fuerza y control</h2>
      <div class="kv"><span>Máximo estimado (P): <b>_____</b></span><span>Máximo SNC: <b>_____</b></span><span>Rango de recuperación: <b>_____</b></span></div>
      <h2>Observaciones del profesional</h2>
      <div class="obs-area"></div>
      <div class="sign">Firma del coach / evaluado: _________________________ · ${esc(id.coachName || 'Coach')} · ${esc(id.coachProfession || '')} · Fecha: ${esc(todayISO())}</div>
      ${printBar()}
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
    <style>
      body{font-family:Arial,Helvetica,sans-serif;color:#222;margin:22px;padding:0}
      .cf-head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #1E2C25;padding-bottom:8px;margin-bottom:14px}
      .cf-brand-name{font-size:20px;font-weight:700;color:#1E2C25}
      .cf-brand-meta{font-size:10px;color:#555}
      .cf-brand-rut{font-size:11px;color:#555;text-align:right}
      h1{font-size:17px;font-weight:700;text-align:center;margin:0 0 6px}
      .cf-sub{font-size:10px;color:#555;text-align:center;margin:0 0 14px}
      h2{font-size:13px;font-weight:700;border-bottom:1px solid #999;padding-bottom:2px;margin:14px 0 6px}
      .kv{display:flex;flex-wrap:wrap;gap:4px 18px;margin:0 0 10px;font-size:11px}
      .kv b{font-weight:700}
      .sign{margin-top:18px;font-size:11px}
      .printbar{margin-top:20px;text-align:right}
      .printbar button{background:#2563EB;color:#fff;border:0;padding:8px 16px;font-weight:700;border-radius:6px;cursor:pointer}
      @media print{.printbar{display:none}}
    </style></head><body>
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
      <p>Se adjunta la ficha clínica Kinésica (MINSAL SIS) con la evaluación de movilidad,Range de articulaciones y observaciones del coach.</p>
      <p>Lmotivo del reembolso: evaluación preventiva de movilidad y recuperación muscular para ${esc(u.name || '')}. ${esc(u.goal ? '(' + u.goal + ')' : '')}</p>
      <div class="sign">Firma del coach / coach responsable: _________________________ · ${esc(id.coachName || 'Coach')} · Fecha: ${esc(today)}</div>
      ${printBar()}
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
