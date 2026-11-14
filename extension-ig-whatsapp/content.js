(() => {
  if (window.__RS_EXT_LOADED__) return;
  window.__RS_EXT_LOADED__ = true;

  const TEMPLATES = [
    {
      cmd: "/bienvenida",
      label: "👋 Bienvenida",
      cat: "WhatsApp / IG",
      text: "Hola 👋 bienvenido/a a Recovery Studio. Soy Daniel. Te ayudo a agendar tu sesión de recuperación o entrenamiento. ¿Qué te interesa: Recovery, Entrenamiento 1:1, Evaluación + pauta o Plan mensual? Puedes pagar por MercadoPago aquí: https://link.mercadopago.cl/recoverystudiogorbea"
    },
    {
      cmd: "/precios",
      label: "💰 Precios",
      cat: "WhatsApp / IG",
      text: "Sesión Recovery $35.000 (primera vez $25.000 con evaluación incluida) · Entrenamiento 1:1 $30.000 · Evaluación + pauta $40.000 · Plan Recovery 8 $220.000 · Plan Performance 12 $300.000 · Asesoría online $18.000."
    },
    {
      cmd: "/horarios",
      label: "🕒 Horarios",
      cat: "WhatsApp / IG",
      text: "Lun–Vie 17:30–22:30 · Sáb 15:00–19:30. Domingo cerrado."
    },
    {
      cmd: "/ubicacion",
      label: "📍 Ubicación",
      cat: "WhatsApp / IG",
      text: "Pasaje uno, Gorbea, Región de la Araucanía. Mapa: https://maps.google.com/?q=Pasaje+uno,+Gorbea"
    },
    {
      cmd: "/primera",
      label: "🔥 Primera sesión $25k",
      cat: "WhatsApp / IG",
      text: "Primera sesión Recovery: evaluación funcional + masoterapia + movilidad por $25.000 (normal $35.000). ¿Te acomoda Lun–Vie 17:30–22:30 o Sáb 15:00–19:30?"
    },
    {
      cmd: "/planes",
      label: "📋 Planes mensuales",
      cat: "WhatsApp / IG",
      text: "Plan Recovery 8: 8 sesiones en 30 días + seguimiento + prioridad de agenda ($220.000). Plan Performance 12: 12 sesiones combinadas + rutina actualizada + control de maximales + asesoría WhatsApp ($300.000)."
    },
    {
      cmd: "/pagos",
      label: "💳 Medios de pago",
      cat: "WhatsApp / IG",
      text: "Puedes pagar por MercadoPago (link: https://link.mercadopago.cl/recoverystudiogorbea) o por transferencia. Te envío comprobante por WhatsApp."
    },
    {
      cmd: "/mp",
      label: "🔗 Link MercadoPago",
      cat: "WhatsApp / IG",
      text: "Paga aquí con MercadoPago: https://link.mercadopago.cl/recoverystudiogorbea"
    },
    {
      cmd: "/resena",
      label: "⭐ Pedir reseña Google",
      cat: "Seguimiento",
      text: "Gracias por venir a Recovery Studio 🙌 Si te gustó la experiencia, nos ayuda muchísimo una reseña en Google (1 min): https://g.page/r/CZxVsgDhqJElEBM/review Como agradecimiento, tu próxima sesión tiene 10% de descuento."
    },
    {
      cmd: "/recovery",
      label: "📄 IG Keyword RECOVERY",
      cat: "Instagram DM",
      text: "Te envío la guía 📄 https://www.recoverystudio.cl/ ¿Para qué la quieres usar: post-entrenamiento, dolor muscular o rendimiento?"
    },
    {
      cmd: "/agendar",
      label: "📲 IG Derivar a WhatsApp",
      cat: "Instagram DM",
      text: "Genial 🙌 Escríbeme por WhatsApp y te confirmo hora: https://wa.me/56965058439?text=Hola,%20quiero%20agendar"
    },
    {
      cmd: "/24h",
      label: "⏳ Seguimiento 24h",
      cat: "Seguimiento",
      text: "Hola, vi que te interesó la guía de recuperación. ¿Te gustaría probar una sesión esta semana? Sin compromiso, la primera incluye evaluación ($25.000)."
    },
    {
      cmd: "/recordatorio24",
      label: "🔔 Recordatorio 24h antes",
      cat: "Seguimiento",
      text: "Recordatorio: tu sesión Recovery es mañana en Pasaje uno, Gorbea. Si necesitas reagendar avísame con 12 h de anticipación. ¡Te esperamos!"
    },
    {
      cmd: "/recordatorio2",
      label: "💪 Recordatorio 2h antes",
      cat: "Seguimiento",
      text: "Nos vemos en 2 horas 💪 Pasaje uno, Gorbea. Trae ropa cómoda. ¡Hasta pronto!"
    },
    {
      cmd: "/noshow",
      label: "📅 Reagendar No-show",
      cat: "Seguimiento",
      text: "Hola, noté que no pudiste asistir. Reagendamos sin costo para esta semana. La recuperación constante es la que da resultados."
    },
    {
      cmd: "/inactivo",
      label: "🎁 Cliente inactivo (VUELVE15)",
      cat: "Seguimiento",
      text: "Hola, hace un tiempo no te vemos en Recovery Studio. Vuelve con 15% de descuento en tu próxima sesión (código VUELVE15). ¿Agendamos esta semana?"
    },
    {
      cmd: "/referido",
      label: "🤝 Promo Referido $20k",
      cat: "Referidos / B2B",
      text: "Trae a un amigo/a a su primera sesión Recovery y ambos reciben la sesión a $20.000 (normal $35.000). Solo menciona tu nombre al agendar."
    },
    {
      cmd: "/empresa",
      label: "🏢 Programa Empresa B2B",
      cat: "Referidos / B2B",
      text: "Hola, en Recovery Studio ofrecemos programa mensual de bienestar, recuperación y prevención de lesiones para equipos: sesiones + charlas + reporte de participación. ¿Agendamos una reunión de 20 min para contarte?"
    }
  ];

  const byCmd = Object.fromEntries(TEMPLATES.map(t => [t.cmd, t.text]));
  let lastEditor = null;

  document.addEventListener("focusin", (e) => {
    const el = e.target;
    if (el && (el.isContentEditable || el.tagName === "TEXTAREA" || el.tagName === "INPUT")) {
      lastEditor = el;
    }
  }, true);

  function showToast(msg) {
    let t = document.getElementById("rs-ext-toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "rs-ext-toast";
      t.style.cssText = "position:fixed;bottom:76px;right:18px;z-index:2147483647;background:#0A2342;color:#fff;padding:8px 14px;border-radius:8px;font:600 12px/1.4 system-ui,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.3);border-left:4px solid #FF7A18;transition:opacity .2s;";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = "1";
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.style.opacity = "0"; }, 2200);
  }

  // shortcut: Lexical/Draft editors in WA & IG require execCommand('insertText') to update internal state; falls back to clipboard if blocked
  function insertIntoEditor(text, replaceChars = 0) {
    const target = (document.activeElement && (document.activeElement.isContentEditable || document.activeElement.tagName === "TEXTAREA"))
      ? document.activeElement
      : lastEditor;

    navigator.clipboard?.writeText(text).catch(() => {});

    if (!target) {
      showToast("📋 Copiado al portapapeles (pega con Ctrl+V)");
      return;
    }

    target.focus();
    if (target.tagName === "TEXTAREA" || target.tagName === "INPUT") {
      const start = Math.max(0, (target.selectionStart || 0) - replaceChars);
      const end = target.selectionEnd || 0;
      target.setRangeText(text, start, end, "end");
      target.dispatchEvent(new Event("input", { bubbles: true }));
      showToast("⚡ Plantilla insertada");
      return;
    }

    const sel = window.getSelection();
    if (replaceChars > 0 && sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (range.startContainer.nodeType === Node.TEXT_NODE && range.startOffset >= replaceChars) {
        range.setStart(range.startContainer, range.startOffset - replaceChars);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }

    const ok = document.execCommand("insertText", false, text);
    if (ok) {
      showToast("⚡ Plantilla insertada");
    } else {
      showToast("📋 Copiado (presiona Ctrl+V para pegar)");
    }
  }

  // Expand slash commands when pressing Space or Tab after e.g. /precios
  document.addEventListener("keydown", (e) => {
    if (e.key !== " " && e.key !== "Tab") return;
    const el = e.target;
    if (!el || (!el.isContentEditable && el.tagName !== "TEXTAREA")) return;

    let before = "";
    if (el.tagName === "TEXTAREA") {
      before = el.value.slice(0, el.selectionStart || 0);
    } else {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && sel.getRangeAt(0).startContainer.nodeType === Node.TEXT_NODE) {
        before = sel.getRangeAt(0).startContainer.textContent.slice(0, sel.getRangeAt(0).startOffset);
      }
    }

    const match = before.match(/(?:^|\s)(\/[a-z0-9]+)$/i);
    if (!match) return;
    const cmd = match[1].toLowerCase();
    if (!byCmd[cmd]) return;

    e.preventDefault();
    e.stopPropagation();
    insertIntoEditor(byCmd[cmd], cmd.length);
  }, true);

  // Floating button + quick panel
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;bottom:18px;right:18px;z-index:2147483646;font-family:system-ui,-apple-system,sans-serif;";
  const shadow = host.attachShadow({ mode: "open" });

  shadow.innerHTML = `
    <style>
      .btn {
        background: #0A2342;
        color: #fff;
        border: 2px solid #FF7A18;
        border-radius: 999px;
        padding: 8px 14px;
        font: 700 13px/1 system-ui, sans-serif;
        cursor: pointer;
        box-shadow: 0 4px 14px rgba(0,0,0,.28);
      }
      .btn:hover { background: #123F70; }
      .panel {
        display: none;
        position: absolute;
        bottom: 46px;
        right: 0;
        width: 310px;
        max-height: 420px;
        overflow-y: auto;
        background: #0A2342;
        color: #fff;
        border-radius: 12px;
        padding: 10px;
        box-shadow: 0 10px 30px rgba(0,0,0,.4);
        border: 1px solid rgba(255,255,255,.15);
      }
      .panel.open { display: block; }
      .hdr {
        font-size: 12px;
        font-weight: 700;
        color: #FF7A18;
        margin-bottom: 6px;
        display: flex;
        justify-content: space-between;
      }
      .search {
        width: 100%;
        box-sizing: border-box;
        padding: 6px 8px;
        border-radius: 6px;
        border: 1px solid rgba(255,255,255,.2);
        background: #123F70;
        color: #fff;
        font-size: 12px;
        margin-bottom: 8px;
      }
      .search::placeholder { color: rgba(255,255,255,.6); }
      .item {
        display: block;
        width: 100%;
        text-align: left;
        background: rgba(255,255,255,.06);
        border: 1px solid rgba(255,255,255,.08);
        color: #fff;
        padding: 7px 9px;
        margin-bottom: 5px;
        border-radius: 7px;
        cursor: pointer;
        font-size: 12px;
      }
      .item:hover { background: rgba(255,122,24,.22); border-color: #FF7A18; }
      .cmd { color: #FF7A18; font-weight: 700; font-family: monospace; margin-left: 4px; }
      .preview { display: block; color: rgba(255,255,255,.7); font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
    </style>
    <div class="panel" id="panel">
      <div class="hdr">
        <span>Recovery Studio · Respuestas</span>
        <span style="opacity:.7;font-weight:400">Espacio tras /cmd</span>
      </div>
      <input class="search" id="q" placeholder="Buscar (/precios, bienvenida, 24h...)" />
      <div id="list"></div>
    </div>
    <button class="btn" id="toggle" title="Plantillas Recovery Studio">RS ⚡</button>
  `;

  document.body.appendChild(host);

  const panel = shadow.getElementById("panel");
  const list = shadow.getElementById("list");
  const q = shadow.getElementById("q");
  const toggle = shadow.getElementById("toggle");

  function render(filter = "") {
    const f = filter.trim().toLowerCase();
    list.innerHTML = "";
    TEMPLATES.filter(t => !f || t.cmd.includes(f) || t.label.toLowerCase().includes(f) || t.text.toLowerCase().includes(f))
      .forEach(t => {
        const b = document.createElement("button");
        b.className = "item";
        b.innerHTML = `<strong>${t.label}</strong> <span class="cmd">${t.cmd}</span><span class="preview">${t.text}</span>`;
        b.addEventListener("mousedown", (e) => {
          e.preventDefault(); // keep focus on chat input
          insertIntoEditor(t.text, 0);
          panel.classList.remove("open");
        });
        list.appendChild(b);
      });
  }

  toggle.addEventListener("mousedown", (e) => {
    e.preventDefault();
    panel.classList.toggle("open");
    if (panel.classList.contains("open")) render(q.value);
  });

  q.addEventListener("input", () => render(q.value));
  render();
})();
