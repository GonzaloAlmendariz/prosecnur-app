import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **P2 de la pasada de formato de Monitoreo: el título de un bloque es su cabecera.**
 *
 * El telefónico tiene su cabecera de bloque —`<header className="mon-ctl-panel-cabecera">
 * <b>Título</b><span>meta</span></header>`, la de «Listado por sede» en Control ›
 * Barrido—, pero la medición del 2 nov 2026 encontró 18 bloques que usaban un
 * antetítulo en versalitas (`mon-ctl-antetitulo`, `mon-tel-cuotas-antetitulo`,
 * `mon-cola-antetitulo`) COMO título, junto a bloques con título de verdad en la
 * misma vista: dos jerarquías para la misma cosa.
 *
 * Qué se prohíbe: que el primer hijo de un bloque (`<section>` con
 * `mon-ctl-panel`, `mon-tel-cuotas-panel`, `mon-cola-panel` o `mon-equipo-bloque`)
 * o el de su `<header>` sea un `*-antetitulo`. Lo mismo para el primer hijo de
 * cualquier `mon-ctl-panel-cabecera`, incluidas las dos ramas de un ternario
 * (`{hayRotulo ? <RotuloDePestana /> : <span className="…-antetitulo">}`).
 *
 * Qué se queda: el antetítulo que rotula un CAMPO o una cifra dentro del bloque
 * (Calendario «Semana de inicio», Equipo «Operador / Asignados / Llamados»):
 * es una etiqueta, no un título, y no es el primer hijo del bloque.
 */

const aqui = path.dirname(fileURLToPath(import.meta.url));

function archivos(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const completo = path.join(dir, e.name);
    if (e.isDirectory()) return archivos(completo);
    return /\.tsx$/.test(e.name) && !/\.test\./.test(e.name) ? [completo] : [];
  });
}

const rel = (f: string) => path.relative(aqui, f).split(path.sep).join("/");

const BLOQUE = /(?:^|\s)(?:mon-ctl-panel|mon-tel-cuotas-panel|mon-cola-panel|mon-equipo-bloque)(?:\s|$)/;
const CABECERA = /(?:^|\s)mon-ctl-panel-cabecera(?:\s|$)/;
const ANTETITULO = /[a-z0-9]-antetitulo(?:\s|$)/;

/** Sin comentarios de bloque (con sus llaves JSX vacías) ni líneas de comentario; conserva los saltos. */
function sinComentarios(fuente: string): string {
  return fuente
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/^\s*\/\/.*$/gm, "");
}

type Etiqueta = { nombre: string; clase: string; fin: number; autocierre: boolean; cierre: boolean };

/** Lee la etiqueta que empieza en `i` (`<…>`), saltando los `>` dentro de llaves (`=>`, comparaciones). */
function leerEtiqueta(src: string, i: number): Etiqueta | null {
  const cabeza = /^<(\/?)([A-Za-z][\w.]*)/.exec(src.slice(i, i + 80));
  if (!cabeza) return null;
  let llaves = 0;
  let j = i + cabeza[0].length;
  for (; j < src.length; j += 1) {
    const c = src[j];
    if (c === "{") llaves += 1;
    else if (c === "}") llaves -= 1;
    else if (c === ">" && llaves === 0) break;
  }
  const texto = src.slice(i, j + 1);
  const clase = /className=(?:"([^"]*)"|\{`([^`]*)`\})/.exec(texto);
  return {
    nombre: cabeza[2],
    clase: clase ? (clase[1] ?? clase[2] ?? "") : "",
    fin: j + 1,
    autocierre: texto.endsWith("/>"),
    cierre: cabeza[1] === "/",
  };
}

function saltarBlancos(src: string, i: number): number {
  let j = i;
  for (;;) {
    while (j < src.length && /\s/.test(src[j])) j += 1;
    // `{}` o `{ }` que dejó un comentario JSX.
    const vacia = /^\{\s*\}/.exec(src.slice(j, j + 200));
    if (!vacia) return j;
    j += vacia[0].length;
  }
}

/** Fin de la expresión `{…}` que empieza en `i`. */
function finDeExpresion(src: string, i: number): number {
  let llaves = 0;
  for (let j = i; j < src.length; j += 1) {
    if (src[j] === "{") llaves += 1;
    else if (src[j] === "}") {
      llaves -= 1;
      if (llaves === 0) return j + 1;
    }
  }
  return src.length;
}

/**
 * Las etiquetas que pueden ser el primer hijo a partir de `i`: el elemento que
 * sigue, o los elementos de primer nivel de la expresión que sigue (las dos
 * ramas de un ternario, el lado derecho de un `&&`).
 */
function primerHijo(src: string, i: number): { etiqueta: Etiqueta; en: number }[] {
  const j = saltarBlancos(src, i);
  if (src[j] === "<") {
    const etiqueta = leerEtiqueta(src, j);
    return etiqueta && !etiqueta.cierre ? [{ etiqueta, en: j }] : [];
  }
  if (src[j] !== "{") return [];
  const fin = finDeExpresion(src, j);
  const candidatas: { etiqueta: Etiqueta; en: number }[] = [];
  let nivel = 0;
  for (let k = j + 1; k < fin; k += 1) {
    if (src[k] !== "<" || !/[A-Za-z/]/.test(src[k + 1] ?? "")) continue;
    const etiqueta = leerEtiqueta(src, k);
    if (!etiqueta) continue;
    if (etiqueta.cierre) nivel -= 1;
    else {
      if (nivel === 0) candidatas.push({ etiqueta, en: k });
      if (!etiqueta.autocierre) nivel += 1;
    }
    k = etiqueta.fin - 1;
  }
  return candidatas;
}

/** `true` si el primer hijo de la cabecera que abre en `en` es un antetítulo. */
function cabeceraConAntetitulo(src: string, etiqueta: Etiqueta): boolean {
  if (etiqueta.autocierre) return false;
  return primerHijo(src, etiqueta.fin).some(({ etiqueta: hija }) => ANTETITULO.test(hija.clase));
}

const linea = (src: string, i: number) => src.slice(0, i).split("\n").length;

/** Los bloques y cabeceras cuyo título es un antetítulo, como `archivo:línea`. */
function titulosEnAntetitulo(fuente: string, archivo: string): string[] {
  const src = sinComentarios(fuente);
  const hallazgos = new Set<string>();
  for (const m of src.matchAll(/<(section|header)\b/g)) {
    const i = m.index ?? 0;
    const etiqueta = leerEtiqueta(src, i);
    if (!etiqueta || etiqueta.autocierre) continue;
    if (etiqueta.nombre === "header") {
      if (CABECERA.test(etiqueta.clase) && cabeceraConAntetitulo(src, etiqueta)) hallazgos.add(`${archivo}:${linea(src, i)}`);
      continue;
    }
    if (!BLOQUE.test(etiqueta.clase)) continue;
    for (const { etiqueta: hija, en } of primerHijo(src, etiqueta.fin)) {
      const mal = hija.nombre === "header" ? cabeceraConAntetitulo(src, hija) : ANTETITULO.test(hija.clase);
      if (mal) hallazgos.add(`${archivo}:${linea(src, en)}`);
    }
  }
  return [...hallazgos];
}

describe("cabecera de bloque del telefónico (P2)", () => {
  const fuentes = archivos(aqui);

  it("el barrido ve el perfil (centinela)", () => {
    expect(fuentes.length).toBeGreaterThan(40);
    const conBloques = fuentes.filter((f) => /mon-ctl-panel\b/.test(readFileSync(f, "utf8")));
    expect(conBloques.length).toBeGreaterThan(10);
  });

  it("ningún bloque usa un antetítulo como título (meta 0)", () => {
    expect(fuentes.flatMap((f) => titulosEnAntetitulo(readFileSync(f, "utf8"), rel(f)))).toEqual([]);
  });

  it("el detector reconoce lo que prohíbe (no es un guard que no guarda)", () => {
    const casa = (s: string) => titulosEnAntetitulo(s, "x").length;
    // Primer hijo del bloque.
    expect(casa('<section className="mon-ctl-panel mon-insumos-tarjeta" aria-label="Promedio">\n  <span className="mon-ctl-antetitulo">Promedio</span>\n</section>')).toBe(1);
    // Primer hijo de su cabecera, aunque la cabecera tenga clase propia.
    expect(casa('<section className="mon-equipo-bloque"><header className="mon-equipo-bloque-cabecera"><span className="mon-ctl-antetitulo">Status</span><small>3</small></header></section>')).toBe(1);
    expect(casa('<section className={`mon-ctl-panel x${a > b ? " is-pocos" : ""}`}><header className="y"><span className="mon-tel-cuotas-antetitulo">Faltan</span></header></section>')).toBe(1);
    // La rama de un ternario en una mon-ctl-panel-cabecera.
    expect(casa('<header className="mon-ctl-panel-cabecera">{hayRotulo ? <RotuloDePestana /> : <span className="mon-ctl-antetitulo">Estados</span>}</header>')).toBe(1);
    // Un comentario JSX delante no lo esconde.
    expect(casa('<section className="mon-cola-panel">\n  {/* nota */}\n  <span className="mon-cola-antetitulo">Teléfonos</span>\n</section>')).toBe(1);

    // Lo que se queda: la cabecera de la casa y el antetítulo que rotula un campo.
    expect(casa('<section className="mon-ctl-panel"><header className="mon-ctl-panel-cabecera"><b>Listado por sede</b><span>12 casos</span></header></section>')).toBe(0);
    expect(casa('<section className="mon-ctl-panel"><header className="mon-ctl-panel-cabecera"><b>Calendario</b></header><label><span className="mon-ctl-antetitulo">Semana de inicio</span></label></section>')).toBe(0);
    expect(casa('<header className="mon-ctl-panel-cabecera">{hayRotulo ? <RotuloDePestana /> : <b>Estados</b>}</header>')).toBe(0);
    // Un bloque que no es de la casa no cuenta.
    expect(casa('<section className="mon-dsc-ficha-bloque"><span className="mon-ctl-antetitulo">Kobo</span></section>')).toBe(0);
  });
});
