/**
 * Contrato de descargas y copiado (descargas unificadas, fase 1, 2026-11-07).
 *
 * Cuatro defectos del censo `docs/qa/censo-descargas-2026-11-07.md` que ningún
 * tipo detecta y que fallan EN SILENCIO dentro de Electron:
 *
 * 1. `window.open(<url de descarga del backend>)`: `setWindowOpenHandler`
 *    (desktop/main.cjs) deniega toda ventana nueva y el botón no hace nada. Se
 *    descarga con `descargarArchivo` (`lib/descargas.ts`).
 * 2. `className="spin"`: esa clase no existe; la del kit es `pulso-spin`, y el
 *    ícono de «trabajando» se queda quieto.
 * 3. `navigator.clipboard.writeText` directo: Electron niega la escritura y el
 *    botón falla mudo. Se copia con `copiarTexto` (`lib/portapapeles.ts`).
 * 4. `muestraAulasReporteDescargarUrl`: apunta a una ruta que el backend no
 *    tiene y nadie la llama.
 *
 * Recorre el árbol entero: está en TRANSVERSALES de `scripts/gate-front.mjs`.
 */
import ts from "typescript";
import { describe, expect, test } from "vitest";

import { parseSource, readSources, type SourceText } from "../test/contractSourceScan";

/** Primer argumento de `window.open(...)` que es una URL de descarga del backend. */
const URL_DE_DESCARGA = /\bdownloadUrl\(|\.download_url\b|\be\.pdf\b|\bhojasRutaReporteDecisionalUrl\(/;

const fuentes = (): readonly SourceText[] => readSources([".ts", ".tsx"]);

function linea(sf: ts.SourceFile, nodo: ts.Node): number {
  return sf.getLineAndCharacterOfPosition(nodo.getStart(sf)).line + 1;
}

/** `const url = downloadUrl(...)` en la misma función que `window.open(url)`. */
function inicializadorLocal(nodo: ts.Node, nombre: string, sf: ts.SourceFile): string | null {
  let ambito: ts.Node | undefined = nodo.parent;
  while (ambito && !ts.isFunctionLike(ambito) && !ts.isSourceFile(ambito)) ambito = ambito.parent;
  if (!ambito) return null;
  let hallado: string | null = null;
  const visitar = (n: ts.Node) => {
    if (hallado) return;
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === nombre && n.initializer) {
      hallado = n.initializer.getText(sf);
      return;
    }
    ts.forEachChild(n, visitar);
  };
  visitar(ambito);
  return hallado;
}

export function aperturasDeDescarga(fuente: SourceText): string[] {
  if (!fuente.text.includes("window.open(")) return [];
  const sf = parseSource(fuente);
  const hallazgos: string[] = [];
  const visitar = (n: ts.Node) => {
    if (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      n.expression.name.text === "open" &&
      ts.isIdentifier(n.expression.expression) &&
      n.expression.expression.text === "window" &&
      n.arguments.length > 0
    ) {
      const arg = n.arguments[0];
      const texto = ts.isIdentifier(arg) ? inicializadorLocal(n, arg.text, sf) ?? arg.text : arg.getText(sf);
      if (URL_DE_DESCARGA.test(texto)) hallazgos.push(`${fuente.relative}:${linea(sf, n)}`);
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return hallazgos;
}

/** Cada `className` literal que lleva el token `spin` suelto. */
export function clasesSpin(fuente: SourceText): string[] {
  const hallazgos: string[] = [];
  for (const m of fuente.text.matchAll(/className=\{?\s*["'`]([^"'`]*)["'`]/g)) {
    if (m[1].split(/\s+/).includes("spin")) {
      const n = fuente.text.slice(0, m.index).split("\n").length;
      hallazgos.push(`${fuente.relative}:${n}`);
    }
  }
  return hallazgos;
}

const PORTAPAPELES = "lib/portapapeles.ts";

/** `navigator.clipboard.writeText` (con o sin `?.`) fuera del helper. */
export function escriturasDirectas(fuente: SourceText): string[] {
  if (fuente.relative.split("\\").join("/") === PORTAPAPELES) return [];
  const hallazgos: string[] = [];
  const lineas = fuente.text.split("\n");
  lineas.forEach((l, i) => {
    if (/^\s*(\/\/|\*)/.test(l)) return;
    if (/navigator\s*\.\s*clipboard\s*\??\.\s*writeText\b/.test(l)) hallazgos.push(`${fuente.relative}:${i + 1}`);
  });
  return hallazgos;
}

describe("descargas y copiado que funcionan dentro de Electron", () => {
  test("el barrido ve el árbol", () => {
    expect(fuentes().length).toBeGreaterThan(300);
    expect(fuentes().some((f) => f.relative.split("\\").join("/") === PORTAPAPELES)).toBe(true);
  });

  test("ninguna descarga del backend se abre con window.open (Electron deniega la ventana)", () => {
    expect(fuentes().flatMap(aperturasDeDescarga)).toEqual([]);
  });

  test("ningún className usa la clase inexistente `spin` (la del kit es `pulso-spin`)", () => {
    expect(fuentes().flatMap(clasesSpin)).toEqual([]);
  });

  test("nadie escribe en el portapapeles sin copiarTexto (lib/portapapeles.ts)", () => {
    expect(fuentes().flatMap(escriturasDirectas)).toEqual([]);
  });

  test("no queda la URL de un reporte de muestra-aulas que el backend no sirve", () => {
    const hallazgos = fuentes()
      .filter((f) => f.text.includes("muestraAulasReporteDescargarUrl") || f.text.includes("/api/muestra-aulas/reporte/descargar"))
      .map((f) => f.relative);
    expect(hallazgos).toEqual([]);
  });
});

describe("los detectores", () => {
  const src = (relative: string, text: string): SourceText => ({ file: `/x/${relative}`, relative, text });

  test("ven window.open con URL de descarga, directa o por una constante local, y no otras ventanas", () => {
    const f = src(
      "features/x/A.tsx",
      [
        "export function A({ e, r, result }: any) {",
        '  window.open(downloadUrl(r.file_id), "_blank");',
        "  window.open(e.pdf);",
        "  window.open(result.download_url);",
        "  window.open(hojasRutaReporteDecisionalUrl({ inline: true }));",
        "  const url = downloadUrl(r.file_id);",
        "  window.open(url);",
        '  window.open(next.auth_url, "_blank");',
        "}",
        "function abrir(url: string) { window.open(url); }",
      ].join("\n"),
    );
    expect(aperturasDeDescarga(f)).toEqual([
      "features/x/A.tsx:2",
      "features/x/A.tsx:3",
      "features/x/A.tsx:4",
      "features/x/A.tsx:5",
      "features/x/A.tsx:7",
    ]);
  });

  test("ven el token spin y no pulso-spin ni cmv2-spin", () => {
    const f = src(
      "features/x/B.tsx",
      [
        '<Loader2 className="spin" />',
        '<Loader2 className="pulso-spin" />',
        '<Loader2 className={"icono spin"} />',
        '<Loader2 className="cmv2-spin" />',
      ].join("\n"),
    );
    expect(clasesSpin(f)).toEqual(["features/x/B.tsx:1", "features/x/B.tsx:3"]);
  });

  test("ven writeText directo con y sin ?., salvo en el helper y en comentarios", () => {
    const f = src(
      "features/x/C.tsx",
      [
        "await navigator.clipboard.writeText(t);",
        "void navigator.clipboard?.writeText(id);",
        "// navigator.clipboard.writeText rechaza en Electron",
        "await navigator.clipboard.write([item]);",
      ].join("\n"),
    );
    expect(escriturasDirectas(f)).toEqual(["features/x/C.tsx:1", "features/x/C.tsx:2"]);
    expect(escriturasDirectas(src(PORTAPAPELES, "await navigator.clipboard.writeText(texto);"))).toEqual([]);
  });
});
