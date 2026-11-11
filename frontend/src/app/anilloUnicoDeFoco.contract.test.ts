// R12-5: un solo anillo de foco (outline var(--mov-foco)), sin halo. Las reglas globales de theme.css dibujaban un
// halo de 3px (box-shadow 0 0 0 3px) en todo <button> e <input>; cuando una hoja local añadía su outline, el control
// crudo quedaba con dos anillos. Ahora la regla global ES el anillo del kit, así que cualquier halo local sobre un
// control enfocado se suma a ese outline: es un anillo doble.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function hojas(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return hojas(p);
    return e.name.endsWith(".css") ? [p] : [];
  });
}

/** Parte por comas de primer nivel (respeta paréntesis). */
function partes(valor: string): string[] {
  const out: string[] = [];
  let nivel = 0;
  let actual = "";
  for (const ch of valor) {
    if (ch === "(") nivel += 1;
    if (ch === ")") nivel -= 1;
    if (ch === "," && nivel === 0) {
      out.push(actual);
      actual = "";
    } else actual += ch;
  }
  out.push(actual);
  return out.map((s) => s.trim()).filter(Boolean);
}

const sinComentarios = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

/** Capa de box-shadow que es un halo: sin desplazamiento ni desenfoque, sólo extensión, y no inset. */
function tieneHalo(cuerpo: string): boolean {
  const m = cuerpo.match(/(?<![-\w])box-shadow:\s*([^;]*)/);
  if (!m) return false;
  return partes(m[1].replace(/!important/, "")).some((capa) => /^0 0 0 [\d.]+px\b/.test(capa.replace(/\s+/g, " ")));
}

/**
 * Reglas donde el elemento enfocado es el sujeto (`:focus`/`:focus-visible` en el último compuesto, sin
 * `:focus-within` ni selectores de hover mezclados) y que suman un halo al outline: o declaran outline y halo a la
 * vez, o dejan el halo sin `outline: none`, con lo que el anillo global también se pinta.
 */
function anillosDobles(css: string): string[] {
  const dobles: string[] = [];
  for (const m of sinComentarios(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectores = partes(m[1]);
    if (!selectores.length || selectores.some((s) => !/:focus(-visible)?(?![-\w])/.test(s))) continue;
    if (selectores.some((s) => /:focus(-visible)?[^,]*[\s+~>]/.test(s.replace(/\([^)]*\)/g, "")))) continue;
    const cuerpo = m[2];
    if (!tieneHalo(cuerpo)) continue;
    // Un outline nulo o transparente (este último sólo existe para forced-colors) no pinta: el halo es el único anillo.
    if (/(?<![-\w])outline:\s*(none|0|[^;]*\btransparent\b)\s*[;!]/.test(cuerpo + ";")) continue;
    dobles.push(selectores[0]);
  }
  return dobles;
}

interface ReglaDeFoco {
  archivo: string;
  selector: string;
  /** Etiqueta y clases del último compuesto (el elemento enfocado), sin lo que va dentro de `:not()`. */
  etiqueta: string;
  clasesDelSujeto: string[];
  /** Atributos del último compuesto (`[data-nav-item]` → `data-nav-item`). */
  atributosDelSujeto: string[];
  /** Valor literal del outline, si lo declara. */
  outline: string | null;
  /** Todas las clases del selector, ancestros incluidos. */
  clases: string[];
  halo: boolean;
  pintaOutline: boolean;
  anulaSombra: boolean;
}

const OUTLINE_NULO = /(?<![-\w])outline:\s*(none|0|[^;]*\btransparent\b)\s*[;!]/;

/** Una entrada por selector con `:focus`/`:focus-visible` en el sujeto (sin `:has()` ni combinadores tras el foco). */
function reglasDeFoco(css: string, archivo: string): ReglaDeFoco[] {
  const out: ReglaDeFoco[] = [];
  for (const m of sinComentarios(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const cuerpo = m[2];
    const nulo = OUTLINE_NULO.test(cuerpo + ";");
    for (const selector of partes(m[1])) {
      if (!/:focus(-visible)?(?![-\w])/.test(selector) || /:has\(/.test(selector)) continue;
      if (/:focus(-visible)?[^,]*[\s+~>]/.test(selector.replace(/\([^)]*\)/g, ""))) continue;
      const limpio = selector.replace(/:not\([^)]*\)/g, "").replace(/:(where|is)\(|\)/g, " ").trim();
      const compuestos = limpio.split(/\s*[\s>+~]\s*/);
      const sujeto = compuestos[compuestos.length - 1] ?? "";
      const clasesDe = (t: string) => [...t.matchAll(/\.([\w-]+)/g)].map((x) => x[1]);
      out.push({
        archivo,
        selector: selector.trim(),
        etiqueta: sujeto.match(/^[a-z]+/)?.[0] ?? "",
        clasesDelSujeto: clasesDe(sujeto),
        atributosDelSujeto: [...sujeto.matchAll(/\[([\w-]+)/g)].map((x) => x[1]),
        outline: cuerpo.match(/(?<![-\w])outline:\s*([^;]*)/)?.[1].trim() ?? null,
        clases: clasesDe(limpio),
        halo: tieneHalo(cuerpo),
        pintaOutline: /(?<![-\w])outline:/.test(cuerpo) && !nulo,
        anulaSombra: /(?<![-\w])box-shadow:\s*none/.test(cuerpo),
      });
    }
  }
  return out;
}

/**
 * R13-4: el halo de una regla y el outline de OTRA sobre el mismo control. Se considera el mismo control cuando la
 * regla del outline refina a la del halo: comparte todas sus clases (las del sujeto, en el sujeto) y, si el sujeto del
 * halo es una etiqueta sin clase, la misma etiqueta. Así cae `.mon-commandbar button:focus-visible` (halo) frente a
 * `.mon-commandbar.is-barra-comun .mon-modo-actualizar button:focus-visible` (outline).
 *
 * NO cubre: el outline que llega por una clase que el selector del halo no nombra, ni decide qué regla gana por
 * especificidad u orden de carga; eso sólo lo ve la captura. Por eso el halo solo (outline nulo + halo) queda además
 * congelado por hoja en HALOS_SOLOS_HEREDADOS: no puede aparecer uno nuevo. El outline que llega por atributo lo cubre
 * `anillosPorAtributo` (R14-2) cruzando el markup que lleva ese atributo.
 */
function anillosDoblesCruzados(reglas: ReglaDeFoco[]): string[] {
  const dobles: string[] = [];
  const conOutline = reglas.filter((r) => r.pintaOutline);
  for (const h of reglas.filter((r) => r.halo && !r.pintaOutline)) {
    for (const o of conOutline) {
      if (o.anulaSombra) continue;
      const mismoSujeto = h.clasesDelSujeto.length
        ? h.clasesDelSujeto.every((c) => o.clasesDelSujeto.includes(c))
        : h.etiqueta !== "" && o.etiqueta === h.etiqueta;
      if (!mismoSujeto || !h.clases.every((c) => o.clases.includes(c))) continue;
      dobles.push(`${h.archivo}: ${h.selector} + ${o.archivo}: ${o.selector}`);
    }
  }
  return [...new Set(dobles)];
}

/** Anillos dobles cruzados heredados. R14-1 arregló los cinco de R13-4: la lista queda vacía y no vuelve a crecer. */
const DOBLES_CRUZADOS_HEREDADOS = new Set<string>([]);

function componentes(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return componentes(p);
    return e.name.endsWith(".tsx") && !e.name.includes(".test.") ? [p] : [];
  });
}

/**
 * Clases que el markup pone en la misma etiqueta que `atributo` (p. ej. `pulso-phase-pill` junto a `data-nav-item`).
 * Lee la etiqueta de apertura desde su `<` hasta el primer `>` de fin de línea o `/>`; descarta los `is-*` de estado.
 */
function clasesConAtributo(fuentes: Array<[string, string]>, atributo: string): Set<string> {
  const out = new Set<string>();
  for (const [, s] of fuentes) {
    for (const m of s.matchAll(new RegExp(`${atributo}(?![-\\w])`, "g"))) {
      const ini = s.lastIndexOf("<", m.index);
      const fin = s.slice(m.index).search(/(?<![=-])>\s*\n|\/>/);
      const etiqueta = s.slice(ini, (m.index ?? 0) + (fin < 0 ? 400 : fin));
      for (const lit of etiqueta.matchAll(/["'`]([^"'`]*)["'`]/g)) {
        for (const t of lit[1].split(/\s+/)) if (/^[a-z][a-z0-9]*(-[a-z0-9]+)+$/.test(t) && !t.startsWith("is-")) out.add(t);
      }
    }
  }
  return out;
}

/**
 * R14-2: el outline que llega por atributo. Una regla global `[atributo]:focus-visible` con outline se suma a cualquier
 * halo que otra regla le ponga al mismo control; el control se identifica por las clases que el markup pone junto al
 * atributo. Devuelve los halos (con o sin outline nulo: según especificidad sale doble o sale halo sin anillo del kit).
 */
function anillosPorAtributo(reglas: ReglaDeFoco[], fuentes: Array<[string, string]>): string[] {
  const dobles: string[] = [];
  const porAtributo = reglas.filter((r) => r.pintaOutline && !r.etiqueta && !r.clasesDelSujeto.length);
  for (const a of porAtributo) {
    for (const atributo of a.atributosDelSujeto.filter((x) => x.startsWith("data-"))) {
      const clases = clasesConAtributo(fuentes, atributo);
      for (const h of reglas.filter((r) => r.halo)) {
        const porClase = h.clasesDelSujeto.some((c) => clases.has(c));
        if (!a.clases.every((c) => h.clases.includes(c))) continue; // el ámbito de la regla del atributo
        if (porClase || h.atributosDelSujeto.includes(atributo)) dobles.push(`${h.archivo}: ${h.selector} + ${a.archivo}: ${a.selector}`);
      }
    }
  }
  return [...new Set(dobles)];
}

/**
 * Halo solo (outline nulo + halo 0 0 0 Npx) por hoja, al escribir R13-4 (R14-3 migró Gráficos, Monitoreo y el shell). No es un anillo doble, pero no es el anillo
 * del kit y es el terreno donde nace el doble en cuanto otra regla le pone outline al mismo control. Sólo puede bajar.
 */
const HALOS_SOLOS_HEREDADOS: Record<string, number> = {
  "app/theme.css": 2,
  "features/analitica/panes/ComparativosPane.css": 4,
  "features/calcMuestra/calcMuestra.css": 11,
  "features/calcMuestra/didactica/didactica.css": 3,
  "features/calcMuestra/universidad/aulas/classroomSelectionMap.css": 1,
  "features/calcMuestra/universidad/calculo/calculo.css": 2,
  "features/calcMuestra/universidad/criterios/criterios.css": 4,
  "features/calcMuestra/universidad/definicion/definicion.css": 3,
  "features/calcMuestra/universidad/salidas/salidas.css": 3,
  "features/calcMuestra/universidad/ui/explicacionPlegable.css": 1,
  "features/calcMuestra/universidad/ui/ui.css": 4,
  "features/carga/carga-v2.css": 12,
  "features/codificacion/codificacion-v2.css": 9,
  "features/graficos/v2/styles/editor-v2.css": 1,
  "features/home/home-v2.css": 9,
  "features/monitoreo/monitoreo.css": 3,
  "features/monitoreo/profiles/profilePage.css": 4,
  "features/monitoreo/profiles/territorial/territorialProfile.css": 3,
  "features/procesamiento/processingSheetViewer.css": 1,
  "features/recopiladores/correos/correosCampanas.css": 1,
  "features/recopiladores/correos/correosCapa.css": 2,
  "features/recopiladores/editor/editor.css": 2,
  "features/recopiladores/styles/access.css": 7,
  "features/recopiladores/styles/delivery.css": 1,
  "features/recopiladores/styles/origen.css": 1,
  "features/validacion/validacion-v2.css": 2,
  "features/xlsformEditor/canvas/ficha/ficha.css": 1,
  "features/xlsformEditor/canvas-graph/condicionPanel.css": 1,
  "features/xlsformEditor/shell/simulador/grillaPrueba.css": 1,
  "features/xlsformEditor/styles/xf-canvas.css": 5,
  "features/xlsformEditor/styles/xf-graph/03-leyenda-minimap-indicador-de.css": 9,
  "features/xlsformEditor/styles/xf-inspector.css": 7,
  "features/xlsformEditor/styles/xf-sheets.css": 4,
  "features/xlsformEditor/styles/xf-simulator.css": 5,
  "features/xlsformEditor/styles/xf-text-rules.css": 7,
  "features/xlsformEditor/styles/xlsform-v2/02-fila-con-campo-numerico-tope.css": 8,
  "features/xlsformEditor/styles/xlsform-v2/05-choice-row-fila-ordenable-de.css": 1,
};

/** Último compuesto del selector crudo, respetando paréntesis (`.a :where(b, c):focus-visible` → `:where(b, c):focus-visible`). */
function ultimoCompuesto(selector: string): string {
  const out: string[] = [];
  let nivel = 0;
  let actual = "";
  for (const ch of selector.trim()) {
    if (ch === "(") nivel += 1;
    if (ch === ")") nivel -= 1;
    if (nivel === 0 && /[\s>+~]/.test(ch)) {
      if (actual) out.push(actual);
      actual = "";
    } else actual += ch;
  }
  if (actual) out.push(actual);
  return out[out.length - 1] ?? "";
}

/**
 * R16-1: el halo "manta". Un `:where()`/`:is()` con una lista de etiquetas (o un `:focus-visible` desnudo) como sujeto
 * enfoca cualquier control del ámbito sin nombrar una sola clase, y con `outline: none` apaga el anillo de TODOS,
 * incluido el de `[data-nav-item]` de nav-states.css (misma especificidad, gana por orden de carga).
 *
 * Por qué se escapó `.pulso-carga-frame :where(button, a, select, input, summary, [role="tab"]):focus-visible`: el
 * congelamiento por hoja sólo impide que el conteo CREZCA, y carga-v2.css ya estaba en HALOS_SOLOS_HEREDADOS con 13; y
 * los detectores cruzados comparan las clases del sujeto, pero `reglasDeFoco` reduce ese sujeto a `:focus-visible`, sin
 * etiqueta, clase ni atributo, así que no casaba con nada. Este detector no depende de la lista: vale para toda hoja.
 */
function haloManta(r: ReglaDeFoco): boolean {
  if (!r.halo || r.pintaOutline) return false;
  const sujeto = ultimoCompuesto(r.selector);
  const fuera = sujeto.replace(/:(not|where|is|has)\((?:[^()]|\([^()]*\))*\)/g, "");
  if (/[.#[]|^[a-z]/.test(fuera)) return false; // nombra una clase, un id, un atributo o una etiqueta propia
  const lista = [...sujeto.matchAll(/:(?:where|is)\(((?:[^()]|\([^()]*\))*)\)/g)].flatMap((m) => partes(m[1]));
  return lista.length === 0 || lista.every((x) => !/[.#]/.test(x));
}

/** Halo solo (outline nulo + halo) por hoja; lo que supera su línea base de HALOS_SOLOS_HEREDADOS (0 si no está). */
function halosQueCrecen(reglas: ReglaDeFoco[], base: Record<string, number>): string[] {
  const porHoja: Record<string, number> = {};
  for (const r of reglas) if (r.halo && !r.pintaOutline) porHoja[r.archivo] = (porHoja[r.archivo] ?? 0) + 1;
  return Object.entries(porHoja)
    .filter(([f, n]) => n > (base[f] ?? 0))
    .map(([f, n]) => `${f}: ${n} > ${base[f] ?? 0}`);
}

function censo(): ReglaDeFoco[] {
  return hojas(SRC).flatMap((f) => reglasDeFoco(fs.readFileSync(f, "utf8"), path.relative(SRC, f).split(path.sep).join("/")));
}

describe("anillo único de foco", () => {
  it("las reglas globales de button e input dibujan el anillo del kit, sin halo", () => {
    const theme = sinComentarios(fs.readFileSync(path.join(SRC, "app/theme.css"), "utf8"));
    const reglas = [
      /button:where\(:focus-visible\)\s*\{([^}]*)\}/,
      /input:focus, textarea:focus, select:focus\s*\{([^}]*)\}/,
      /input\[type="radio"\]:focus-visible\s*\{([^}]*)\}/,
    ];
    for (const re of reglas) {
      const cuerpo = theme.match(re)?.[1];
      expect(cuerpo, String(re)).toBeDefined();
      expect(cuerpo).toMatch(/outline:\s*var\(--mov-foco\)/);
      expect(tieneHalo(cuerpo ?? "")).toBe(false);
    }
  });

  it("ninguna hoja suma un halo al anillo de un control enfocado", () => {
    const regresiones: string[] = [];
    const todas = hojas(SRC);
    expect(todas.length, "vacuna: el censo encuentra hojas").toBeGreaterThan(300);
    for (const f of todas) {
      const rel = path.relative(SRC, f).split(path.sep).join("/");
      for (const sel of anillosDobles(fs.readFileSync(f, "utf8"))) regresiones.push(`${rel}: ${sel}`);
    }
    expect(regresiones, "Quita el box-shadow 0 0 0 Npx y usa outline: var(--mov-foco); outline-offset: 2px.").toEqual([]);
  });

  it("vacuna: el detector ve los dos dialectos del anillo doble y respeta el halo con outline nulo", () => {
    expect(anillosDobles(".a:focus-visible { outline: var(--mov-foco); box-shadow: 0 0 0 3px red; }")).toEqual([".a:focus-visible"]);
    expect(anillosDobles(".b input:focus { box-shadow: inset 0 1px 0 #fff, 0 0 0 3px red; }")).toEqual([".b input:focus"]);
    expect(anillosDobles(".c:focus { outline: none; box-shadow: 0 0 0 3px red; }")).toEqual([]);
    expect(anillosDobles(".c2:focus { outline: 2px solid transparent; box-shadow: 0 0 0 3px red; }")).toEqual([]);
    expect(anillosDobles(".d:focus-within { box-shadow: 0 0 0 3px red; }")).toEqual([]);
    expect(anillosDobles(".e:focus-visible + span { box-shadow: 0 0 0 3px red; }")).toEqual([]);
    expect(anillosDobles(".f:hover, .f:focus-visible { box-shadow: 0 0 0 3px red; }")).toEqual([]);
  });

  it("ningún halo se suma al outline que otra regla le da al mismo control (R13-4)", () => {
    const nuevos = anillosDoblesCruzados(censo()).filter((d) => !DOBLES_CRUZADOS_HEREDADOS.has(d));
    expect(nuevos, "Quita el box-shadow 0 0 0 Npx de la regla del halo; el anillo es el outline var(--mov-foco).").toEqual([]);
  });

  it("el outline que llega por atributo es el anillo del kit y no se suma a un halo (R14-2)", () => {
    const fuentes = componentes(SRC).map((f): [string, string] => [f, fs.readFileSync(f, "utf8")]);
    const reglas = censo();
    const navItem = reglas.find((r) => r.archivo === "app/nav-states.css" && r.selector === "[data-nav-item]:focus-visible");
    expect(navItem?.outline, "[data-nav-item]:focus-visible").toBe("var(--mov-foco)");
    expect(clasesConAtributo(fuentes, "data-nav-item").has("pulso-phase-pill"), "vacuna: el markup de la píldora se lee").toBe(true);
    const globales = reglas.filter((r) => r.pintaOutline && r.atributosDelSujeto.length && !r.clasesDelSujeto.length && !r.etiqueta);
    expect(globales.filter((r) => r.outline !== "var(--mov-foco)").map((r) => `${r.archivo}: ${r.selector} → ${r.outline}`)).toEqual([]);
    expect(anillosPorAtributo(reglas, fuentes), "Quita el halo: el anillo del item de navegación es el de nav-states.css.").toEqual([]);
  });

  it("vacuna R14-2: un halo sobre una clase que el markup marca con el atributo se ve", () => {
    const fuentes: Array<[string, string]> = [["x.tsx", '<button\n  data-nav-item=""\n  className={["nav-pill", activa ? "is-active" : ""].join(" ")}\n>\n']];
    const reglas = [
      ...reglasDeFoco("[data-nav-item]:focus-visible { outline: var(--mov-foco); }", "n.css"),
      ...reglasDeFoco(".dock .nav-pill:focus-visible { outline: none; box-shadow: 0 0 0 3px red; }", "p.css"),
    ];
    expect(anillosPorAtributo(reglas, fuentes)).toHaveLength(1);
    expect(anillosPorAtributo(reglas.slice(0, 1), fuentes)).toEqual([]);
  });

  it("los dobles cruzados heredados siguen existiendo; el que se arregla sale de la lista (R13-4)", () => {
    const vivos = new Set(anillosDoblesCruzados(censo()));
    expect([...DOBLES_CRUZADOS_HEREDADOS].filter((d) => !vivos.has(d))).toEqual([]);
  });

  it("no aparece un halo solo nuevo y los arreglados en R13 no vuelven (R13-4)", () => {
    const porHoja: Record<string, number> = {};
    for (const r of censo()) if (r.halo && !r.pintaOutline) porHoja[r.archivo] = (porHoja[r.archivo] ?? 0) + 1;
    expect(halosQueCrecen(censo(), HALOS_SOLOS_HEREDADOS), "Usa outline: var(--mov-foco) en lugar del halo.").toEqual([]);
    const bajaron = Object.entries(HALOS_SOLOS_HEREDADOS)
      .filter(([f, n]) => (porHoja[f] ?? 0) < n)
      .map(([f, n]) => `${f}: ${porHoja[f] ?? 0} < ${n}`);
    expect(bajaron, "Baja la línea base de HALOS_SOLOS_HEREDADOS.").toEqual([]);
    const theme = censo().filter((r) => r.archivo === "app/theme.css");
    for (const sel of [".pulso-phase-pill:focus-visible", ".pulso-project-switch:focus-visible", ".pulso-project-confirm-button:focus-visible"]) {
      const regla = theme.find((r) => r.selector.endsWith(sel));
      expect(regla, sel).toBeDefined();
      expect(regla?.halo, sel).toBe(false);
      expect(regla?.pintaOutline, sel).toBe(true);
    }
  });

  it("ningún halo manta apaga el anillo de todo un ámbito, en ninguna hoja (R16-1)", () => {
    const mantas = censo().filter(haloManta).map((r) => `${r.archivo}: ${r.selector}`);
    expect(mantas, "Una lista de etiquetas con outline: none apaga el anillo de los items de navegación: usa outline: var(--mov-foco).").toEqual([]);
  });

  it("vacuna R16-1: el halo manta de Carga se ve; el halo de una clase no es manta; una hoja nueva no hereda cupo", () => {
    const carga = reglasDeFoco(
      '.pulso-carga-frame :where(button, a, select, input, summary, [role="tab"]):focus-visible { outline: none; box-shadow: 0 0 0 3px red; }',
      "features/nueva/nueva.css",
    );
    expect(carga.filter(haloManta)).toHaveLength(1);
    expect(reglasDeFoco(".x :focus-visible { outline: none; box-shadow: 0 0 0 3px red; }", "y.css").filter(haloManta)).toHaveLength(1);
    expect(reglasDeFoco(".x .pill:focus-visible { outline: none; box-shadow: 0 0 0 3px red; }", "y.css").filter(haloManta)).toEqual([]);
    expect(reglasDeFoco(".x button:focus-visible { outline: none; box-shadow: 0 0 0 3px red; }", "y.css").filter(haloManta)).toEqual([]);
    expect(reglasDeFoco(".x :where(button, a):focus-visible { outline: var(--mov-foco); }", "y.css").filter(haloManta)).toEqual([]);
    expect(halosQueCrecen(carga, HALOS_SOLOS_HEREDADOS)).toEqual(["features/nueva/nueva.css: 1 > 0"]);
  });

  it("vacuna R13-4: el doble cruzado de Monitoreo y el halo con outline nulo se ven", () => {
    const halo = reglasDeFoco(
      ".mon-commandbar button:not(.pulso-button):focus-visible { outline: 2px solid transparent; box-shadow: 0 0 0 3px red; }",
      "a.css",
    );
    const outline = reglasDeFoco(
      ".mon-commandbar.is-barra-comun .mon-modo-actualizar button:focus-visible { outline: var(--mov-foco); }",
      "b.css",
    );
    expect(anillosDoblesCruzados([...halo, ...outline])).toHaveLength(1);
    const ajeno = reglasDeFoco(".otra button:focus-visible { outline: var(--mov-foco); }", "c.css");
    expect(anillosDoblesCruzados([...halo, ...ajeno])).toEqual([]);
    const anulada = reglasDeFoco(".mon-commandbar .x button:focus-visible { outline: var(--mov-foco); box-shadow: none; }", "d.css");
    expect(anillosDoblesCruzados([...halo, ...anulada])).toEqual([]);
    const pill = reglasDeFoco(":where(.dock) .pill:focus-visible { outline: none; box-shadow: 0 0 0 3px red; }", "e.css");
    expect(pill[0]).toMatchObject({ halo: true, pintaOutline: false, clasesDelSujeto: ["pill"] });
  });
});
