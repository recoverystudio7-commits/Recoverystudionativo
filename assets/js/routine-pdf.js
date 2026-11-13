/* ==========================================================================
   Recovery Studio — Exportar rutina a PDF (ventana de impresión)
   Genera un documento HTML autocontenido, listo para imprimir o
   "Guardar como PDF", con el nombre del profesional, su profesión,
   el nombre del studio/pyme y la pauta completa (ejercicios y
   estiramientos agrupados por musculatura).
   ========================================================================== */
(function () {
  'use strict';

  const RS = (window.RS = window.RS || {});
  const U = RS.util;

  function esc(value) {
    if (U && typeof U.esc === 'function') return U.esc(value);
    return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function coachInfo() {
    if (RS.data && typeof RS.data.coachInfo === 'function') return RS.data.coachInfo();
    return { coachName: 'Daniel Barrueto', coachProfession: 'Kinesiólogo · Magíster', studioName: 'Recovery Studio' };
  }

  function todayLabel() {
    if (U && typeof U.fmtDate === 'function' && typeof U.todayISO === 'function') {
      return U.fmtDate(U.todayISO(), 'long');
    }
    return new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  function build(routine, opts) {
    const o = opts || {};
    const id = coachInfo();
    const title = String((routine && routine.title) || 'Pauta de entrenamiento');
    const objective = String((routine && routine.objective) || '');
    const weeks = Number(routine && routine.weeks) || 4;
    const days = Array.isArray(routine && routine.days) ? routine.days : [];
    const client = String(o.clientName || 'Cliente');

    const daysHtml = days.map((d, di) => {
      const items = (d.items || []).filter((it) => it.name && String(it.name).trim()).map((it, ii) => {
        const params = [it.sets, it.reps, it.load, it.rest]
          .map((v) => (v == null ? '' : String(v).trim()))
          .filter(Boolean);
        const line = params.length ? params.join(' · ') : '';
        const note = String(it.notes || '').trim();
        return '<div class="ex">'
          + '<div class="ex-n">' + String(ii + 1).padStart(2, '0') + '</div>'
          + '<div class="ex-body"><strong>' + esc(it.name) + '</strong>'
          + (line ? '<span class="ex-line">' + esc(line) + '</span>' : '')
          + (note ? '<span class="ex-note">' + esc(note) + '</span>' : '')
          + '</div></div>';
      }).join('');

      const stretches = (d.stretches || []).filter((s) => s.name && String(s.name).trim());
      let stretchesHtml = '';
      if (stretches.length) {
        const byGroup = {};
        stretches.forEach((s) => {
          const g = String(s.muscleGroup || 'General').trim() || 'General';
          (byGroup[g] = byGroup[g] || []).push(s);
        });
        const groupsHtml = Object.keys(byGroup).map((g) => {
          const rows = byGroup[g].map((s) => {
            const meta = [String(s.duration || '').trim(), String(s.notes || '').trim()].filter(Boolean).join(' · ');
            return '<div class="st"><span class="st-name">' + esc(s.name) + '</span>'
              + (meta ? '<span class="st-meta">' + esc(meta) + '</span>' : '')
              + '</div>';
          }).join('');
          return '<div class="st-group"><span class="st-group-tag">' + esc(g) + '</span>' + rows + '</div>';
        }).join('');
        stretchesHtml = '<div class="stretches"><div class="stretches-title">Estiramientos · vuelta a la calma</div>' + groupsHtml + '</div>';
      }

      return '<section class="day">'
        + '<div class="day-head"><span class="day-num">' + String(di + 1).padStart(2, '0') + '</span>'
        + '<div><h3>' + esc(d.name || ('Día ' + (di + 1))) + '</h3>'
        + (d.focus ? '<p>' + esc(d.focus) + '</p>' : '')
        + '</div></div>'
        + '<div class="ex-list">' + items + '</div>'
        + stretchesHtml
        + '</section>';
    }).join('');

    return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
      + '<title>' + esc(title) + ' — ' + esc(client) + '</title>'
      + '<style>'
      + '* { box-sizing: border-box; }'
      + 'body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; margin: 0; padding: 24px; background: #fff; }'
      + '.sheet { max-width: 720px; margin: 0 auto; }'
      + '.head { border-bottom: 3px solid #0A2342; padding-bottom: 14px; margin-bottom: 14px; }'
      + '.brand { display: flex; align-items: center; justify-content: space-between; }'
      + '.brand h1 { font-size: 22px; margin: 0; color: #0A2342; letter-spacing: .5px; }'
      + '.brand .sub { font-size: 12px; color: #64748b; }'
      + '.who { margin-top: 10px; font-size: 13px; color: #475569; }'
      + '.who b { color: #0A2342; }'
      + '.client { background: #f1f5f9; border-radius: 10px; padding: 12px 16px; margin: 14px 0; }'
      + '.client .label { font-size: 11px; text-transform: uppercase; letter-spacing: .6px; color: #64748b; }'
      + '.client .name { font-size: 18px; font-weight: 700; color: #0A2342; }'
      + '.meta { display: flex; flex-wrap: wrap; gap: 8px 18px; font-size: 12px; color: #475569; margin: 6px 0 0; }'
      + '.day { border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; margin: 14px 0; page-break-inside: avoid; }'
      + '.day-head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }'
      + '.day-num { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 8px; background: #123F70; color: #fff; font-weight: 800; font-size: 12px; flex-shrink: 0; }'
      + '.day-head h3 { margin: 0; font-size: 16px; color: #0A2342; }'
      + '.day-head p { margin: 2px 0 0; font-size: 12px; color: #64748b; }'
      + '.ex-list { display: flex; flex-direction: column; gap: 8px; }'
      + '.ex { display: flex; gap: 10px; align-items: flex-start; }'
      + '.ex-n { color: #94a3b8; font-weight: 800; font-size: 12px; padding-top: 2px; flex-shrink: 0; }'
      + '.ex-body { display: flex; flex-direction: column; gap: 1px; }'
      + '.ex-body strong { font-size: 13.5px; }'
      + '.ex-line { font-size: 12px; color: #475569; }'
      + '.ex-note { font-size: 11px; color: #94a3b8; }'
      + '.stretches { margin-top: 12px; border-top: 1px dashed #cbd5e1; padding-top: 10px; }'
      + '.stretches-title { font-size: 12px; font-weight: 700; color: #0A2342; margin-bottom: 8px; }'
      + '.st-group { margin: 6px 0; }'
      + '.st-group-tag { display: inline-block; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; color: #123F70; background: #e0e7ff; border-radius: 5px; padding: 2px 7px; margin-bottom: 3px; }'
      + '.st { display: flex; justify-content: space-between; gap: 12px; font-size: 12px; padding: 2px 0 2px 10px; }'
      + '.st-name { color: #0f172a; }'
      + '.st-meta { color: #64748b; text-align: right; }'
      + '.foot { margin-top: 22px; border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between; gap: 12px; }'
      + '.printbar { display: flex; justify-content: flex-end; margin-bottom: 12px; }'
      + '.printbar button { background: #0A2342; color: #fff; border: 0; border-radius: 8px; padding: 10px 16px; font-size: 13px; font-weight: 700; cursor: pointer; }'
      + '@media print { .printbar { display: none; } body { padding: 0; } }'
      + '</style></head><body>'
      + '<div class="sheet">'
      + '<div class="printbar"><button onclick="window.print()">Imprimir / Guardar como PDF</button></div>'
      + '<header class="head">'
      + '<div class="brand"><h1>' + esc(id.studioName) + '</h1><span class="sub">' + esc(todayLabel()) + '</span></div>'
      + '<div class="who"><span>Profesional: <b>' + esc(id.coachName) + '</b> · ' + esc(id.coachProfession) + '</span></div>'
      + '</header>'
      + '<div class="client"><span class="label">Pauta de entrenamiento para</span><div class="name">' + esc(client) + '</div></div>'
      + '<div class="meta">'
      + '<span><b>Objetivo:</b> ' + (objective ? esc(objective) : '—') + '</span>'
      + '<span><b>Duración:</b> ' + weeks + ' semana(s)</span>'
      + '<span><b>Días:</b> ' + days.length + '</span>'
      + '</div>'
      + daysHtml
      + '<div class="foot"><span>' + esc(id.studioName) + '</span><span>' + esc(id.coachName) + ' · ' + esc(id.coachProfession) + '</span></div>'
      + '</div>'
      + '<script>window.addEventListener("load", function () { setTimeout(function () { window.focus(); window.print(); }, 250); });</script>'
      + '</body></html>';
  }

  function open(routine, opts) {
    const html = build(routine, opts);
    const w = window.open('', '_blank', 'width=880,height=1000');
    if (!w) {
      if (RS.UI && typeof RS.UI.toast === 'function') {
        RS.UI.toast('Permite las ventanas emergentes de este sitio para descargar el PDF.', 'warning', 5000);
      }
      return false;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    return true;
  }

  RS.RoutinePdf = { build, open, coachInfo };
})();
