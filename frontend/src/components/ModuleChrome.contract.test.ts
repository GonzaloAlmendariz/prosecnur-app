import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import { PROSECNUR_MODULES } from "../lib/modules";

/**
 * Detector de divergencia del chrome y de los estados de navegación.
 *
 * Existe porque la divergencia que este trabajo repara no fue una decisión: fue
 * la suma de veinte decisiones locales razonables. Nadie eligió tener nueve
 * radios de hover ni cinco alturas de banda; cada módulo resolvió su caso y el
 * conjunto se rompió. Un documento no impide eso. Un test sí.
 *
 * CÓMO SE USA DURANTE LA MIGRACIÓN
 * Cada aserción trae su whitelist con los infractores que existían cuando se
 * escribió el detector, y la whitelist SOLO puede encoger. `toEqual` falla igual
 * si aparece un infractor nuevo que si se migra uno viejo sin borrar su línea —
 * en ese segundo caso el arreglo es borrar la línea, y es la señal de que la
 * oleada avanzó. Un detector que arranca en verde y solo puede mejorar es lo
 * único que sostiene una migración de trece módulos.
 *
 * Molde tomado de GlidingTabList.contract.test.ts, que es el único test del repo
 * que ya perseguía consistencia entre módulos.
 */

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(AQUI, "..");
const REPO = path.resolve(SRC, "..", "..");

/** El dueño de los estados de navegación. Puede declarar lo que quiera. */
const DUENO_ESTADOS = "app/nav-states.css";
/** El dueño de la geometría del chrome. */
const DUENO_GEOMETRIA = "app/theme.css";

function archivosCss(dir: string = SRC): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      return entrada.name === "node_modules" ? [] : archivosCss(ruta);
    }
    return entrada.name.endsWith(".css")
      ? [path.relative(SRC, ruta).split(path.sep).join("/")]
      : [];
  });
}

type Regla = { archivo: string; linea: number; selector: string; cuerpo: string };

/**
 * Quita comentarios conservando los saltos de línea, para que los números de
 * línea sigan siendo los del archivo. Sin esto el selector arrastra la prosa del
 * comentario de arriba y el detector acusa a media app por lo que dice un
 * comentario.
 */
function sinComentarios(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (bloque) =>
    bloque.replace(/[^\n]/g, " "),
  );
}

/**
 * Parseo tosco pero suficiente: bloques `selector { declaraciones }`.
 *
 * Lineal, con conteo de profundidad. Dos cosas que aprendí escribiéndolo:
 *
 * Con una expresión regular sobre todo el archivo, theme.css —30 mil líneas—
 * tardaba ocho segundos por el backtracking de `[^{}]+`, y el primer test se
 * comía su timeout mientras los otros nueve corrían con el resultado cacheado.
 *
 * Y partir por `}` a secas no alcanza: dentro de un `@media`, el selector de la
 * regla interna arrastra el `@media … {` de arriba, empieza por «@» y se
 * descarta. Se perdían treinta reglas justo en los bloques responsive, que es
 * donde vive buena parte de la divergencia.
 */
function reglas(archivo: string): Regla[] {
  const css = sinComentarios(fs.readFileSync(path.join(SRC, archivo), "utf8"));
  const out: Regla[] = [];
  // Offsets de cada salto de línea, una vez. Buscar el salto anterior con
  // bisección es O(log n) por regla; recorrer desde cero era O(n) por regla, y
  // sobre theme.css eso son 30 mil líneas × cientos de reglas.
  const saltos: number[] = [];
  for (let i = 0; i < css.length; i += 1) if (css[i] === "\n") saltos.push(i);
  const lineaDe = (indice: number) => {
    let bajo = 0;
    let alto = saltos.length;
    while (bajo < alto) {
      const medio = (bajo + alto) >> 1;
      if (saltos[medio] < indice) bajo = medio + 1;
      else alto = medio;
    }
    return bajo + 1;
  };

  // Pila de aperturas pendientes. Cada `{` empuja dónde empezaba su selector.
  const pila: { selector: string; llave: number }[] = [];
  let inicioSelector = 0;

  for (let i = 0; i < css.length; i += 1) {
    const c = css[i];
    if (c !== "{" && c !== "}") continue;

    if (c === "{") {
      pila.push({
        selector: css.slice(inicioSelector, i).trim().replace(/\s+/g, " "),
        llave: i,
      });
      inicioSelector = i + 1;
      continue;
    }

    const abierto = pila.pop();
    inicioSelector = i + 1;
    if (!abierto) continue;
    if (!abierto.selector || abierto.selector.startsWith("@")) continue;
    // Un bloque que contiene otros bloques es un at-rule sin `@` (no existe) o
    // basura: sus declaraciones ya se leyeron en los hijos.
    const cuerpo = css.slice(abierto.llave + 1, i);
    if (cuerpo.includes("{")) continue;
    out.push({
      archivo,
      linea: lineaDe(abierto.llave),
      selector: abierto.selector,
      cuerpo,
    });
  }

  return out;
}

/**
 * Se parsea UNA vez, al importar el módulo y no dentro del primer test: son ~180
 * archivos y theme.css solo ya trae 30 mil líneas, así que la primera aserción
 * pagaba el parseo entero y se comía el timeout de 5s mientras las otras nueve
 * corrían en milisegundos con el resultado cacheado.
 */
const REGLAS: readonly Regla[] = archivosCss().flatMap(reglas);

function todasLasReglas(): readonly Regla[] {
  return REGLAS;
}

function declara(cuerpo: string, prop: string): string | null {
  const m = new RegExp(`(?:^|;)\\s*${prop}\\s*:([^;]+)`, "i").exec(cuerpo);
  return m ? m[1].trim() : null;
}


/**
 * Un hex CROMÁTICO. El blanco y el negro no codifican identidad de módulo —el
 * texto blanco sobre el acento del activo es correcto y es lo que
 * `--pulso-nav-selected-fg` significa— así que perseguirlos sería ruido. Lo que
 * importa es el color con tono: un `#cc1049` en un estado de navegación es un
 * acento que no sigue al módulo.
 */
function esCromatico(valor: string): boolean {
  for (const hex of valor.match(/#[0-9a-f]{3,8}\b/gi) ?? []) {
    const cuerpo = hex.slice(1);
    const corto = cuerpo.length <= 4;
    const paso = corto ? 1 : 2;
    const canal = (i: number) => {
      const trozo = cuerpo.slice(i * paso, i * paso + paso);
      const n = parseInt(corto ? trozo + trozo : trozo, 16);
      return Number.isNaN(n) ? 0 : n;
    };
    const [r, g, b] = [canal(0), canal(1), canal(2)];
    if (Math.max(r, g, b) - Math.min(r, g, b) > 12) return true;
  }
  return false;
}

/**
 * Clave de un infractor: archivo + selector, NO archivo + línea.
 *
 * Con línea, cualquier edición en theme.css corre los números de todo lo que
 * está debajo y las cuatro whitelists fallan a la vez sin que haya cambiado un
 * solo infractor. Eso entrena a re-hornear la lista a ciegas, que es exactamente
 * cómo un detector deja de detectar. El selector sobrevive a las ediciones
 * ajenas y, de paso, la whitelist se vuelve legible: dice QUÉ es el infractor.
 */
function clave(r: Regla): string {
  const selector = r.selector.length > 110 ? `${r.selector.slice(0, 107)}...` : r.selector;
  return `${r.archivo} :: ${selector}`;
}

/** Selectores de la familia «banda de chrome de módulo». */
const ES_BANDA =
  /command-bar|commandbar|context-bar|sourcebar|command-row|command-header|-topbar\b/;

/**
 * Selectores de la familia «item de navegación».
 *
 * Los `\b` no son decorativos: sin el límite, `view-tab` matcheaba dentro de
 * «re-view-table» y el detector acusaba a filas de tabla de ser items de
 * navegación. Un detector con falsos positivos se termina desactivando.
 */
const ES_ITEM_NAV =
  /nav-item|section-pill|phase-pill|-tab\b|-tabs\b|tab-chip|rail-item|stage-item|dash-tab\b|compact-tab\b|mode-tab\b|estilo-tab\b|inspector-tab\b|xfs-tab\b|-view-tab\b|delivery-tabs\b|sample-tabs\b|phase-tabs\b/;

/** El selector habla de un estado interactivo. */
const ES_ESTADO = /:hover|:focus-visible|\.is-active|aria-selected|aria-current/;

// ---------------------------------------------------------------------------
// 1 — Misma altura: la geometría de la banda sale de tokens, no de literales
// ---------------------------------------------------------------------------

/**
 * Bandas que todavía declaran su propio alto. Cinco alturas distintas para la
 * misma banda es lo que hacía que la app se viera armada por partes.
 */
const ALTURA_PROPIA_PENDIENTE = [
  "app/theme.css :: .pulso-analitica-panel-head > .pulso-analitica-sourcebar--panel",
  "app/theme.css :: .pulso-analitica-sourcebar",
  "app/theme.css :: .pulso-analitica-sourcebar--panel .pulso-analitica-source-actions :where(button, label)",
  "app/theme.css :: .pulso-analitica-sourcebar--panel .pulso-analitica-source-actions > [role=\"status\"]",
  "app/theme.css :: .pulso-analitica-sourcebar--panel .pulso-analitica-source-icon",
  "app/theme.css :: .pulso-analitica-sourcebar--panel .pulso-analitica-source-option",
  "app/theme.css :: .pulso-codificacion-commandbar",
  "app/theme.css :: .pulso-context-bar-divider",
  "features/analitica/analitica-v2.css :: .pulso-analitica-sourcebar--panel .pulso-analitica-source-option-icon",
  "features/bitacora/logbook.css :: .diseno-commandbar",
  "features/carga/carga-v2.css :: .pulso-sav-review-commandbar",
  "features/graficos/v2/styles/editor-v2.css :: .pulso-graficos-frame .pulso-gv2-command-header .pulso-gv2-icon-button",
  "features/graficos/v2/styles/editor-v2.css :: .pulso-graficos-frame .pulso-gv2-command-header .pulso-gv2-pill-button, .pulso-graficos-frame .pulso-gv2-co...",
  "features/graficos/v2/styles/editor-v2.css :: .pulso-graficos-frame .pulso-gv2-command-header > .pulso-gv2-command-row--exports",
  "features/graficos/v2/styles/editor-v2.css :: .pulso-graficos-frame .pulso-gv2-command-header > .pulso-gv2-command-row--unified",
  "features/graficos/v2/styles/editor-v2.css :: .pulso-graficos-frame .pulso-gv2-command-header > [aria-label]",
  "features/graficos/v2/styles/editor-v2.css :: .pulso-graficos-frame .pulso-gv2-command-row--unified .pulso-gv2-debug-border",
  "features/graficos/v2/styles/editor-v2.css :: .pulso-graficos-frame .pulso-gv2-command-row--unified .pulso-gv2-debug-border-chip",
  "features/graficos/v2/styles/editor-v2.css :: .pulso-graficos-frame .pulso-gv2-command-row--unified .pulso-gv2-debug-border-options",
  "features/graficos/v2/styles/editor-v2.css :: .pulso-graficos-frame .pulso-gv2-command-row--unified .pulso-gv2-icon-button",
  "features/graficos/v2/styles/editor-v2.css :: .pulso-graficos-frame .pulso-gv2-command-row--unified .pulso-gv2-icon-button > svg",
  "features/graficos/v2/styles/editor-v2.css :: .pulso-graficos-frame .pulso-gv2-command-row--unified .pulso-gv2-pill-button, .pulso-graficos-frame .pulso-...",
  "features/graficos/v2/styles/editor-v2.css :: .pulso-graficos-frame .pulso-gv2-command-row--unified :where(button, label) > svg, .pulso-graficos-frame .p...",
  "features/graficos/v2/styles/editor-v2.css :: .pulso-graficos-frame .pulso-gv2-command-row--unified a.pulso-gv2-prepare-trigger > svg",
  "features/graficos/v2/styles/editor-v2.css :: .pulso-gv2-command-header > [aria-label]",
  "features/graficos/v2/styles/editor-v2.css :: .pulso-gv2-command-header label",
  "features/graficos/v2/styles/editor-v2.css :: .pulso-gv2-command-row--exports",
  "features/graficos/v2/styles/editor-v2.css :: .pulso-gv2-command-row--status [role=\"status\"]",
  "features/monitoreo/monitoreo.css :: .mon-aulas-commandbar",
  "features/monitoreo/monitoreo.css :: .mon-toolbar button, .mon-commandbar button, .mon-download-link, .mon-inline-action, .mon-page .pulso-panel...",
  "features/monitoreo/monitoreo.css :: :where( .mon-toolbar, .mon-territorial-review-filterbar, .mon-query-evidencebar, .mon-territorial-exec-comm...",
  "features/monitoreo/profiles/territorial/territorialProfile.css :: .mon-territorial-exec-commandbar-meta span",
  "features/monitoreo/shell/monitoreoShell.css :: .mon-commandbar",
  "features/monitoreo/shell/monitoreoShell.css :: .mon-commandbar .mon-command-sync",
  "features/monitoreo/shell/monitoreoShell.css :: .mon-commandbar .mon-command-sync svg",
  "features/monitoreo/shell/monitoreoShell.css :: .mon-commandbar.has-section-rail",
];

describe("geometría del chrome", () => {
  test("ninguna banda nueva declara su propio alto", () => {
    const infractores = todasLasReglas()
      .filter((r) => ES_BANDA.test(r.selector))
      .filter((r) => {
        const alto = declara(r.cuerpo, "min-height") ?? declara(r.cuerpo, "height");
        if (!alto) return false;
        // Un token está bien; un literal en px es la divergencia.
        return /\d+(?:\.\d+)?px/.test(alto);
      })
      .map(clave);

    expect(
      [...new Set(infractores)].sort(),
      "Una banda de chrome con alto propio. Usa var(--pulso-chrome-commandbar-h) " +
        "para la banda de navegación o var(--pulso-chrome-surface-h) para una " +
        "superficie operativa. Si migraste una, borra su línea de la lista.",
    ).toEqual([...ALTURA_PROPIA_PENDIENTE].sort());
  });

  test("la banda maestra no tiene literales de geometría", () => {
    const maestra = reglas(DUENO_GEOMETRIA).find(
      (r) => r.selector === ".pulso-command-bar",
    );
    expect(maestra, "no encontré .pulso-command-bar").toBeTruthy();
    const alto = declara(maestra!.cuerpo, "min-height");
    expect(alto).toBe("var(--pulso-chrome-commandbar-h)");
  });
});

// ---------------------------------------------------------------------------
// 2 — El hover del item activo nunca se suprime
// ---------------------------------------------------------------------------

/**
 * Reglas que suprimen el hover del item activo. Es la queja literal del usuario
 * —«la pestaña en la que estamos no tiene activado hover»— y por eso el detector
 * la persigue por nombre.
 */
const SUPRIME_HOVER_PENDIENTE = [
  "app/theme.css :: .pulso-analitica-nav-item:hover:not(:disabled):not(.is-active)",
  "app/theme.css :: .pulso-app-header:has(.pulso-phase-rail) .pulso-phase-pill.is-active, .pulso-app-header:has(.pulso-phase-ra...",
  "app/theme.css :: .pulso-app-header:has(.pulso-phase-rail) .pulso-phase-pill:hover:not(.is-blocked):not(.is-disabled):not(.is...",
  "app/theme.css :: .pulso-app-header:has(.pulso-phase-rail) .pulso-phase-pill:not(.is-active):not(:hover):not(:focus-visible) ...",
  "app/theme.css :: .pulso-focus-mode-toggle button:hover:not(.is-on), .pulso-focus-tabs button:hover:not(.is-active), .pulso-f...",
  "app/theme.css :: .pulso-main--processing :is( .pulso-validacion-nav-item:hover:not(:disabled):not(.is-active), .pulso-codifi...",
  "app/theme.css :: .pulso-phase-pill.is-blocked:not(.is-active):hover",
  "app/theme.css :: .pulso-phase-pill:hover:not(.is-blocked):not(.is-disabled):not(.is-active) .pulso-phase-pill-circle",
  "app/theme.css :: .pulso-phase-pill:hover:not(.is-blocked):not(.is-disabled):not(.is-active) .pulso-phase-pill-label",
  "app/theme.css :: .pulso-phase-pill:hover:not(.is-blocked):not(.is-disabled):not(.is-active) .pulso-phase-pill-label-hover",
  "app/theme.css :: .pulso-tab-chip:hover:not(.is-disabled):not(.is-active)",
  "app/theme.css :: .pulso-xlsform-frame .pulso-sheets-tabs button:hover:not(.is-active), .pulso-xlsform-frame .pulso-inspector...",
  "features/bitacora/cronograma.css :: .plan-rail-item:hover:not(.is-active)",
  "features/calcMuestra/calcMuestra.css :: .cmv2-section-local-tab:hover:not(.is-active)",
  "features/calcMuestra/calcMuestra.css :: .cmv2-section-local-tabs.is-guided .cmv2-section-local-tab.is-pending:not(.is-active):hover",
  "features/calcMuestra/calcMuestra.css :: .cmv2-section-pill.pulso-phase-pill:hover:not(.is-active)",
  "features/carga/carga-v2.css :: .pulso-compact-tabs .pulso-compact-tab:hover:not(.is-active):not(:disabled):not([aria-disabled=\"true\"])",
  "features/carga/carga-v2.css :: .pulso-compact-tabs .pulso-compact-tab[aria-disabled=\"true\"]:hover:not(.is-active)",
  "features/carga/carga-v2.css :: .pulso-integrated-origin-tabs button:hover:not(:disabled):not(.is-active)",
  "features/carga/carga-v2.css :: .pulso-integrated-source-tabs button:hover:not(.is-active):not(:disabled)",
  "features/carga/carga-v2.css :: .pulso-platform-provider-tabs button:hover:not(.is-active):not(:disabled)",
  "features/dashboard/tabs/DimensionesTab/dimensiones.css :: .dashboard-scope .dash-dim-config-tab:hover:not(.is-active)",
  "features/dashboard/theme/tokens.css :: .dashboard-scope .dash-tab:hover:not(:disabled):not(.is-active)",
  "features/monitoreo/monitoreo.css :: .mon-territorial-route-tabs button:not(.is-active):hover",
  "features/monitoreo/profiles/profilePage.css :: .mon-acr-query-tabs button:hover:not(.is-active)",
  "features/monitoreo/profiles/profilePage.css :: .mon-profile-local-tabs button:hover:not(.is-active)",
  "features/monitoreo/salidas/outputsWorkbench.css :: .mon-outputs-audience-tabs button:hover:not(.is-active)",
  "features/xlsformEditor/styles/xf-inspector.css :: .pulso-inspector.pulso-xfi .pulso-inspector-tab-trigger:hover:not(.is-active)",
  "features/xlsformEditor/styles/xf-sheets.css :: .pulso-xlsform-frame .pulso-xfs-tab:hover:not(.is-active)",
];

describe("estados de navegación", () => {
  test("ninguna regla nueva suprime el hover del item activo", () => {
    const infractores = todasLasReglas()
      .filter((r) => r.archivo !== DUENO_ESTADOS)
      .filter((r) => ES_ITEM_NAV.test(r.selector))
      .filter((r) => r.selector.includes(":hover"))
      .filter((r) =>
        /:not\(\s*\.is-active|:not\(\s*\[aria-current|:not\(\s*\[aria-selected/.test(
          r.selector,
        ),
      )
      .map(clave);

    expect(
      [...new Set(infractores)].sort(),
      "Un `:hover` que se excluye del item activo. El activo TAMBIÉN reacciona " +
        "al mouse: nav-states.css ya lo resuelve para todo item con " +
        "`data-nav-item`. Emite el atributo y borra la regla.",
    ).toEqual([...SUPRIME_HOVER_PENDIENTE].sort());
  });

  /**
   * Reglas de hover que pintan fondo sin reasignar color. El bug que produce es
   * texto blanco sobre fondo claro, y ya ocurrió: Dashboard lo encontró, lo
   * arregló y lo dejó comentado en su CSS.
   */
  const FONDO_SIN_COLOR_PENDIENTE = [
    "app/theme.css :: .pulso-analitica-nav-item:hover:not(:disabled)",
    "app/theme.css :: .pulso-analitica-nav-item:hover:not(:disabled):not(.is-active)",
    "app/theme.css :: .pulso-app-header:has(.pulso-phase-rail) .pulso-phase-pill:hover:not(.is-blocked):not(.is-disabled):not(.is...",
    "app/theme.css :: .pulso-codificacion-nav-item:hover:not(:disabled)",
    "app/theme.css :: .pulso-phase-pill.is-blocked:not(.is-active):hover",
    "app/theme.css :: .pulso-validacion-nav-item:hover:not(:disabled)",
    "features/bitacora/cronograma.css :: .plan-rail-item:hover:not(.is-active)",
    "features/graficos/v2/styles/editor-v2.css :: .pulso-gv2-estilo-tab:hover",
    "features/graficos/v2/styles/editor-v2.css :: .pulso-gv2-estilo-tab:hover, .pulso-gv2-estilo-tab:focus-visible",
    "features/graficos/v2/styles/editor-v2.css :: .pulso-gv2-picker-rail .pulso-gv2-picker-tab:hover",
    "features/graficos/v2/styles/editor-v2.css :: .pulso-gv2-preset-nav-item:hover",
    "features/monitoreo/monitoreo.css :: .mon-nav-item:hover",
    "features/monitoreo/monitoreo.css :: .mon-workbench-rail.is-collapsible .mon-section-local-tabs .mon-nav-item:hover, .mon-workbench-rail.is-coll...",
    "features/monitoreo/profiles/profilePage.css :: .mon-acr-query-tabs button:hover:not(.is-active)",
    "features/monitoreo/profiles/profilePage.css :: .mon-profile-local-tabs button:hover:not(.is-active)",
    "features/monitoreo/profiles/telefonico/telefonicoProfile.css :: .is-telefonico-profile .mon-phone-supervision-tabs button:hover, .is-telefonico-profile .mon-phone-supervis...",
    "features/monitoreo/salidas/outputsWorkbench.css :: .mon-outputs-audience-tabs button:hover:not(.is-active)",
    "features/monitoreo/shell/monitoreoShell.css :: .mon-workbench-rail.is-acreditacion .mon-section-local-tabs .mon-nav-item:hover",
  ];

  test("un hover que pinta fondo también fija color", () => {
    const infractores = todasLasReglas()
      .filter((r) => r.archivo !== DUENO_ESTADOS)
      .filter((r) => ES_ITEM_NAV.test(r.selector) && r.selector.includes(":hover"))
      .filter((r) => {
        const fondo =
          declara(r.cuerpo, "background") ?? declara(r.cuerpo, "background-color");
        if (!fondo || fondo === "transparent" || fondo === "none") return false;
        return declara(r.cuerpo, "color") === null;
      })
      .map(clave);

    expect(
      [...new Set(infractores)].sort(),
      "Un hover que cambia el fondo sin reasignar el color. Si el item activo " +
        "tiene texto blanco, este hover lo deja invisible. `background` y " +
        "`color` van siempre en el mismo bloque.",
    ).toEqual([...FONDO_SIN_COLOR_PENDIENTE].sort());
  });

  /** Anillos de foco que usan sombra: los borra cualquier `.is-active`. */
  const FOCO_POR_SOMBRA_PENDIENTE = [
    "features/monitoreo/monitoreo.css :: .mon-workbench-rail.is-collapsible .mon-section-local-tabs .mon-nav-item:hover, .mon-workbench-rail.is-coll...",
  ];

  test("el anillo de foco de un item de navegación no se hace con box-shadow", () => {
    const infractores = todasLasReglas()
      .filter((r) => r.archivo !== DUENO_ESTADOS)
      .filter(
        (r) => ES_ITEM_NAV.test(r.selector) && r.selector.includes(":focus-visible"),
      )
      .filter(
        (r) =>
          declara(r.cuerpo, "box-shadow") !== null && declara(r.cuerpo, "outline") === null,
      )
      .map(clave);

    expect(
      [...new Set(infractores)].sort(),
      "Anillo de foco por box-shadow. Cualquier `.is-active` que use box-shadow " +
        "para su relieve lo borra sin querer — es el anillo que hoy se pierde en " +
        "las píldoras activas. Usa `outline` con var(--pulso-nav-focus-outline-color).",
    ).toEqual([...FOCO_POR_SOMBRA_PENDIENTE].sort());
  });

  /** Estados de navegación con color crudo en vez de acento del módulo. */
  const HEX_CRUDO_PENDIENTE = [
    "app/theme.css :: .pulso-focus-mode-toggle button.is-on, .pulso-focus-tabs button.is-active",
    "app/theme.css :: .pulso-xlsform-frame .pulso-inspector-tab-trigger.is-active",
    "features/hojasRuta/hojasRuta.css :: .hojas-ruta-delivery-tabs button.is-active span",
    "features/hojasRuta/hojasRuta.css :: .hojas-ruta-frame :is( .hojas-ruta-phase-tabs button.is-active, .hojas-ruta-map-layer-toggle button.is-acti...",
    "features/hojasRuta/hojasRuta.css :: .hojas-ruta-sample-tabs button.is-active span",
  ];

  test("un estado de navegación no pinta con hex crudo", () => {
    const infractores = todasLasReglas()
      .filter((r) => r.archivo !== DUENO_ESTADOS)
      .filter((r) => ES_ITEM_NAV.test(r.selector) && ES_ESTADO.test(r.selector))
      .filter((r) => {
        for (const prop of ["background", "background-color", "color", "border-color"]) {
          const valor = declara(r.cuerpo, prop);
          if (valor && esCromatico(valor)) return true;
        }
        return false;
      })
      .map(clave);

    expect(
      [...new Set(infractores)].sort(),
      "Un estado de navegación con color literal. No sigue al acento del módulo, " +
        "así que el mismo control se ve de otro color según el módulo. Usa " +
        "var(--pulso-nav-accent) y sus derivados.",
    ).toEqual([...HEX_CRUDO_PENDIENTE].sort());
  });
});

// ---------------------------------------------------------------------------
// 3 — El manifiesto declara el chrome, y las excepciones son auditables
// ---------------------------------------------------------------------------

describe("manifiesto de chrome", () => {
  test("todo módulo declara su chrome", () => {
    const sinChrome = PROSECNUR_MODULES.filter((m) => !m.chrome).map((m) => m.slug);
    expect(sinChrome).toEqual([]);
  });

  test("ningún módulo numera sus secciones", () => {
    // Los numerales se retiraron de los cinco rails: costaban ~22px por píldora y
    // ese ancho es lo que el rail necesita para caber junto a los indicadores de
    // los lados. El componente conserva la capacidad; volver a usarla es una
    // decisión, no un descuido.
    const numerados = PROSECNUR_MODULES.filter((m) => m.chrome.progreso === "numbered")
      .map((m) => m.slug);
    expect(numerados).toEqual([]);
  });

  test("cada excepción de chrome cita un ADR que existe", () => {
    const rotos: string[] = [];
    for (const modulo of PROSECNUR_MODULES) {
      const exc = modulo.chrome.chromeExcepcion;
      if (!exc) continue;
      if (!fs.existsSync(path.join(REPO, "docs", "adrs", exc.adr))) {
        rotos.push(`${modulo.slug} → docs/adrs/${exc.adr}`);
      }
      if (exc.motivo.trim().length < 40) {
        rotos.push(`${modulo.slug} → motivo demasiado corto para ser auditable`);
      }
    }
    expect(
      rotos,
      "Una excepción de chrome sin respaldo. La escotilla existe para que la " +
        "excepción sea auditable, no para saltarse el canon en silencio.",
    ).toEqual([]);
  });

  test("las excepciones son las tres decididas, ni una más", () => {
    const conExcepcion = PROSECNUR_MODULES.filter((m) => m.chrome.chromeExcepcion)
      .map((m) => m.slug)
      .sort();
    // Gráficos no está porque no necesita excepción de FILA: su banda invisible
    // es la variante declarada `material="none"`, y sus cinco filas eran alertas
    // que van al slot `notices`. Es una sección de Procesamiento, además.
    expect(
      conExcepcion,
      "Una excepción de chrome nueva es una decisión de producto, no de código.",
    ).toEqual(["dashboard", "editor-xlsform"]);
  });
});
