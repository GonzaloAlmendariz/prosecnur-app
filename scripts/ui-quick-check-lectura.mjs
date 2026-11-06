// Detectores de lectura de ui-quick-check (2026-10-27).
//
// Gonzalo abrió el RMS ficticio y vio, en pantalla grande, tres defectos que el
// runner daba por buenos:
//
// - un chip «En curso» pintado una letra por línea y rótulos partidos a mitad de
//   palabra («RENDIMIE / NTO», «regist / ros»);
// - un texto que se sale del borde de su tarjeta;
// - la cabecera pegajosa de una tabla tapando su primera fila.
//
// Ninguno es un desborde de caja: los elementos miden lo que su contenedor les
// da y `scrollWidth` no crece. Los detectores de `inspectDom` comparan cajas, y
// además sólo dentro de `.pulso-panel`/`.mon-profile-panel`, que no es como se
// llaman las tarjetas de Monitoreo. Estos tres miden el TEXTO: dónde caen sus
// líneas y su rectángulo pintado.
//
// Viven en su propio archivo porque `ui-quick-check.mjs` ya pasa las 2.700
// líneas; `inspectDom` los llama y suma sus hallazgos al resultado.

/** Corre los detectores de lectura en la página y devuelve sus hallazgos. */
export async function medirLectura(page, { rootSelector = "" } = {}) {
  return page.evaluate(async ({ alcance }) => {
    const raiz = alcance ? document.querySelector(alcance) : document.body;
    const vacio = { rotulosPartidos: [], textosFuera: [], cabecerasQueTapan: [], columnasOcultas: [] };
    if (!raiz) return vacio;
    const TOPE = 20;
    const NO_TEXTO = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "SELECT", "OPTION", "TEMPLATE", "SVG"]);

    const visible = (el) => {
      if (!(el instanceof Element)) return false;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return false;
      // Lo que esconde un <details> cerrado tiene rectángulo pero no se pinta:
      // sin esto salían «textos fuera» en Conexiones y rótulos partidos en los
      // presets de Hojas › Muestra que nadie ve.
      if (typeof el.checkVisibility === "function" && !el.checkVisibility()) return false;
      let actual = el;
      while (actual instanceof Element) {
        const st = window.getComputedStyle(actual);
        if (st.display === "none" || st.visibility === "hidden" || Number.parseFloat(st.opacity) === 0) return false;
        // El patrón «sólo lectores de pantalla» (caja de 1 px recortada) tampoco
        // se pinta y checkVisibility() no lo ve: Carga › Preguntas a 1024×600
        // esconde así su resumen y salían «87 preguntas» fuera de su tarjeta.
        if (/^rect\(\s*0(px)?[\s,]+0(px)?[\s,]+0(px)?[\s,]+0(px)?\s*\)$/.test(st.clip)) return false;
        if (st.clipPath === "inset(50%)") return false;
        if (st.overflow === "hidden") {
          const caja = actual.getBoundingClientRect();
          if (caja.width <= 1 && caja.height <= 1) return false;
        }
        actual = actual.parentElement;
      }
      return true;
    };
    const describir = (el) => ({
      tag: el.tagName.toLowerCase(),
      className: String(el.getAttribute("class") || "").slice(0, 160),
      texto: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120),
    });
    const dentroDeSvg = (el) => Boolean(el.closest("svg"));

    // Nodos de texto visibles, con su elemento padre.
    const textos = [];
    const caminante = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT, {
      acceptNode: (nodo) => {
        const padre = nodo.parentElement;
        if (!padre || NO_TEXTO.has(padre.tagName.toUpperCase()) || dentroDeSvg(padre)) return NodeFilter.FILTER_REJECT;
        return (nodo.textContent || "").trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    const visibles = new Map();
    for (let nodo = caminante.nextNode(); nodo; nodo = caminante.nextNode()) {
      const padre = nodo.parentElement;
      if (!visibles.has(padre)) visibles.set(padre, visible(padre));
      if (visibles.get(padre)) textos.push(nodo);
    }

    // ── Rótulo partido ──────────────────────────────────────────────────────
    //
    // Un texto corto cuyas líneas son más que sus palabras («E n c u r s o»:
    // 7 líneas, 2 palabras) o que deja una línea de 3 caracteres o menos dentro
    // de una palabra («RENDIMIE / NTO», «responsabl / e»). Se mide carácter por
    // carácter con un Range: cada uno dice en qué línea cayó. Sólo textos de
    // hasta 80 caracteres —los rótulos—; un párrafo que se parte es lo normal.
    const rotulosPartidos = [];
    const porElemento = new Map();
    for (const nodo of textos) {
      const padre = nodo.parentElement;
      if (!porElemento.has(padre)) porElemento.set(padre, []);
      porElemento.get(padre).push(nodo);
    }
    for (const [el, nodos] of porElemento) {
      if (rotulosPartidos.length >= TOPE) break;
      const st = window.getComputedStyle(el);
      if (st.writingMode && !st.writingMode.startsWith("horizontal")) continue;
      // Los caracteres del elemento, en orden, con la línea donde cayó cada uno.
      const caracteres = [];
      for (const nodo of nodos) {
        const valor = nodo.textContent || "";
        for (let i = 0; i < valor.length; i += 1) {
          const c = valor[i];
          if (/\s/.test(c)) {
            caracteres.push({ c: " ", top: null });
            continue;
          }
          const rango = document.createRange();
          rango.setStart(nodo, i);
          rango.setEnd(nodo, i + 1);
          const r = rango.getBoundingClientRect();
          caracteres.push({ c, top: r.width > 0 || r.height > 0 ? Math.round(r.top) : null });
        }
      }
      const texto = caracteres.map((x) => x.c).join("").replace(/\s+/g, " ").trim();
      if (!texto || texto.length > 80) continue;
      const palabras = texto.split(" ").filter(Boolean).length;
      // Líneas: un cambio de `top` mayor que media línea abre una nueva.
      const alto = Number.parseFloat(st.fontSize) || 12;
      const lineas = [];
      let ultimaTop = null;
      caracteres.forEach((x, indice) => {
        if (x.top == null) {
          if (lineas.length) lineas[lineas.length - 1].texto += " ";
          return;
        }
        if (ultimaTop == null || Math.abs(x.top - ultimaTop) > alto / 2) {
          lineas.push({ texto: "", desde: indice, hasta: indice });
          ultimaTop = x.top;
        }
        const linea = lineas[lineas.length - 1];
        linea.texto += x.c;
        linea.hasta = indice;
      });
      if (lineas.length < 2) continue;
      const letra = (indice) => caracteres[indice] && caracteres[indice].c !== " ";
      // Una línea que termina en letra y sigue pegada a la siguiente corta una
      // palabra, mida lo que mida el pedazo: «Sin / registr / o en la / hoja»
      // tiene menos líneas que palabras y ningún pedazo corto, y es igual de
      // ilegible. El guionado automático parte con guion a propósito: no cuenta.
      const guionado = st.hyphens === "auto";
      const partida = guionado ? null : lineas.find((linea, i) => (
        i < lineas.length - 1 && letra(linea.hasta) && letra(lineas[i + 1].desde) && lineas[i + 1].desde === linea.hasta + 1
      ));
      if (lineas.length > palabras || partida) {
        rotulosPartidos.push({
          type: "rotulo-partido",
          ...describir(el),
          palabras,
          lineas: lineas.map((linea) => linea.texto.trim()),
          motivo: lineas.length > palabras ? "más líneas que palabras" : `línea «${partida.texto.trim()}» dentro de una palabra`,
          ancho: Math.round(el.getBoundingClientRect().width),
        });
      }
    }

    // ── Texto fuera de su tarjeta ───────────────────────────────────────────
    //
    // El rectángulo pintado de un texto contra el del contenedor con borde o
    // fondo más cercano. Si entre el texto y ese contenedor hay algo que
    // recorta o desplaza, el texto no se pinta fuera (eso es otro detector);
    // si hay algo posicionado, es un globo a propósito.
    const tieneMarco = (st) => {
      const conBorde = ["Top", "Right", "Bottom", "Left"].some((lado) => (
        Number.parseFloat(st[`border${lado}Width`]) > 0 && st[`border${lado}Style`] !== "none"
      ));
      const fondo = st.backgroundColor;
      const conFondo = (fondo && fondo !== "transparent" && !/rgba\([^)]*,\s*0\)$/.test(fondo)) || st.backgroundImage !== "none";
      return conBorde || conFondo;
    };
    const textosFuera = [];
    const yaReportados = new Set();
    for (const nodo of textos) {
      if (textosFuera.length >= TOPE) break;
      const rango = document.createRange();
      rango.selectNodeContents(nodo);
      const r = rango.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      let actual = nodo.parentElement;
      let contenedor = null;
      let descartado = false;
      while (actual && actual !== document.documentElement) {
        const st = window.getComputedStyle(actual);
        if (st.position === "absolute" || st.position === "fixed") { descartado = true; break; }
        if (tieneMarco(st)) { contenedor = actual; break; }
        if (st.overflowX !== "visible" || st.overflowY !== "visible") { descartado = true; break; }
        actual = actual.parentElement;
      }
      if (descartado || !contenedor || contenedor === document.body) continue;
      const stC = window.getComputedStyle(contenedor);
      if (stC.overflowX !== "visible" && stC.overflowY !== "visible") continue;
      const c = contenedor.getBoundingClientRect();
      const tol = 3;
      const seSale = {
        derecha: Math.round(r.right - c.right),
        izquierda: Math.round(c.left - r.left),
        abajo: Math.round(r.bottom - c.bottom),
        arriba: Math.round(c.top - r.top),
      };
      const peor = Object.entries(seSale).sort((a, b) => b[1] - a[1])[0];
      if (peor[1] <= tol) continue;
      if (yaReportados.has(contenedor)) continue;
      yaReportados.add(contenedor);
      textosFuera.push({
        type: "texto-fuera-de-tarjeta",
        ...describir(nodo.parentElement),
        texto: (nodo.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120),
        contenedor: describir(contenedor),
        lado: peor[0],
        seSale: peor[1],
      });
    }

    // ── Cabecera que tapa la primera fila ───────────────────────────────────
    //
    // Una cabecera `sticky` —de `<table>` o de una rejilla con roles— cuyo
    // rectángulo se monta sobre la primera fila de datos. Se mide dos veces:
    // al cargar y tras desplazar la tabla fila y media, que es como lo vio
    // Gonzalo («Elena Simulada» cortada bajo RESPONSABLE / MARCA). Una tabla
    // que encaja sus filas bajo la cabecera al soltar el scroll no deja
    // ninguna a medias; una que no, sí.
    const cabecerasQueTapan = [];
    const pegajosa = (el) => {
      if (window.getComputedStyle(el).position === "sticky") return true;
      return Array.from(el.querySelectorAll("th,[role='columnheader'],tr")).some((celda) => window.getComputedStyle(celda).position === "sticky");
    };
    const unir = (els) => els.map((el) => el.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0).reduce((a, r) => (a
      ? { left: Math.min(a.left, r.left), right: Math.max(a.right, r.right), top: Math.min(a.top, r.top), bottom: Math.max(a.bottom, r.bottom) }
      : { left: r.left, right: r.right, top: r.top, bottom: r.bottom }), null);
    const pares = [];
    for (const tabla of Array.from(raiz.querySelectorAll("table"))) {
      const cabecera = tabla.querySelector(":scope > thead");
      const fila = Array.from(tabla.querySelectorAll(":scope > tbody > tr")).find(visible);
      if (cabecera && fila && visible(cabecera) && pegajosa(cabecera)) pares.push([cabecera, fila, tabla]);
    }
    for (const tabla of Array.from(raiz.querySelectorAll("[role='table'],[role='grid']"))) {
      const filas = Array.from(tabla.querySelectorAll("[role='row']")).filter(visible);
      const cabecera = filas.find((f) => f.querySelector("[role='columnheader']"));
      const fila = filas.find((f) => f !== cabecera && !f.querySelector("[role='columnheader']"));
      if (cabecera && fila && pegajosa(cabecera)) pares.push([cabecera, fila, tabla]);
    }
    const esperar = (ms) => new Promise((listo) => setTimeout(listo, ms));
    const desplazable = (el) => {
      for (let actual = el.parentElement; actual && actual !== document.body; actual = actual.parentElement) {
        const st = window.getComputedStyle(actual);
        if (/(auto|scroll)/.test(st.overflowY) && actual.scrollHeight > actual.clientHeight + 4) return actual;
      }
      return null;
    };
    const filasDeDatos = (tabla, cabecera) => (tabla.tagName === "TABLE"
      ? Array.from(tabla.querySelectorAll(":scope > tbody > tr"))
      : Array.from(tabla.querySelectorAll("[role='row']")).filter((f) => f !== cabecera && !f.querySelector("[role='columnheader']"))
    ).filter(visible);
    // Al cargar se mira la primera fila de datos: ninguna debería quedar bajo
    // la cabecera. Desplazada, las que ya pasaron quedan bajo ella a propósito;
    // se mira la primera que asoma, que no debe empezar tapada.
    const medirTapada = (cabecera, filas, alCargar) => {
      const pegajosas = [cabecera, ...Array.from(cabecera.querySelectorAll("th,[role='columnheader'],tr"))]
        .filter((el) => window.getComputedStyle(el).position === "sticky");
      const h = unir(pegajosas.length ? pegajosas : [cabecera]);
      if (!h) return null;
      // La primera fila que asoma bajo la cabecera: ¿empieza tapada?
      const primera = alCargar ? filas[0] : filas.find((f) => f.getBoundingClientRect().bottom > h.bottom + 1);
      if (!primera) return null;
      const f = primera.getBoundingClientRect();
      const ix = Math.min(h.right, f.right) - Math.max(h.left, f.left);
      const iy = Math.min(h.bottom, f.bottom) - Math.max(h.top, f.top);
      return ix > 2 && iy > 2 ? { fila: primera, tapa: Math.round(iy) } : null;
    };
    for (const [cabecera, , tabla] of pares) {
      if (cabecerasQueTapan.length >= TOPE) break;
      const filas = filasDeDatos(tabla, cabecera);
      let hallazgo = medirTapada(cabecera, filas, true);
      let momento = "al cargar";
      const marco = desplazable(tabla);
      if (!hallazgo && marco && filas.length > 3) {
        const antes = marco.scrollTop;
        const alto = filas[0].getBoundingClientRect().height;
        marco.scrollTop = antes + Math.round(alto * 1.5);
        // Deja asentar un encaje de scroll (`scroll-snap`) si la tabla lo declara.
        await esperar(450);
        hallazgo = medirTapada(cabecera, filas, false);
        momento = "tras desplazar fila y media";
        marco.scrollTop = antes;
        await esperar(50);
      }
      if (hallazgo) {
        cabecerasQueTapan.push({
          type: "cabecera-tapa-fila",
          ...describir(tabla),
          fila: (hallazgo.fila.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80),
          tapa: hallazgo.tapa,
          momento,
        });
      }
    }

    // ── Columnas ocultas ────────────────────────────────────────────────────
    //
    // Una tabla más ancha que el ancestro que la recorta deja cabeceras fuera
    // de la vista. `desplazamientoH` sólo mide los marcos de un grupo de
    // geometría declarado, y en Equipo del telefónico a 1280 «Intentos por
    // caso» quedaba detrás del borde con desplazamientoH=0. Se nombran las
    // cabeceras que no se ven y se dice si el marco DESPLAZA (alcanzable,
    // aunque en macOS la barra no se vea) o RECORTA (inalcanzable).
    const columnasOcultas = [];
    for (const tabla of raiz.querySelectorAll("table")) {
      if (columnasOcultas.length >= TOPE) break;
      if (!visible(tabla)) continue;
      let marco = tabla.parentElement;
      let stMarco = null;
      while (marco && marco !== document.documentElement) {
        stMarco = window.getComputedStyle(marco);
        if (stMarco.overflowX !== "visible") break;
        marco = marco.parentElement;
      }
      if (!marco || marco === document.documentElement || !stMarco) continue;
      const rm = marco.getBoundingClientRect();
      const borde = rm.left + marco.clientLeft + marco.clientWidth;
      const fila = tabla.tHead?.rows[tabla.tHead.rows.length - 1] ?? tabla.rows[0];
      if (!fila) continue;
      const cabeceras = [...fila.cells]
        .filter((celda) => celda.getBoundingClientRect().right - (marco.scrollLeft || 0) > borde + 2)
        .map((celda) => (celda.textContent || "").replace(/\s+/g, " ").trim() || `columna ${celda.cellIndex + 1}`);
      if (!cabeceras.length) continue;
      columnasOcultas.push({
        type: "columnas-ocultas",
        ...describir(tabla),
        cabeceras,
        alcanzable: stMarco.overflowX === "auto" || stMarco.overflowX === "scroll",
        oculto: Math.round(tabla.getBoundingClientRect().right - borde),
        marco: describir(marco).className,
      });
    }

    return { rotulosPartidos, textosFuera, cabecerasQueTapan, columnasOcultas };
  }, { alcance: rootSelector });
}
