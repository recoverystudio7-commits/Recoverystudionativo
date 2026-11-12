/* ==========================================================================
   Recovery Studio — Planificación soviética (método Prilepin)
   Cálculo puro: semanas, carga (% 1RM), tonelaje y % de macro/micro ciclo.
   Se alimenta de los maximales (maxes) y la rutina del usuario.
   ========================================================================== */
(function () {
  'use strict';

  const RS = (window.RS = window.RS || {});

  /* Tabla de Prilepin (A.S. Prilepin, halterofilia soviética). */
  const PRILEPIN = [
    { min: 55, max: 65, reps: '3–6', sets: '3–6', total: 24, totalRange: '18–30' },
    { min: 70, max: 80, reps: '3–6', sets: '3–6', total: 18, totalRange: '12–24' },
    { min: 80, max: 90, reps: '2–4', sets: '3–5', total: 15, totalRange: '10–20' },
    { min: 90, max: 100, reps: '1–2', sets: '3–5', total: 7, totalRange: '4–10' },
  ];

  /* Macrociclo: 4 fases soviéticas. */
  const PHASES = [
    { key: 'prep', name: 'Preparación', frac: 0.40, from: 60, to: 70, volume: 'Alto', focus: 'Técnica y acumulación de volumen' },
    { key: 'fuerza', name: 'Fuerza', frac: 0.30, from: 72, to: 82, volume: 'Medio', focus: 'Intensidad creciente' },
    { key: 'peak', name: 'Peak', frac: 0.20, from: 85, to: 95, volume: 'Bajo', focus: 'Pico de fuerza / máxima' },
    { key: 'descarga', name: 'Descarga', frac: 0.10, from: 60, to: 65, volume: 'Bajo', focus: 'Recuperación activa' },
  ];

  function norm(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  function firstNumber(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    const s = String(v == null ? '' : v).trim().replace(',', '.');
    if (!s) return null;
    const m = s.match(/-?\d+(?:\.\d+)?/);
    return m ? Number(m[0]) : null;
  }

  /* "8-12" -> 10 · "3" -> 3 · "3-4" -> 3.5 */
  function midOfRange(v) {
    const s = String(v == null ? '' : v).trim().replace(',', '.');
    const nums = s.match(/\d+(?:\.\d+)?/g);
    if (!nums || !nums.length) return null;
    if (nums.length >= 2) return (Number(nums[0]) + Number(nums[1])) / 2;
    return Number(nums[0]);
  }

  function parseLoad(str) {
    const s = String(str == null ? '' : str).trim();
    if (!s) return null;
    const low = s.toLowerCase();
    let unit = null;
    if (/\blbs?\b/.test(low)) unit = 'lb';
    else if (/\bkgs?\b/.test(low)) unit = 'kg';
    const value = firstNumber(s);
    if (value == null) return null;
    return { value, unit };
  }

  function toKg(value, unit) {
    if (value == null) return null;
    return unit === 'lb' ? value * 0.45359237 : value;
  }

  /* Empareja el nombre de un ejercicio de la rutina con un máximo (texto libre).
     Favorece coincidencias por inclusión y luego por superposición de palabras. */
  function matchMax(itemName, maxes) {
    const n = norm(itemName);
    if (!n) return null;
    let best = null;
    let bestScore = 0;
    maxes.forEach((m) => {
      const mn = norm(m.exercise);
      if (!mn) return;
      let score = 0;
      if (mn === n) {
        score = 100;
      } else if (mn.includes(n)) {
        score = 70 + mn.length;
      } else if (n.includes(mn)) {
        score = 70 + n.length;
      } else {
        const t1 = mn.split(' ').filter(Boolean);
        const t2 = n.split(' ').filter(Boolean);
        const shorter = t1.length <= t2.length ? t1 : t2;
        const longer = t1.length <= t2.length ? t2 : t1;
        if (shorter.length) {
          const shared = shorter.filter((t) => longer.includes(t)).length;
          const ratio = shared / shorter.length;
          if (ratio === 1) score = 45;
          else if (ratio >= 0.5) score = 15;
        }
      }
      if (score > bestScore) { bestScore = score; best = m; }
    });
    return best && bestScore >= 15 ? best : null;
  }

  function zoneFor(pct) {
    if (pct == null) return null;
    return PRILEPIN.find((z) => pct >= z.min && pct <= z.max) || null;
  }

  function macrocycle(weeks) {
    const w = Math.max(1, Math.floor(Number(weeks) || 4));
    const raw = PHASES.map((p) => ({ ...p, weeks: p.frac * w }));
    const assigned = raw.map((p) => Math.floor(p.weeks));
    let remainder = w - assigned.reduce((a, b) => a + b, 0);
    const order = raw.map((p, i) => ({ i, frac: p.weeks - Math.floor(p.weeks) })).sort((a, b) => b.frac - a.frac);
    for (let k = 0; k < remainder; k++) assigned[order[k % order.length].i] += 1;
    let start = 1;
    return raw.map((p, i) => {
      const count = assigned[i];
      const phase = { key: p.key, name: p.name, weeks: count, startWeek: start, endWeek: start + count - 1, from: p.from, to: p.to, volume: p.volume, focus: p.focus };
      start += count;
      return phase;
    }).filter((p) => p.weeks > 0);
  }

  function microcycle(weeks) {
    const phases = macrocycle(weeks);
    const w = Math.max(1, Math.floor(Number(weeks) || 4));
    const out = [];
    for (let week = 1; week <= w; week++) {
      const phase = phases.find((p) => week >= p.startWeek && week <= p.endWeek) || phases[phases.length - 1];
      const span = Math.max(1, phase.endWeek - phase.startWeek + 1);
      const offset = span === 1 ? 0.5 : (week - phase.startWeek) / (span - 1);
      const intensity = Math.round(phase.from + (phase.to - phase.from) * offset);
      const zone = zoneFor(intensity);
      out.push({ week, phase: phase.name, intensity, reps: zone ? zone.reps : '', sets: zone ? zone.sets : '', total: zone ? zone.total : 0, totalRange: zone ? zone.totalRange : '' });
    }
    return { phases, weeks: out };
  }

  function sum(arr) { return arr.reduce((a, b) => a + (Number(b) || 0), 0); }

  function analyze(routine, maxes) {
    const weeks = Math.max(1, Math.floor(Number(routine && routine.weeks) || 4));
    const micro = microcycle(weeks);
    const days = (routine && routine.days || []).map((day) => {
      const items = (day.items || []).map((it) => {
        const matched = matchMax(it.name, maxes);
        const load = parseLoad(it.load);
        let loadPct = null;
        if (matched && load) {
          const maxKg = toKg(Number(matched.current), matched.unit);
          const loadKg = toKg(load.value, load.unit || matched.unit);
          if (maxKg > 0 && loadKg != null) {
            loadPct = Math.round((loadKg / maxKg) * 1000) / 10;
          }
        }
        const sets = midOfRange(it.sets);
        const reps = midOfRange(it.reps);
        const tonnage = (sets != null && reps != null && load) ? Math.round(sets * reps * load.value * 10) / 10 : null;
        return {
          name: it.name,
          source: it,
          matched,
          maxValue: matched ? Number(matched.current) : null,
          maxUnit: matched ? matched.unit : null,
          loadValue: load ? load.value : null,
          loadUnit: load ? load.unit : null,
          loadPct,
          sets,
          reps,
          tonnage,
          zone: zoneFor(loadPct),
        };
      });
      const tonnage = sum(items.map((i) => i.tonnage).filter((t) => t != null));
      const lifts = sum(items.map((i) => (i.sets != null && i.reps != null ? i.sets * i.reps : 0)));
      return { name: day.name || 'Día', items, tonnage, lifts };
    });
    const totalTonnage = sum(days.map((d) => d.tonnage));
    const totalLifts = sum(days.map((d) => d.lifts));
    const totalItems = sum(days.map((d) => d.items.length));
    const matchedCount = sum(days.map((d) => d.items.filter((i) => i.matched).length));
    let wSum = 0;
    let wWeight = 0;
    days.forEach((d) => d.items.forEach((i) => {
      if (i.loadPct != null) { wSum += i.loadPct * (i.tonnage || 0); wWeight += (i.tonnage || 0); }
    }));
    const avgIntensity = wWeight ? Math.round(wSum / wWeight) : null;
    return {
      weeks,
      daysPerWeek: days.length,
      days,
      totalTonnage,
      totalLifts,
      totalItems,
      matchedCount,
      avgIntensity,
      macro: micro.phases,
      micro: micro.weeks,
    };
  }

  function suggestedLoad(matched, intensityPct) {
    if (!matched || matched.current == null) return null;
    const value = Number(matched.current) * (intensityPct / 100);
    const unit = matched.unit;
    const rounded = unit === 'lb' ? Math.round(value) : Math.round(value * 2) / 2;
    return unit === 'lb' ? `${rounded} lb` : String(rounded);
  }

  RS.Soviet = {
    prilepin: PRILEPIN,
    phases: PHASES,
    norm,
    parseLoad,
    matchMax,
    zoneFor,
    macrocycle,
    microcycle,
    analyze,
    suggestedLoad,
  };
})();
