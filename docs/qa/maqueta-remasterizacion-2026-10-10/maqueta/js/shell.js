/* Motor de la maqueta: dibuja el chrome canónico (header, dock, command bar,
   rail de pestañas y cabecera de pestaña) a partir de window.MAQUETA, para que
   cada página solo aporte su contenido. Reusa las clases REALES del frontend
   (theme.css, chrome.css, ContextTabRail.css) y los íconos lucide reales. */
(function () {
  const MODULOS = {
    // Mismos glifos que `lib/icons.ts` (IconStudyDesign, IconSample, IconEditor,
    // IconRoutes, IconMonitor, IconProcessing, IconDashboard, IconCollector).
    "diseno-estudio": { label: "Bitácora", tone: "workplan", icon: "clipboard-list" },
    "calc-muestra": { label: "Cálculo de muestra", tone: "sample", icon: "calculator" },
    "editor-xlsform": { label: "Formularios", tone: "editor", icon: "file-pen" },
    "hojas-ruta": { label: "Hojas de ruta", tone: "routes", icon: "map" },
    "monitoreo": { label: "Monitoreo", tone: "monitoring", icon: "activity" },
    "procesamiento": { label: "Procesamiento", tone: "processing", icon: "workflow" },
    "dashboard": { label: "Dashboard", tone: "dashboard", icon: "layout-dashboard" },
    "recopiladores": { label: "Recopiladores", tone: "collectors", icon: "qr-code" },
  };
  const ORDEN = ["diseno-estudio", "calc-muestra", "editor-xlsform", "hojas-ruta", "monitoreo", "procesamiento", "dashboard", "recopiladores"];

  function toneVars(slug) {
    const t = MODULOS[slug].tone;
    return `--module-accent: var(--pulso-module-${t}); --module-accent-soft: var(--pulso-module-${t}-soft); --module-accent-border: var(--pulso-module-${t}-border); --pulso-primary: var(--module-accent); --pulso-primary-soft: var(--module-accent-soft); --pulso-primary-border: var(--module-accent-border);`;
  }

  function brand() {
    return `<a class="pulso-brand-link" href="../index.html" title="Volver al índice de la maqueta">
      <svg class="pulso-brand-mark" width="28" height="28" viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="15.4" fill="#002457"/>
        <rect x="12" y="30" width="7" height="18" rx="3.5" fill="#fff"/>
        <rect x="23" y="22" width="7" height="26" rx="3.5" fill="#fff"/>
        <rect x="34" y="28" width="7" height="20" rx="3.5" fill="#fff"/>
        <rect x="45" y="16" width="7" height="32" rx="3.5" fill="#fff"/>
      </svg>
      <span class="pulso-brand-wordmark">Prosecnur</span></a>`;
  }

  function dock(activo, visibles) {
    const items = (visibles || ORDEN).map((slug) => {
      const m = MODULOS[slug];
      const cur = slug === activo;
      // v3: dock icon-only con el label VISIBLE del módulo activo y burbuja por
      // hover y foco en los demás (hoy: `title` nativo, que no sale con teclado).
      return `<li class="pulso-module-dock-item"><a href="#" class="pulso-module-tile mq-tile${cur ? " is-current" : ""}" ${cur ? 'aria-current="page"' : ""} aria-label="${m.label}" data-mq-tip="${m.label}" style="${toneVars(slug)}">
        <span class="pulso-module-tile-icon">${icon(m.icon, 16)}</span>${cur ? `<span class="mq-tile-label">${m.label}</span>` : ""}</a></li>`;
    }).join("");
    return `<nav class="pulso-module-switcher" aria-label="Cambiar módulo"><ul class="pulso-module-dock">${items}
      <li class="pulso-module-dock-item"><a href="#" class="pulso-module-tile pulso-module-tile-add" aria-label="Agregar módulo" title="Agregar módulo"><span class="pulso-module-tile-icon">${icon("plus", 16)}</span><span class="pulso-module-tile-label">Agregar</span></a></li></ul></nav>`;
  }

  function header(cfg) {
    const p = cfg.proyecto || { nombre: "acnur_acg", estado: "guardado", fecha: "24/7/2026" };
    const estado = p.estado === "sucio"
      ? `<span class="mq-save-pill is-dirty">● sin guardar</span>`
      : `<span class="mq-save-pill">${icon("circle-check", 12)} ${p.fecha}</span>`;
    return `<header class="pulso-app-header">
      <div class="pulso-nav-cluster" aria-label="Navegación principal">${brand()}${dock(cfg.modulo, cfg.dock)}</div>
      <div class="pulso-app-header-spacer"></div>
      <div class="pulso-app-header-actions">
        <div class="pulso-project-indicator"><button type="button" class="mq-project-chip">${icon("folder", 14)}<strong>${p.nombre}</strong>${estado}</button></div>
        <a class="mq-home-btn" href="../index.html" aria-label="Inicio">${icon("house", 15)}</a>
      </div></header>`;
  }

  function pillbar(cfg) {
    if (!cfg.secciones || !cfg.secciones.length) return "";
    const items = cfg.secciones.map((s) => {
      const id = typeof s === "string" ? s : s.id;
      const label = typeof s === "string" ? s : s.label;
      const activa = id === cfg.seccionActiva;
      const done = typeof s === "object" && s.done;
      const badge = typeof s === "object" && s.badge ? `<span class="mq-pill-badge">${s.badge}</span>` : "";
      return `<li class="pulso-phase-pill-item"><a href="#" class="pulso-phase-pill${activa ? " is-active" : ""}${done ? " is-done" : ""}" data-nav-item data-nav-shape="pill" ${activa ? 'data-nav-state="selected" aria-current="page"' : ""}>
        <span class="pulso-phase-pill-circle" aria-hidden="true"></span>
        <span class="pulso-phase-pill-stack"><span class="pulso-phase-pill-label"><span class="pulso-phase-pill-text">${label}</span>${badge}</span></span></a></li>`;
    }).join("");
    return `<nav class="pulso-phase-rail pulso-section-pillbar" data-modulo="${cfg.modulo}" data-progreso="none" aria-label="Secciones"><div class="pulso-phase-pillbar"><ol class="pulso-phase-pill-list">${items}</ol></div></nav>`;
  }

  function accion(a) {
    const kind = a.kind || "secondary";
    return `<button type="button" class="pulso-button pulso-button--${kind} pulso-button--sm"${a.disabled ? " disabled" : ""}>${a.icon ? icon(a.icon, 15) : ""}${a.label}</button>`;
  }

  function commandBar(cfg) {
    const chips = (cfg.chips || []).map((c) => `<button type="button" class="pulso-chrome-status-chip" data-tone="${c.tone || "neutral"}" title="${c.detail || ""}">${c.label}</button>`).join("");
    const acciones = (cfg.acciones || []).map(accion).join("");
    const menu = cfg.menu ? `<button type="button" class="pulso-button pulso-button--icon pulso-button--sm" aria-label="Más acciones">${icon("ellipsis", 16)}</button>` : "";
    return `<div class="pulso-command-bar pulso-module-command-bar" data-modulo="${cfg.modulo}" data-chrome-rows="1" data-chrome-material="${cfg.material || "glass"}" data-chrome-densidad="normal" role="toolbar" aria-label="Chrome de ${MODULOS[cfg.modulo].label}">
      <div class="pulso-command-bar-zone" data-zone="contexto">${cfg.contexto || ""}</div>
      <div class="pulso-command-bar-zone" data-zone="secciones">${pillbar(cfg)}</div>
      <div class="pulso-command-bar-zone" data-zone="acciones">${cfg.herramientas || ""}${chips}${acciones}${menu}</div></div>`;
  }

  function rail(cfg) {
    if (!cfg.pestanas || !cfg.pestanas.length) return "";
    const items = cfg.pestanas.map((t) => {
      const sel = t.id === cfg.pestanaActiva;
      return `<button type="button" role="tab" aria-selected="${sel}" class="pulso-context-tab-item" data-nav-item data-nav-shape="row" ${sel ? 'data-nav-state="selected"' : ""} data-rail-tooltip="${t.label}" title="${t.label}${t.detail ? " · " + t.detail : ""}">${icon(t.icon || "circle-dot", 18, "pulso-context-tab-icon")}</button>`;
    }).join("");
    const footer = cfg.railFooter ? `<div class="pulso-context-tab-rail-footer">${cfg.railFooter}</div>` : "";
    return `<aside class="pulso-context-tab-rail mq-rail" aria-label="Pestañas"><div class="pulso-context-tab-list" role="tablist">${items}</div>${footer}</aside>`;
  }

  /* Cabecera de pestaña única (propuesta L14): ícono en tile + eyebrow de la
     sección + nombre de la pestaña como título + detalle; chips de contexto a
     la derecha; opcionalmente el control que manda sobre toda la sección. */
  function tabHeading(cfg) {
    const h = cfg.cabecera; if (!h) return "";
    const chips = (h.chips || []).map((c) => `<span class="mq-th-chip${c.tone ? " is-" + c.tone : ""}">${c.label || c}</span>`).join("");
    const estado = h.estado ? `<em class="mq-th-estado" data-estado="${h.estado.kind || "listo"}">${h.estado.label || h.estado}</em>` : "";
    return `<header class="mq-tab-heading"${h.compacta ? ' data-compacta=""' : ""}>
      <span class="mq-th-icon" aria-hidden="true">${icon(h.icon || (cfg.pestanas && cfg.pestanas.find((t) => t.id === cfg.pestanaActiva) || {}).icon || "circle-dot", 17)}</span>
      <div class="mq-th-copy"><span class="pulso-section-eyebrow">${h.eyebrow || ""}</span><h2>${h.titulo}${estado}</h2>${h.detalle ? `<p>${h.detalle}</p>` : ""}</div>
      ${h.control ? `<div class="mq-th-control">${h.control}</div>` : ""}
      ${chips ? `<div class="mq-th-chips">${chips}</div>` : ""}</header>`;
  }

  function maquetaBar(cfg) {
    const hoy = cfg.hoy ? `<button type="button" class="mq-bar-btn" data-mq-hoy="${cfg.hoy}">${icon("eye", 14)} Ver hoy</button><button type="button" class="mq-bar-btn" data-mq-comparar="${cfg.hoy}">${icon("contrast", 14)} Comparar</button>` : "";
    return `<div class="mq-bar" role="region" aria-label="Maqueta">
      <a class="mq-bar-btn" href="../index.html">${icon("arrow-left", 14)} Índice</a>
      <span class="mq-bar-title"><strong>${cfg.codigo || ""}</strong> ${cfg.titulo || ""}</span>
      ${hoy}<span class="mq-bar-hint">${cfg.nota || ""}</span></div>
      <div class="mq-hoy-overlay" hidden><div class="mq-hoy-frame"><div class="mq-hoy-head"><strong>Hoy</strong> · captura real del censo (1440×1000) <button type="button" class="mq-bar-btn" data-mq-cerrar>${icon("x", 14)} Cerrar</button></div><img alt="Captura real de hoy" loading="lazy"></div></div>`;
  }

  function montar() {
    const cfg = window.MAQUETA || {};
    const contenido = document.getElementById("contenido");
    if (!contenido) return;
    const body = document.body;
    body.classList.add("mq-body");
    const shell = document.createElement("div");
    shell.className = "pulso-shell";
    shell.style.cssText = toneVars(cfg.modulo || "procesamiento");
    const main = `<main class="pulso-main pulso-main--processing" data-route-policy="viewport"><div class="pulso-main-inner"><div class="pulso-route-surface">
      <section class="pulso-page-frame pulso-page-frame--layout-workbench pulso-page-frame--scroll-panels mq-frame"${cfg.sinRail ? ' data-sin-rail=""' : ""}>
        <div class="mq-workbench">${rail(cfg)}<div class="mq-main">${tabHeading(cfg)}<div class="mq-content" id="mq-content"></div></div></div>
      </section></div></div></main>`;
    shell.innerHTML = header(cfg) + (cfg.sinCommandBar ? "" : commandBar(cfg)) + main + maquetaBar(cfg);
    body.insertBefore(shell, body.firstChild);
    shell.querySelector("#mq-content").appendChild(contenido);
    // overlay "hoy"
    const btn = shell.querySelector("[data-mq-hoy]");
    const ov = shell.querySelector(".mq-hoy-overlay");
    if (btn && ov) {
      btn.addEventListener("click", () => { ov.querySelector("img").src = btn.dataset.mqHoy; ov.hidden = false; });
      ov.querySelector("[data-mq-cerrar]").addEventListener("click", () => { ov.hidden = true; });
      ov.addEventListener("click", (e) => { if (e.target === ov) ov.hidden = true; });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape") ov.hidden = true; });
    }
    // modo comparar: la captura de hoy encima, con deslizador de opacidad
    const cmp = shell.querySelector("[data-mq-comparar]");
    if (cmp) {
      cmp.addEventListener("click", () => {
        let box = document.querySelector(".mq-compare");
        if (box) { box.remove(); return; }
        box = document.createElement("div"); box.className = "mq-compare";
        box.innerHTML = `<img src="${cmp.dataset.mqComparar}" alt=""><div class="mq-compare-ctl"><span>Hoy</span><input type="range" min="0" max="100" value="50" aria-label="Opacidad de la captura de hoy"><span>Después</span><button type="button" class="mq-bar-btn" data-mq-cerrar-cmp>${icon("x", 14)}</button></div>`;
        document.body.appendChild(box);
        const img = box.querySelector("img"); const range = box.querySelector("input");
        const apply = () => { img.style.opacity = String(1 - range.value / 100); };
        range.addEventListener("input", apply); apply();
        box.querySelector("[data-mq-cerrar-cmp]").addEventListener("click", () => box.remove());
      });
    }
    // burbuja del dock por hover y foco (v3: no `title` nativo)
    shell.querySelectorAll("[data-mq-tip]").forEach((a) => {
      const show = () => { const r = a.getBoundingClientRect(); const t = document.createElement("div"); t.className = "pulso-context-tab-tooltip mq-dock-tip"; t.setAttribute("data-side", "right"); t.style.top = (r.bottom + 10) + "px"; t.style.left = (r.left + r.width / 2) + "px"; t.innerHTML = `<strong>${a.dataset.mqTip}</strong>`; document.body.appendChild(t); a._tip = t; };
      const hide = () => { if (a._tip) { a._tip.remove(); a._tip = null; } };
      a.addEventListener("mouseenter", show); a.addEventListener("focus", show);
      a.addEventListener("mouseleave", hide); a.addEventListener("blur", hide);
    });
    // tooltips del rail (burbuja real)
    shell.querySelectorAll(".pulso-context-tab-item").forEach((b) => {
      b.addEventListener("mouseenter", () => {
        const r = b.getBoundingClientRect();
        let t = document.createElement("div"); t.className = "pulso-context-tab-tooltip"; t.setAttribute("data-side", "right");
        t.style.top = (r.top + r.height / 2) + "px"; t.style.left = (r.right + 8) + "px";
        const [l, d] = (b.getAttribute("title") || "").split(" · ");
        t.innerHTML = `<strong>${l}</strong>${d ? `<span>${d}</span>` : ""}`;
        document.body.appendChild(t); b._tip = t;
      });
      b.addEventListener("mouseleave", () => { if (b._tip) { b._tip.remove(); b._tip = null; } });
    });
    // <i data-icon="nombre" data-size="16"></i> → svg lucide real
    document.querySelectorAll("[data-icon]").forEach((el) => {
      const span = document.createElement("span");
      span.className = "mq-i " + (el.className || "");
      span.innerHTML = icon(el.dataset.icon, Number(el.dataset.size || 16));
      el.replaceWith(span);
    });
    if (typeof window.onMaquetaMontada === "function") window.onMaquetaMontada();
  }
  document.addEventListener("DOMContentLoaded", montar);
  window.MQ = { MODULOS, icon: (n, s, c) => icon(n, s, c), toneVars };
})();
