const TEMPLATES = [
  ["/bienvenida", "👋 Bienvenida", "Hola 👋 bienvenido/a a Recovery Studio. Soy Daniel. Te ayudo a agendar tu sesión de recuperación o entrenamiento. ¿Qué te interesa: Recovery, Entrenamiento 1:1, Evaluación + pauta o Plan mensual? Puedes pagar por MercadoPago aquí: https://link.mercadopago.cl/recoverystudiogorbea"],
  ["/precios", "💰 Precios", "Sesión Recovery $35.000 (primera vez $25.000 con evaluación incluida) · Entrenamiento 1:1 $30.000 · Evaluación + pauta $40.000 · Plan Recovery 8 $220.000 · Plan Performance 12 $300.000 · Asesoría online $18.000."],
  ["/horarios", "🕒 Horarios", "Lun–Vie 17:30–22:30 · Sáb 15:00–19:30. Domingo cerrado."],
  ["/ubicacion", "📍 Ubicación", "Pasaje uno, Gorbea, Región de la Araucanía. Mapa: https://maps.google.com/?q=Pasaje+uno,+Gorbea"],
  ["/primera", "🔥 Primera sesión $25k", "Primera sesión Recovery: evaluación funcional + masoterapia + movilidad por $25.000 (normal $35.000). ¿Te acomoda Lun–Vie 17:30–22:30 o Sáb 15:00–19:30?"],
  ["/planes", "📋 Planes mensuales", "Plan Recovery 8: 8 sesiones en 30 días + seguimiento + prioridad de agenda ($220.000). Plan Performance 12: 12 sesiones combinadas + rutina actualizada + control de maximales + asesoría WhatsApp ($300.000)."],
  ["/pagos", "💳 Medios de pago", "Puedes pagar por MercadoPago (link: https://link.mercadopago.cl/recoverystudiogorbea) o por transferencia. Te envío comprobante por WhatsApp."],
  ["/mp", "🔗 Link MercadoPago", "Paga aquí con MercadoPago: https://link.mercadopago.cl/recoverystudiogorbea"],
  ["/resena", "⭐ Reseña Google", "Gracias por venir a Recovery Studio 🙌 Si te gustó la experiencia, nos ayuda muchísimo una reseña en Google (1 min): https://g.page/r/CZxVsgDhqJElEBM/review Como agradecimiento, tu próxima sesión tiene 10% de descuento."],
  ["/recovery", "📄 IG Keyword RECOVERY", "Te envío la guía 📄 https://www.recoverystudio.cl/ ¿Para qué la quieres usar: post-entrenamiento, dolor muscular o rendimiento?"],
  ["/agendar", "📲 IG Derivar a WhatsApp", "Genial 🙌 Escríbeme por WhatsApp y te confirmo hora: https://wa.me/56965058439?text=Hola,%20quiero%20agendar"],
  ["/24h", "⏳ Seguimiento 24h", "Hola, vi que te interesó la guía de recuperación. ¿Te gustaría probar una sesión esta semana? Sin compromiso, la primera incluye evaluación ($25.000)."],
  ["/recordatorio24", "🔔 Recordatorio 24h", "Recordatorio: tu sesión Recovery es mañana en Pasaje uno, Gorbea. Si necesitas reagendar avísame con 12 h de anticipación. ¡Te esperamos!"],
  ["/recordatorio2", "💪 Recordatorio 2h", "Nos vemos en 2 horas 💪 Pasaje uno, Gorbea. Trae ropa cómoda. ¡Hasta pronto!"],
  ["/noshow", "📅 Reagendar No-show", "Hola, noté que no pudiste asistir. Reagendamos sin costo para esta semana. La recuperación constante es la que da resultados."],
  ["/inactivo", "🎁 Cliente inactivo", "Hola, hace un tiempo no te vemos en Recovery Studio. Vuelve con 15% de descuento en tu próxima sesión (código VUELVE15). ¿Agendamos esta semana?"],
  ["/referido", "🤝 Promo Referido", "Trae a un amigo/a a su primera sesión Recovery y ambos reciben la sesión a $20.000 (normal $35.000). Solo menciona tu nombre al agendar."],
  ["/empresa", "🏢 Programa Empresa", "Hola, en Recovery Studio ofrecemos programa mensual de bienestar, recuperación y prevención de lesiones para equipos: sesiones + charlas + reporte de participación. ¿Agendamos una reunión de 20 min para contarte?"]
];

const list = document.getElementById("list");
const q = document.getElementById("q");
const status = document.getElementById("status");

function render(filter = "") {
  const f = filter.trim().toLowerCase();
  list.innerHTML = "";
  TEMPLATES.filter(([cmd, label, txt]) => !f || cmd.includes(f) || label.toLowerCase().includes(f) || txt.toLowerCase().includes(f))
    .forEach(([cmd, label, txt]) => {
      const btn = document.createElement("button");
      btn.className = "item";
      btn.innerHTML = `<strong>${label}</strong> <span class="cmd">${cmd}</span><span class="txt">${txt}</span>`;
      btn.onclick = async () => {
        await navigator.clipboard.writeText(txt);
        status.textContent = `✓ Copiado: ${cmd}`;
        setTimeout(() => { status.textContent = ""; }, 1800);
      };
      list.appendChild(btn);
    });
}

q.oninput = () => render(q.value);
render();
