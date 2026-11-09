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
});
