/* =========================================================
   RECOVERY STUDIO · FICHAS DE RUTINA
   Lógica principal de la SPA.

   Estructura:
   1. Estado y persistencia
   2. Utilidades de texto, fechas e imágenes
   3. Render del documento / vista previa
   4. Formulario de ejercicios
   5. Carga de imágenes (archivo o URL)
   6. Acciones, toasts e impresión
   ========================================================= */

(() => {
  "use strict";

  const STORAGE_KEY = "rs.routineSheet.v1";
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
  const MAX_IMAGE_SIDE = 1400;
  const RAW_IMAGE_LIMIT = 850 * 1024;

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  const els = {
    clientName: $("#clientName"),
    goal: $("#goal"),
    routineDate: $("#routineDate"),
    coachNotes: $("#coachNotes"),
    exerciseForm: $("#exerciseForm"),
    exerciseFormCard: $("#exerciseFormCard"),
    exerciseFormTitle: $("#exerciseFormTitle"),
    formModeBadge: $("#formModeBadge"),
    exerciseName: $("#exerciseName"),
    exerciseNameError: $("#exerciseNameError"),
    series: $("#series"),
    reps: $("#reps"),
    rest: $("#rest"),
    exerciseComments: $("#exerciseComments"),
    submitExerciseBtn: $("#submitExerciseBtn"),
    submitExerciseLabel: $("#submitExerciseLabel"),
    cancelEditBtn: $("#cancelEditBtn"),
    resetBtn: $("#resetBtn"),
    exportBtn: $("#exportBtn"),
    saveStatus: $("#saveStatus"),
    previewClient: $("#previewClient"),
    previewGoal: $("#previewGoal"),
    previewDate: $("#previewDate"),
    previewCount: $("#previewCount"),
    previewSets: $("#previewSets"),
    previewNotes: $("#previewNotes"),
    sheetDateTop: $("#sheetDateTop"),
    toolbarCount: $("#toolbarCount"),
    previewExercises: $("#previewExercises"),
    routineSheet: $("#routineSheet"),
    toastRoot: $("#toastRoot")
  };

  const state = {
    clientName: "",
    goal: "",
    date: todayISO(),
    notes: "",
    exercises: []
  };

  const draftImages = { start: "", end: "" };
  const mediaControls = {};
  let editingId = null;
  let saveTimer = null;
  let quotaWarningShown = false;

  /* =========================================================
     1. ESTADO Y PERSISTENCIA
     ========================================================= */

  function todayISO() {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function createId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `exercise-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function normalizeText(value, maxLength = 4000) {
    return typeof value === "string" ? value.slice(0, maxLength) : "";
  }

  function normalizeExercise(exercise) {
    return {
      id: typeof exercise?.id === "string" && exercise.id ? exercise.id : createId(),
      name: normalizeText(exercise?.name, 200),
      startImage: safeImageSource(exercise?.startImage),
      endImage: safeImageSource(exercise?.endImage),
      series: normalizeText(exercise?.series, 40),
      reps: normalizeText(exercise?.reps, 40),
      rest: normalizeText(exercise?.rest, 40),
      comments: normalizeText(exercise?.comments, 2000)
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const stored = JSON.parse(raw);
      if (!stored || typeof stored !== "object") return;

      state.clientName = normalizeText(stored.clientName, 160);
      state.goal = normalizeText(stored.goal, 160);
      state.date = /^\d{4}-\d{2}-\d{2}$/.test(stored.date) ? stored.date : todayISO();
      state.notes = normalizeText(stored.notes, 3000);
      state.exercises = Array.isArray(stored.exercises)
        ? stored.exercises.map(normalizeExercise).filter((exercise) => exercise.name)
        : [];
    } catch (error) {
      console.warn("No se pudo cargar la ficha guardada.", error);
    }
  }

  function setSaveStatus(status, label) {
    els.saveStatus.classList.toggle("is-saving", status === "saving");
    els.saveStatus.classList.toggle("is-error", status === "error");
    const text = $(".save-label", els.saveStatus);
    if (text) text.textContent = label;
  }

  function scheduleSave() {
    setSaveStatus("saving", "Guardando…");
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(saveNow, 450);
  }

  function saveNow() {
    window.clearTimeout(saveTimer);
    saveTimer = null;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setSaveStatus("saved", "Guardado local");
      quotaWarningShown = false;
    } catch (error) {
      console.warn("No se pudo guardar en localStorage.", error);
      setSaveStatus("error", "Sin guardar");
      if (!quotaWarningShown) {
        quotaWarningShown = true;
        showToast(
          "La ficha no cabe en el almacenamiento local. Usa URLs para las imágenes o elimina alguna.",
          "error"
        );
      }
    }
  }

  /* =========================================================
     2. UTILIDADES
     ========================================================= */

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => {
      const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      };
      return entities[character];
    });
  }

  /**
   * Solo aceptamos imágenes locales (data URL) o enlaces web.
   * Así evitamos que un valor inesperado termine inyectado en un src.
   */
  function safeImageSource(value) {
    if (typeof value !== "string") return "";
    const source = value.trim();
    if (!source) return "";

    if (/^data:image\/(?:png|jpe?g|gif|webp|avif|svg\+xml);base64,/i.test(source)) {
      return source;
    }

    try {
      const url = new URL(source);
      return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
    } catch {
      return "";
    }
  }

  function isWebImage(value) {
    return /^https?:\/\//i.test(value || "");
  }

  function formatDate(isoDate) {
    if (!isoDate) return "—";
    const parts = isoDate.split("-").map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return isoDate;

    try {
      const date = new Date(parts[0], parts[1] - 1, parts[2]);
      const formatted = new Intl.DateTimeFormat("es-CL", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      })
        .format(date)
        .replace(/\./g, "");

      return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    } catch {
      return isoDate;
    }
  }

  function icon(name, className = "icon") {
    return `<svg class="${className}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  }

  function formatBytes(bytes) {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function pluralize(count, singular, plural) {
    return `${count} ${count === 1 ? singular : plural}`;
  }

  function totalSets() {
    return state.exercises.reduce((total, exercise) => {
      const matches = String(exercise.series).match(/\d+/g);
      return total + (matches ? Number(matches[0]) : 0);
    }, 0);
  }

  /* =========================================================
     3. RENDER
     ========================================================= */

  function renderSheetHeader() {
    const client = state.clientName.trim();
    const goal = state.goal.trim();
    const notes = state.notes.trim();
    const count = state.exercises.length;
    const sets = totalSets();
    const formattedDate = formatDate(state.date);

    els.previewClient.textContent = client || "Nombre del cliente";
    els.previewGoal.textContent = goal || "Objetivo de la rutina";
    els.previewDate.textContent = formattedDate;
    els.sheetDateTop.textContent = formattedDate;
    els.previewCount.textContent = String(count);
    els.previewSets.textContent = sets > 0 ? String(sets) : "—";
    els.previewNotes.textContent = notes || "Sin indicaciones adicionales.";
    els.toolbarCount.textContent = pluralize(count, "ejercicio", "ejercicios");
  }

  function movementFigure(exercise, side) {
    const source = side === "start" ? exercise.startImage : exercise.endImage;
    const label = side === "start" ? "Inicio" : "Final";
    const alt = `${exercise.name || "Ejercicio"} — postura ${label.toLowerCase()}`;

    const image = source
      ? `<img src="${escapeHTML(source)}" alt="${escapeHTML(alt)}" loading="eager">`
      : `<div class="movement-placeholder">${icon("image")}<span>Sin imagen</span></div>`;

    return `
      <figure class="movement-frame">
        ${image}
        <span class="frame-chip${side === "end" ? " is-end" : ""}">${label}</span>
      </figure>
    `;
  }

  function exerciseTemplate(exercise, index) {
    const name = exercise.name || "Ejercicio sin nombre";
    const number = String(index + 1).padStart(2, "0");
    const series = exercise.series.trim() || "—";
    const reps = exercise.reps.trim() || "—";
    const rest = exercise.rest.trim() || "—";
    const comments = exercise.comments.trim();

    return `
      <article class="routine-exercise" data-id="${escapeHTML(exercise.id)}">
        <header class="exercise-head">
          <div class="exercise-title-wrap">
            <span class="exercise-index">${number}</span>
            <h4 class="exercise-title" title="${escapeHTML(name)}">${escapeHTML(name)}</h4>
          </div>
          <div class="exercise-actions screen-only">
            <button type="button" class="icon-btn" data-action="up" title="Mover arriba" aria-label="Mover ${escapeHTML(name)} arriba" ${index === 0 ? "disabled" : ""}>
              ${icon("arrow-up")}
            </button>
            <button type="button" class="icon-btn" data-action="down" title="Mover abajo" aria-label="Mover ${escapeHTML(name)} abajo" ${index === state.exercises.length - 1 ? "disabled" : ""}>
              ${icon("arrow-down")}
            </button>
            <button type="button" class="icon-btn" data-action="edit" title="Editar ejercicio" aria-label="Editar ${escapeHTML(name)}">
              ${icon("edit")}
            </button>
            <button type="button" class="icon-btn is-danger" data-action="delete" title="Eliminar ejercicio" aria-label="Eliminar ${escapeHTML(name)}">
              ${icon("trash")}
            </button>
          </div>
        </header>

        <div class="exercise-media-grid">
          ${movementFigure(exercise, "start")}
          <span class="movement-divider" aria-hidden="true">${icon("arrow-right")}</span>
          ${movementFigure(exercise, "end")}
        </div>

        <div class="exercise-params">
          <div class="exercise-param">
            <span>Series</span>
            <strong>${escapeHTML(series)}</strong>
          </div>
          <div class="exercise-param">
            <span>Reps. / tiempo</span>
            <strong>${escapeHTML(reps)}</strong>
          </div>
          <div class="exercise-param">
            <span>Descanso</span>
            <strong>${escapeHTML(rest)}</strong>
          </div>
        </div>

        ${comments ? `
          <p class="exercise-comment">
            ${icon("notes")}
            <span>${escapeHTML(comments)}</span>
          </p>
        ` : ""}
      </article>
    `;
  }

  function emptyStateTemplate() {
    return `
      <div class="sheet-empty">
        <span class="sheet-empty-icon">${icon("dumbbell", "icon icon-lg")}</span>
        <h4>Tu rutina aparecerá aquí</h4>
        <p>Agrega el primer ejercicio con sus imágenes de inicio y final para comenzar a construir la ficha.</p>
        <button type="button" class="btn screen-only" data-empty-add>
          ${icon("plus", "icon icon-sm")}
          Agregar primer ejercicio
        </button>
      </div>
    `;
  }

  function attachImageFallbacks() {
    $$("img", els.previewExercises).forEach((image) => {
      image.addEventListener(
        "error",
        () => {
          const figure = image.closest(".movement-frame");
          if (!figure) return;
          image.remove();
          if (!figure.querySelector(".movement-placeholder")) {
            const placeholder = document.createElement("div");
            placeholder.className = "movement-placeholder";
            placeholder.innerHTML = `${icon("image")}<span>Imagen no disponible</span>`;
            figure.prepend(placeholder);
          }
        },
        { once: true }
      );
    });
  }

  function renderExercises() {
    if (!state.exercises.length) {
      els.previewExercises.innerHTML = emptyStateTemplate();
      return;
    }

    els.previewExercises.innerHTML = state.exercises
      .map((exercise, index) => exerciseTemplate(exercise, index))
      .join("");

    attachImageFallbacks();
  }

  function renderAll() {
    renderSheetHeader();
    renderExercises();
  }

  /* =========================================================
     4. FORMULARIO
     ========================================================= */

  function setFormMode() {
    const isEditing = Boolean(editingId);

    els.formModeBadge.classList.toggle("hidden", !isEditing);
    els.cancelEditBtn.classList.toggle("hidden", !isEditing);
    els.exerciseFormTitle.textContent = isEditing ? "Editar ejercicio" : "Agregar ejercicio";
    els.submitExerciseLabel.textContent = isEditing
      ? "Guardar cambios"
      : "Agregar ejercicio a la rutina";

    const use = $("use", els.submitExerciseBtn);
    if (use) use.setAttribute("href", isEditing ? "#i-check" : "#i-plus");
  }

  function clearExerciseError() {
    els.exerciseName.classList.remove("is-invalid");
    els.exerciseNameError.classList.add("hidden");
  }

  function clearMedia(slot) {
    draftImages[slot] = "";
    const control = mediaControls[slot];
    if (!control) return;

    control.file.value = "";
    control.url.value = "";
    control.url.classList.remove("is-invalid");
    control.show("", "Sin imagen");
  }

  function resetExerciseForm() {
    editingId = null;
    els.exerciseForm.reset();
    clearExerciseError();

    clearMedia("start");
    clearMedia("end");

    setFormMode();
  }

  function fillFormForEdit(exercise) {
    editingId = exercise.id;

    els.exerciseName.value = exercise.name;
    els.series.value = exercise.series;
    els.reps.value = exercise.reps;
    els.rest.value = exercise.rest;
    els.exerciseComments.value = exercise.comments;
    clearExerciseError();

    ["start", "end"].forEach((slot) => {
      const source = slot === "start" ? exercise.startImage : exercise.endImage;
      const control = mediaControls[slot];
      if (!control) return;

      control.file.value = "";
      control.url.value = isWebImage(source) ? source : "";
      control.url.classList.remove("is-invalid");

      draftImages[slot] = source;
      control.show(
        source,
        source
          ? isWebImage(source)
            ? "Enlace externo"
            : "Imagen cargada"
          : "Sin imagen"
      );
    });

    setFormMode();
    els.exerciseFormCard.scrollIntoView({ behavior: "smooth", block: "start" });

    window.setTimeout(() => {
      els.exerciseName.focus({ preventScroll: true });
    }, 420);
  }

  function handleExerciseSubmit(event) {
    event.preventDefault();

    const name = els.exerciseName.value.trim();
    if (!name) {
      els.exerciseName.classList.add("is-invalid");
      els.exerciseNameError.classList.remove("hidden");
      els.exerciseName.focus();
      return;
    }

    const exercise = normalizeExercise({
      id: editingId || createId(),
      name,
      startImage: draftImages.start,
      endImage: draftImages.end,
      series: els.series.value.trim(),
      reps: els.reps.value.trim(),
      rest: els.rest.value.trim(),
      comments: els.exerciseComments.value.trim()
    });

    if (editingId) {
      const index = state.exercises.findIndex((item) => item.id === editingId);
      if (index !== -1) state.exercises[index] = exercise;
      showToast("Cambios guardados.");
    } else {
      state.exercises.push(exercise);
      showToast("Ejercicio agregado a la rutina.");
    }

    resetExerciseForm();
    renderAll();
    saveNow();
  }

  function handleExerciseActions(event) {
    const emptyButton = event.target.closest("[data-empty-add]");
    if (emptyButton) {
      els.exerciseFormCard.scrollIntoView({ behavior: "smooth", block: "start" });
      window.setTimeout(() => els.exerciseName.focus({ preventScroll: true }), 350);
      return;
    }

    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const card = button.closest(".routine-exercise");
    const id = card?.dataset.id;
    if (!id) return;

    const index = state.exercises.findIndex((exercise) => exercise.id === id);
    if (index === -1) return;

    if (button.dataset.action === "edit") {
      fillFormForEdit(state.exercises[index]);
      return;
    }

    if (button.dataset.action === "delete") {
      deleteExercise(index);
      return;
    }

    if (button.dataset.action === "up" && index > 0) {
      moveExercise(index, index - 1);
      return;
    }

    if (button.dataset.action === "down" && index < state.exercises.length - 1) {
      moveExercise(index, index + 1);
    }
  }

  function moveExercise(from, to) {
    const [exercise] = state.exercises.splice(from, 1);
    state.exercises.splice(to, 0, exercise);
    renderExercises();
    saveNow();
  }

  function deleteExercise(index) {
    const [removed] = state.exercises.splice(index, 1);
    if (!removed) return;

    if (editingId === removed.id) resetExerciseForm();

    renderAll();
    saveNow();

    showToast("Ejercicio eliminado.", "success", {
      label: "Deshacer",
      onClick: () => {
        state.exercises.splice(Math.min(index, state.exercises.length), 0, removed);
        renderAll();
        saveNow();
        showToast("Ejercicio restaurado.");
      }
    });
  }

  /* =========================================================
     5. IMÁGENES
     ========================================================= */

  function readAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
      reader.readAsDataURL(file);
    });
  }

  function loadImage(source) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("No se pudo procesar la imagen."));
      image.src = source;
    });
  }

  /**
   * Los GIF se guardan tal cual para conservar la animación.
   * Las imágenes raster grandes se reducen y convierten a WebP para
   * que quepan en localStorage y la ficha siga siendo liviana.
   */
  async function optimizeImage(file) {
    const original = await readAsDataURL(file);
    const preserveOriginal =
      file.type === "image/gif" ||
      file.type === "image/svg+xml" ||
      file.type === "image/avif";

    if (preserveOriginal) return original;

    try {
      const image = await loadImage(original);
      const largestSide = Math.max(image.naturalWidth, image.naturalHeight);
      const needsResize = largestSide > MAX_IMAGE_SIDE;
      const needsCompression = file.size > RAW_IMAGE_LIMIT;

      if (!needsResize && !needsCompression) return original;

      const scale = Math.min(1, MAX_IMAGE_SIDE / largestSide);
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d");
      if (!context) return original;

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(image, 0, 0, width, height);

      const optimized = canvas.toDataURL("image/webp", 0.84);
      return optimized.startsWith("data:image/") ? optimized : original;
    } catch (error) {
      console.warn("Se usará la imagen original.", error);
      return original;
    }
  }

  async function handleFileUpload(slot, file) {
    if (!file) return;

    const control = mediaControls[slot];
    if (!control) return;

    const isImage =
      file.type.startsWith("image/") ||
      /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(file.name);

    if (!isImage) {
      showToast("Selecciona un archivo de imagen válido.", "error");
      control.file.value = "";
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      showToast("La imagen supera los 10 MB. Usa una versión más liviana o una URL.", "error");
      control.file.value = "";
      return;
    }

    control.dropzone.classList.add("is-loading");

    try {
      const source = await optimizeImage(file);
      if (!source) throw new Error("Imagen vacía.");

      control.url.value = "";
      control.url.classList.remove("is-invalid");
      draftImages[slot] = source;
      control.show(source, `${file.name} · ${formatBytes(file.size)}`);
    } catch (error) {
      console.warn(error);
      showToast("No se pudo cargar la imagen. Intenta con otro archivo.", "error");
    } finally {
      control.dropzone.classList.remove("is-loading");
      control.file.value = "";
    }
  }

  /**
   * Inicializa los dos selectores de imagen (inicio y final).
   * La imagen se guarda como data URL si viene de un archivo, o como
   * URL si el profesional pega un enlace externo.
   */
  function initMediaControls() {
    $$(".media-control").forEach((container) => {
      const slot = container.dataset.media;
      const dropzone = $("[data-dropzone]", container);
      const preview = $("[data-preview]", container);
      const placeholder = $("[data-placeholder]", container);
      const clearButton = $("[data-clear]", container);
      const fileInput = $("[data-file]", container);
      const urlInput = $("[data-url]", container);
      const status = $("[data-status]", container);

      const control = {
        container,
        dropzone,
        preview,
        placeholder,
        clearButton,
        file: fileInput,
        url: urlInput,
        status,
        show(source, label = "Sin imagen") {
          const hasImage = Boolean(source);

          preview.classList.toggle("hidden", !hasImage);
          placeholder.classList.toggle("hidden", hasImage);
          clearButton.classList.toggle("hidden", !hasImage);

          if (hasImage) {
            if (preview.getAttribute("src") !== source) preview.setAttribute("src", source);

            preview.onerror = () => {
              preview.classList.add("hidden");
              placeholder.classList.remove("hidden");
              status.textContent = "No se pudo cargar la imagen";
            };
          } else {
            preview.removeAttribute("src");
            preview.onerror = null;
          }

          status.textContent = label;
        }
      };

      mediaControls[slot] = control;

      dropzone.addEventListener("click", () => fileInput.click());

      dropzone.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          fileInput.click();
        }
      });

      clearButton.addEventListener("click", (event) => {
        event.stopPropagation();
        clearMedia(slot);
      });

      fileInput.addEventListener("change", () => {
        handleFileUpload(slot, fileInput.files?.[0]);
      });

      dropzone.addEventListener("dragenter", (event) => {
        event.preventDefault();
        dropzone.classList.add("is-dragging");
      });

      dropzone.addEventListener("dragover", (event) => {
        event.preventDefault();
        dropzone.classList.add("is-dragging");
      });

      dropzone.addEventListener("dragleave", () => {
        dropzone.classList.remove("is-dragging");
      });

      dropzone.addEventListener("drop", (event) => {
        event.preventDefault();
        dropzone.classList.remove("is-dragging");
        handleFileUpload(slot, event.dataTransfer?.files?.[0]);
      });

      const applyUrl = () => {
        const value = urlInput.value.trim();

        if (!value) {
          clearMedia(slot);
          return;
        }

        const source = safeImageSource(value);
        if (!source) {
          urlInput.classList.add("is-invalid");
          status.textContent = "Enlace no válido";
          showToast("Usa una URL http(s) o un archivo de imagen.", "error");
          return;
        }

        urlInput.classList.remove("is-invalid");
        fileInput.value = "";
        draftImages[slot] = source;
        control.show(source, "Enlace externo");
      };

      urlInput.addEventListener("change", applyUrl);
      urlInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          applyUrl();
          urlInput.blur();
        }
      });

      urlInput.addEventListener("input", () => {
        if (!urlInput.value.trim() && draftImages[slot]) clearMedia(slot);
        urlInput.classList.remove("is-invalid");
      });
    });
  }

  /* =========================================================
     6. ACCIONES, TOASTS E IMPRESIÓN
     ========================================================= */

  function showToast(message, type = "success", action = null) {
    const toast = document.createElement("div");
    toast.className = `toast${type === "error" ? " is-error" : ""}`;
    toast.setAttribute("role", type === "error" ? "alert" : "status");

    const iconWrapper = document.createElement("span");
    iconWrapper.className = "toast-icon";
    iconWrapper.innerHTML = icon(type === "error" ? "x" : "check");

    const text = document.createElement("span");
    text.className = "toast-message";
    text.textContent = message;

    toast.append(iconWrapper, text);

    if (action) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "toast-action";
      button.textContent = action.label;
      button.addEventListener("click", () => {
        action.onClick();
        dismissToast(toast);
      });
      toast.append(button);
    }

    els.toastRoot.append(toast);

    while (els.toastRoot.children.length > 3) {
      els.toastRoot.firstElementChild.remove();
    }

    const timer = window.setTimeout(() => dismissToast(toast), action ? 6500 : 4200);
    toast.addEventListener("mouseenter", () => window.clearTimeout(timer), { once: true });
    toast.addEventListener("mouseleave", () => {
      window.setTimeout(() => dismissToast(toast), 2200);
    });
  }

  function dismissToast(toast) {
    if (!toast.isConnected || toast.classList.contains("is-leaving")) return;
    toast.classList.add("is-leaving");
    window.setTimeout(() => toast.remove(), 190);
  }

  function waitForImages() {
    const images = $$("img", els.routineSheet);
    if (!images.length) return Promise.resolve();

    return Promise.all(
      images.map(
        (image) =>
          new Promise((resolve) => {
            if (image.complete) {
              resolve();
              return;
            }

            const finish = () => resolve();
            image.addEventListener("load", finish, { once: true });
            image.addEventListener("error", finish, { once: true });
            window.setTimeout(finish, 3000);
          })
      )
    );
  }

  async function exportSheet() {
    const buttons = [...new Set([els.exportBtn, ...$$("[data-export]")])];
    buttons.forEach((button) => {
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
    });

    try {
      renderAll();
      await waitForImages();

      const previousTitle = document.title;
      const client = state.clientName.trim() || "Cliente";
      const date = state.date || todayISO();
      document.title = `Rutina - ${client} - ${date}`;

      const restore = () => {
        document.title = previousTitle;
        buttons.forEach((button) => {
          button.disabled = false;
          button.removeAttribute("aria-busy");
        });
        window.removeEventListener("afterprint", restore);
      };

      window.addEventListener("afterprint", restore, { once: true });
      window.print();
      window.setTimeout(restore, 1500);
    } catch (error) {
      console.error(error);
      showToast("No se pudo preparar la impresión. Intenta nuevamente.", "error");
      buttons.forEach((button) => {
        button.disabled = false;
        button.removeAttribute("aria-busy");
      });
    }
  }

  function resetSheet() {
    const hasContent =
      state.exercises.length > 0 ||
      state.clientName.trim() ||
      state.goal.trim() ||
      state.notes.trim();

    if (
      hasContent &&
      !window.confirm(
        "¿Crear una ficha nueva? Se quitarán los datos y ejercicios actuales de este dispositivo."
      )
    ) {
      return;
    }

    state.clientName = "";
    state.goal = "";
    state.date = todayISO();
    state.notes = "";
    state.exercises = [];

    editingId = null;
    els.exerciseForm.reset();
    clearExerciseError();
    populateHeaderFields();
    resetExerciseForm();
    renderAll();
    saveNow();
    showToast("Ficha nueva lista para editar.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function populateHeaderFields() {
    els.clientName.value = state.clientName;
    els.goal.value = state.goal;
    els.routineDate.value = state.date || todayISO();
    els.coachNotes.value = state.notes;
  }

  function handleHeaderInput() {
    state.clientName = els.clientName.value;
    state.goal = els.goal.value;
    state.date = els.routineDate.value || "";
    state.notes = els.coachNotes.value;

    renderSheetHeader();
    scheduleSave();
  }

  function bindEvents() {
    [els.clientName, els.goal, els.routineDate, els.coachNotes].forEach((input) => {
      input.addEventListener("input", handleHeaderInput);
      input.addEventListener("change", handleHeaderInput);
    });

    els.exerciseForm.addEventListener("submit", handleExerciseSubmit);
    els.cancelEditBtn.addEventListener("click", resetExerciseForm);
    els.exerciseName.addEventListener("input", clearExerciseError);
    els.previewExercises.addEventListener("click", handleExerciseActions);
    els.resetBtn.addEventListener("click", resetSheet);

    [els.exportBtn, ...$$("[data-export]")].forEach((button) => {
      button.addEventListener("click", exportSheet);
    });

    window.addEventListener("pagehide", () => {
      if (saveTimer) saveNow();
    });
  }

  function init() {
    loadState();
    populateHeaderFields();
    initMediaControls();
    setFormMode();
    bindEvents();
    renderAll();
    setSaveStatus("saved", "Guardado local");

    // Si localStorage está bloqueado, avisamos sin interrumpir la experiencia.
    try {
      const testKey = "__rs_test__";
      localStorage.setItem(testKey, "1");
      localStorage.removeItem(testKey);
    } catch {
      setSaveStatus("error", "Sin guardar");
      showToast("El navegador bloqueó el almacenamiento local. La ficha funcionará, pero no se guardará.", "error");
    }
  }

  init();
})();
