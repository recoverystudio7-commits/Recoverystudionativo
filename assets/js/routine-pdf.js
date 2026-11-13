/* ==========================================================================
   Recovery Studio — Exportar rutina a PDF (ventana de impresión)
   Genera un documento HTML autocontenido, listo para imprimir o
   "Guardar como PDF", con el nombre del profesional, su profesión,
   el nombre del studio/pyme y la pauta completa (ejercicios con
   imágenes inicio/final y estiramientos agrupados por musculatura).
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
    return { coachName: 'Daniel Barrueto Jopia', coachProfession: 'Kinesiólogo · Magíster', studioName: 'Recovery Studio' };
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

    const imgTag = (src, alt) => `<img src="${esc(src)}" alt="${esc(alt)}" onerror="this.parentNode.style.display='none'">`;

    const daysHtml = days.map((d, di) => {
      const items = (d.items || [])
        .filter((it) => it.name && String(it.name).trim())
        .map((it, ii) => {
          const sets = String(it.sets || '').trim();
          const reps = String(it.reps || '').trim();
          const load = String(it.load || '').trim();
          const rest = String(it.rest || '').trim();
          const params = [];
          if (sets || reps) params.push([sets, reps].filter(Boolean).join(' × '));
          if (load) params.push(load);
          if (rest) params.push(rest);
          const line = params.join(' · ');

          const desc = String(it.description || '').trim();
          const cues = String(it.cues || '').trim();
          const note = String(it.notes || '').trim();
          const tags = [String(it.muscleGroup || '').trim(), String(it.equipment || '').trim()].filter(Boolean);

          const imgStart = String(it.imageStart || it.imageUrl || it.gifUrl || '').trim();
          let imgEnd = String(it.imageEnd || '').trim();
          if (!imgEnd && imgStart && /\/0\.(jpg|jpeg|png|webp)$/i.test(imgStart)) {
            imgEnd = imgStart.replace(/\/0\.(jpg|jpeg|png|webp)$/i, '/1.$1');
          }

          return `<div class="ex">
            <div class="ex-head">
              <span class="ex-n">${String(ii + 1).padStart(2, '0')}</span>
              <div class="ex-title">
                <strong>${esc(it.name)}</strong>
                ${tags.length ? `<span class="ex-tags">${tags.map((t) => `<span>${esc(t)}</span>`).join('')}</span>` : ''}
              </div>
              ${line ? `<span class="ex-params">${esc(line)}</span>` : ''}
            </div>
            ${(imgStart || imgEnd) ? `<div class="ex-imgs">
              ${imgStart ? `<figure>${imgTag(imgStart, it.name + ' — inicio')}<figcaption>Inicio</figcaption></figure>` : ''}
              ${imgEnd ? `<figure>${imgTag(imgEnd, it.name + ' — final')}<figcaption>Final</figcaption></figure>` : ''}
            </div>` : ''}
            <div class="ex-info">
              ${desc ? `<p class="ex-desc">${esc(desc)}</p>` : ''}
              ${cues ? `<p class="ex-cues"><b>Indicaciones:</b> ${esc(cues)}</p>` : ''}
              ${note ? `<p class="ex-note">${esc(note)}</p>` : ''}
            </div>
          </div>`;
        })
        .join('');

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
            const duration = String(s.duration || '').trim();
            const note = String(s.notes || '').trim();
            const desc = String(s.description || '').trim();
            const cues = String(s.cues || '').trim();
            const imgStart = String(s.imageStart || s.imageUrl || '').trim();
            let imgEnd = String(s.imageEnd || '').trim();
            if (!imgEnd && imgStart && /\/0\.(jpg|jpeg|png|webp)$/i.test(imgStart)) {
              imgEnd = imgStart.replace(/\/0\.(jpg|jpeg|png|webp)$/i, '/1.$1');
            }
            return `<div class="st">
              <div class="st-body">
                <div class="st-head"><span class="st-name">${esc(s.name)}</span>${duration ? `<span class="st-meta">${esc(duration)}</span>` : ''}</div>
                ${desc ? `<p class="st-desc">${esc(desc)}</p>` : ''}
                ${cues ? `<p class="st-cues"><b>Indicaciones:</b> ${esc(cues)}</p>` : ''}
                ${note ? `<p class="st-note">${esc(note)}</p>` : ''}
              </div>
              ${(imgStart || imgEnd) ? `<div class="st-imgs">${imgStart ? `<img src="${esc(imgStart)}" alt="${esc(s.name)} — inicio" onerror="this.style.display='none'">` : ''}${imgEnd ? `<img src="${esc(imgEnd)}" alt="${esc(s.name)} — final" onerror="this.style.display='none'">` : ''}</div>` : ''}
            </div>`;
          }).join('');
          return `<div class="st-group"><span class="st-group-tag">${esc(g)}</span>${rows}</div>`;
        }).join('');
        stretchesHtml = `<div class="stretches"><div class="stretches-title">Estiramientos · vuelta a la calma</div>${groupsHtml}</div>`;
      }

      return `<section class="day">
        <div class="day-head">
          <span class="day-num">${String(di + 1).padStart(2, '0')}</span>
          <div class="day-title">
            <h3>${esc(d.name || ('Día ' + (di + 1)))}</h3>
            ${d.focus ? `<p>${esc(d.focus)}</p>` : ''}
          </div>
        </div>
        <div class="ex-list">${items}</div>
        ${stretchesHtml}
      </section>`;
    }).join('');

    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — ${esc(client)}</title>
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; margin: 0; padding: 0; background: #fff; }
  .sheet { max-width: 760px; margin: 0 auto; }

  .cover { background: #0A2342; color: #fff; border-radius: 0 0 18px 18px; padding: 26px 28px; display: flex; align-items: center; gap: 16px; }
  .cover-logo { width: 52px; height: 52px; border-radius: 12px; background: #F59E0B; color: #0A2342; font-weight: 900; font-size: 22px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .cover-text { flex: 1; min-width: 0; }
  .cover-text h1 { margin: 0; font-size: 22px; letter-spacing: .3px; }
  .cover-text p { margin: 3px 0 0; font-size: 12.5px; color: #cbd5e1; }
  .cover-date { font-size: 11.5px; color: #cbd5e1; text-align: right; white-space: nowrap; }

  .client { margin: 20px 24px 4px; border: 1px solid #e2e8f0; border-left: 4px solid #F59E0B; border-radius: 12px; padding: 16px 18px; }
  .client-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; font-weight: 700; }
  .client-name { font-size: 21px; font-weight: 800; color: #0A2342; margin-top: 2px; }
  .client-meta { display: flex; flex-wrap: wrap; gap: 8px 20px; margin-top: 10px; font-size: 12.5px; color: #475569; }
  .client-meta b { color: #0A2342; }

  .day { border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px 18px; margin: 16px 24px; page-break-inside: avoid; }
  .day-head { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #eef2f7; }
  .day-num { width: 34px; height: 34px; border-radius: 10px; background: #123F70; color: #fff; font-weight: 800; font-size: 13px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .day-title h3 { margin: 0; font-size: 17px; color: #0A2342; }
  .day-title p { margin: 2px 0 0; font-size: 12px; color: #64748b; }

  .ex-list { display: flex; flex-direction: column; gap: 12px; }
  .ex { border: 1px solid #eef2f7; border-radius: 12px; padding: 12px 14px; page-break-inside: avoid; background: #fbfcfe; }
  .ex-head { display: flex; align-items: flex-start; gap: 10px; }
  .ex-n { width: 26px; height: 26px; border-radius: 8px; background: #F59E0B; color: #0A2342; font-weight: 800; font-size: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .ex-title { flex: 1; min-width: 0; }
  .ex-title strong { font-size: 14.5px; color: #0f172a; }
  .ex-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
  .ex-tags span { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .3px; color: #123F70; background: #e0e7ff; border-radius: 4px; padding: 2px 6px; }
  .ex-params { font-size: 12.5px; font-weight: 700; color: #B45309; background: #fef3c7; border-radius: 7px; padding: 4px 9px; white-space: nowrap; }
  .ex-imgs { display: flex; gap: 12px; flex-wrap: wrap; margin: 12px 0 2px; }
  .ex-imgs figure { margin: 0; flex: 1 1 170px; max-width: 220px; }
  .ex-imgs img { width: 100%; height: 150px; object-fit: cover; border-radius: 10px; border: 1px solid #e2e8f0; background: #eef2f7; display: block; }
  .ex-imgs figcaption { font-size: 10px; color: #94a3b8; text-align: center; margin-top: 4px; text-transform: uppercase; letter-spacing: .5px; font-weight: 700; }
  .ex-info { margin-top: 8px; }
  .ex-info p { margin: 4px 0; font-size: 12px; color: #475569; line-height: 1.5; }
  .ex-info .ex-desc { color: #334155; }
  .ex-info .ex-cues { color: #64748b; }
  .ex-info .ex-note { color: #94a3b8; font-size: 11px; font-style: italic; }

  .stretches { margin-top: 14px; border-top: 2px dashed #e2e8f0; padding-top: 10px; }
  .stretches-title { font-size: 12.5px; font-weight: 800; color: #0A2342; margin-bottom: 8px; }
  .st-group { margin: 6px 0; }
  .st-group-tag { display: inline-block; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; color: #123F70; background: #e0e7ff; border-radius: 5px; padding: 2px 7px; margin-bottom: 3px; }
  .st { display: flex; justify-content: space-between; gap: 12px; padding: 9px 0; border-bottom: 1px solid #f1f5f9; }
  .st:last-child { border-bottom: 0; }
  .st-body { flex: 1; min-width: 0; }
  .st-head { display: flex; justify-content: space-between; gap: 10px; }
  .st-name { color: #0f172a; font-weight: 700; font-size: 12.5px; }
  .st-meta { color: #B45309; font-weight: 700; font-size: 12px; white-space: nowrap; }
  .st-desc, .st-cues { margin: 3px 0 0; font-size: 11.5px; color: #475569; line-height: 1.45; }
  .st-cues { color: #64748b; }
  .st-note { margin: 3px 0 0; font-size: 11px; color: #94a3b8; font-style: italic; }
  .st-imgs { display: flex; gap: 6px; flex-shrink: 0; align-self: center; }
  .st-imgs img { width: 64px; height: 64px; object-fit: cover; border-radius: 8px; border: 1px solid #e2e8f0; background: #eef2f7; }

  .foot { margin: 18px 24px 24px; border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between; gap: 12px; }
  .printbar { display: flex; justify-content: flex-end; margin: 16px 24px 0; }
  .printbar button { background: #F59E0B; color: #0A2342; border: 0; border-radius: 9px; padding: 11px 18px; font-size: 13px; font-weight: 800; cursor: pointer; }

  @media print { .printbar { display: none; } body { padding: 0; } }
</style></head><body>
<div class="sheet">
  <div class="printbar"><button onclick="window.print()">Imprimir / Guardar como PDF</button></div>
  <header class="cover">
    <div class="cover-logo">RS</div>
    <div class="cover-text">
      <h1>${esc(id.studioName)}</h1>
      <p>${esc(id.coachName)} · ${esc(id.coachProfession)}</p>
    </div>
    <div class="cover-date">${esc(todayLabel())}</div>
  </header>
  <div class="client">
    <span class="client-label">Pauta de entrenamiento para</span>
    <div class="client-name">${esc(client)}</div>
    <div class="client-meta">
      <span><b>Objetivo:</b> ${objective ? esc(objective) : '—'}</span>
      <span><b>Duración:</b> ${weeks} semana(s)</span>
      <span><b>Días:</b> ${days.length}</span>
    </div>
  </div>
  ${daysHtml}
  <div class="foot"><span>${esc(id.studioName)}</span><span>${esc(id.coachName)} · ${esc(id.coachProfession)}</span></div>
</div>
<script>
window.addEventListener("load", function () {
  var imgs = Array.prototype.slice.call(document.querySelectorAll("img"));
  var printed = false;
  function remaining() { return imgs.filter(function (i) { return !i.complete; }).length; }
  function printNow() { if (printed) return; printed = true; window.focus(); window.print(); }
  function maybe() { if (remaining() === 0) printNow(); }
  if (remaining() === 0) { setTimeout(printNow, 150); return; }
  imgs.forEach(function (i) { i.addEventListener("load", maybe); i.addEventListener("error", maybe); });
  setTimeout(printNow, 4000);
});
</script>
</body></html>`;
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
