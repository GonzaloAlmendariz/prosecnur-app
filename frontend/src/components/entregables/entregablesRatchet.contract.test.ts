import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **Ratchet de entregas propias** (ADR 0133, fases 4 y 5 de "descargas unificadas").
 *
 * La espera, el nombre, la carpeta y las acciones de un archivo entregado viven
 * en el kit (`components/entregables`: `useGeneracion` + `ContenedorEntregable`).
 * Cuenta los archivos de `src/` que todavía hacen su propia entrega y sólo deja
 * que el número baje. Al migrar un flujo al kit (fase 5) se baja `BASE`.
 *
 * Un archivo entrega por su cuenta si contiene cualquiera de estas formas:
 *
 * - `propia`: descarga con `downloadUrl(` o `descargarArchivo(`, abre el diálogo
 *   `saveEntregableDialog` o guarda con `apiSaveEntregable(` / `apiSaveFileAs(`.
 * - `enlace`: arma un enlace de descarga a mano, sea un blob del front
 *   (`URL.createObjectURL` + `a.download = …`) o una ruta del backend
 *   (`<a href={…} download>`). La asignación `.download =` y el atributo JSX
 *   `download` de un `<a>` bastan: el blob sin `download` es una vista previa.
 * - `url`: llama a una función de `src/api` que sólo existe para dar la URL de
 *   una descarga (`URLS_DE_DESCARGA`). Se cuenta la llamada donde ocurra —en un
 *   `href`, un `window.open`, un `window.location.href` o pasada como prop—
 *   porque el hijo que pinta el `href` recibe ya la URL y no la delata.
 * - `helper`: llama a un helper local de descarga (`HELPERS_DE_DESCARGA`), que
 *   hace la entrega fuera del archivo que la dispara.
 *
 * No cuentan el kit, `src/api` (ofrece las funciones), `lib/descargas.ts`,
 * `lib/escritorio.ts` ni los tests. Ver un archivo en línea (`<img src>`, vista
 * previa) se hace con `urlDelArchivo(`, que no es una entrega.
 *
 * Fase 4: migraron los pilotos, el pie "Generar" de Analítica (PaneKit) y el menú
 * "Exportar" de Gráficos (BASE 41). Fase 5, oleada 0 (2026-11-07): los `<img>` de
 * Gráficos pasan a `urlDelArchivo` y el barrido ve blobs, enlaces, URLs de
 * descarga y helpers (BASE 56).
 */

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** Lo que no se barre: el kit, quien ofrece las funciones y los tests. */
const EXCLUIDOS = /^(?:components\/entregables\/|api\/|lib\/descargas\.ts$|lib\/escritorio\.ts$)/;

/** Llamadas que entregan un archivo por cuenta propia (fase 4). */
const FUNCIONES_PROPIAS = ["downloadUrl", "descargarArchivo", "apiSaveEntregable", "apiSaveFileAs"] as const;

/**
 * Funciones de `src/api` que devuelven la ruta de una descarga del backend
 * (`/download`, `/descargar`, `/result`, `/export`, `/pdf`). `downloadUrl` va en
 * `FUNCIONES_PROPIAS`. El test "la lista de URLs sale de src/api" la recalcula.
 */
export const URLS_DE_DESCARGA = [
  "jobResultUrl",
] as const;

/** Helpers locales que entregan un archivo (blob o enlace) por quien los llama. */
export const HELPERS_DE_DESCARGA = [
  "descargarConEnlace",
  "descargarCsv",
  "downloadRecipe",
] as const;

const llamadaA = (nombres: readonly string[]) => new RegExp(`\\b(?:${nombres.join("|")})\\s*\\(`);

const FORMAS = {
  propia: new RegExp(`${llamadaA(FUNCIONES_PROPIAS).source}|\\.saveEntregableDialog\\s*\\(|\\bsaveEntregableDialog\\s*\\?\\.\\s*\\(`),
  enlace: /\.download\s*=(?!=)|<a\b[^<]*?\sdownload(?=[\s=>/])/,
  url: llamadaA(URLS_DE_DESCARGA),
  helper: llamadaA(HELPERS_DE_DESCARGA),
} as const;

type Forma = keyof typeof FORMAS;

/** La declaración de la función no es un uso. */
const DEFINICION = new RegExp(
  `\\b(?:function|const|let)\\s+(?:${[...FUNCIONES_PROPIAS, ...URLS_DE_DESCARGA, ...HELPERS_DE_DESCARGA].join("|")})\\b`,
);

/** Foto tras la oleada 2 de la fase 5 (Monitoreo, Hojas de ruta, Cálculo de muestra, Dashboard y Carga en 0). Sólo baja. */
const BASE = 15;

function fuentes(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const completo = path.join(dir, e.name);
    if (e.isDirectory()) return fuentes(completo);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [completo] : [];
  });
}

function sinComentariosNiDefiniciones(fuente: string): string {
  return fuente
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => l.replace(/^\s*\/\/.*$/, ""))
    .filter((l) => !DEFINICION.test(l))
    .join("\n");
}

/** Formas de entrega propia que aparecen en una fuente (vacío si no entrega). */
export function formasDeEntrega(fuente: string): Forma[] {
  const codigo = sinComentariosNiDefiniciones(fuente);
  return (Object.keys(FORMAS) as Forma[]).filter((forma) => FORMAS[forma].test(codigo));
}

export function entregaPorCuentaPropia(fuente: string): boolean {
  return formasDeEntrega(fuente).length > 0;
}

const rel = (f: string) => path.relative(SRC, f).split(path.sep).join("/");

/** `features/<carpeta>` o la carpeta de primer nivel fuera de features. */
export function moduloDe(archivo: string): string {
  const partes = archivo.split("/");
  return partes[0] === "features" ? `features/${partes[1]}` : partes[0];
}

describe("entregas por cuenta propia (fuera del kit de entregables)", () => {
  const archivos = fuentes(SRC);
  const conEntrega = archivos
    .filter((f) => !EXCLUIDOS.test(rel(f)))
    .map((f) => ({ archivo: rel(f), formas: formasDeEntrega(readFileSync(f, "utf8")) }))
    .filter((x) => x.formas.length > 0)
    .sort((a, b) => a.archivo.localeCompare(b.archivo));
  const nombres = conEntrega.map((x) => x.archivo);

  it("el barrido ve el árbol (centinela)", () => {
    expect(archivos.length).toBeGreaterThan(500);
  });

  it("el detector reconoce cada forma y no confunde la definición ni los comentarios", () => {
    // propia
    expect(formasDeEntrega("descargarArchivo(downloadUrl(id), n);")).toEqual(["propia"]);
    expect(formasDeEntrega("const t = await window.prosecnurApi!.saveEntregableDialog({});")).toEqual(["propia"]);
    expect(formasDeEntrega("await api.saveEntregableDialog?.({});")).toEqual(["propia"]);
    expect(formasDeEntrega("await apiSaveEntregable(id, n);")).toEqual(["propia"]);
    expect(formasDeEntrega("window.location.href = downloadUrl(out.file_id);")).toEqual(["propia"]);
    // enlace: blob del front y <a download> sobre una ruta del backend
    expect(formasDeEntrega("const u = URL.createObjectURL(blob);\na.href = u;\na.download = nombre;")).toEqual(["enlace"]);
    expect(formasDeEntrega('<a className="x" href={item.downloadUrl} download>')).toEqual(["enlace"]);
    expect(formasDeEntrega("<a\n  href={paso.url}\n  download={paso.downloadName}\n>")).toEqual(["enlace"]);
    expect(formasDeEntrega('a.href = res.download_url;\na.download = "libro.xlsx";')).toEqual(["enlace"]);
    // url: funciones de src/api que sirven una descarga
    expect(formasDeEntrega("<a href={jobResultUrl(id)}>")).toEqual(["url"]);
    expect(formasDeEntrega("window.open(jobResultUrl(id), '_blank');")).toEqual(["url"]);
    expect(formasDeEntrega("verUrl: jobResultUrl(job.id),")).toEqual(["url"]);
    // helper local
    expect(formasDeEntrega("onClick={() => descargarCsv(contenido, nombre)}")).toEqual(["helper"]);
    expect(formasDeEntrega("downloadRecipe(receta, 'receta.json');")).toEqual(["helper"]);

    // negativos
    expect(formasDeEntrega("export function downloadUrl(file_id: string) {")).toEqual([]);
    expect(formasDeEntrega("export function descargarCsv(contenido: string, nombre: string) {")).toEqual([]);
    expect(formasDeEntrega("export function jobResultUrl(id: string) {")).toEqual([]);
    expect(formasDeEntrega("// descargarArchivo(url)\nconst a = 1;")).toEqual([]);
    expect(formasDeEntrega("/* a.download = n; */ const b = 2;")).toEqual([]);
    expect(formasDeEntrega("saveEntregableDialog: (opts: X) => Promise<string>;")).toEqual([]);
    expect(formasDeEntrega("<img src={urlDelArchivo(logo.file_id)} alt=\"\" />")).toEqual([]);
    expect(formasDeEntrega("const vista = URL.createObjectURL(file); setPrevia(vista);")).toEqual([]);
    expect(formasDeEntrega("if (a.download === n) return;")).toEqual([]);
    expect(formasDeEntrega("return { download: true, downloadName: n };")).toEqual([]);
    expect(formasDeEntrega('<a href={enlace} target="_blank" rel="noreferrer">Abrir</a>')).toEqual([]);
    expect(formasDeEntrega("<Boton download>Descargar</Boton>")).toEqual([]);
  });

  it("la lista de URLs de descarga sale de src/api", () => {
    const api = fuentes(path.join(SRC, "api"));
    const derivadas = api.flatMap((f) => {
      const codigo = readFileSync(f, "utf8");
      return [...codigo.matchAll(/export function (\w+Url)\s*\([^]*?\n\}/g)]
        .filter((m) => /\/(?:download|descargar|result|export|pdf)\b/.test(m[0]))
        .map((m) => m[1]);
    });
    expect(derivadas.filter((n) => n !== "downloadUrl").sort()).toEqual([...URLS_DE_DESCARGA].sort());
  });

  it("cada helper de la lista sigue existiendo (un guard no muere al renombrar)", () => {
    const definidos = new Set(
      archivos.flatMap((f) =>
        [...readFileSync(f, "utf8").matchAll(/\bfunction\s+(\w+)\s*\(|\bconst\s+(\w+)\s*=\s*(?:async\s*)?\(/g)].map(
          (m) => m[1] ?? m[2],
        ),
      ),
    );
    expect(HELPERS_DE_DESCARGA.filter((h) => !definidos.has(h))).toEqual([]);
  });

  it(`no crece: ${BASE} archivos como máximo`, () => {
    expect(nombres.length, `Archivos que entregan por su cuenta (usa components/entregables):\n${nombres.join("\n")}`)
      .toBeLessThanOrEqual(BASE);
  });

  it("la base no guarda un número que ya bajó", () => {
    expect(nombres.length, "Baja BASE a lo que mide el barrido.").toBe(BASE);
  });

  it("reparto por módulo (para planear las oleadas de la fase 5)", () => {
    const porModulo = new Map<string, string[]>();
    for (const { archivo, formas } of conEntrega) {
      const modulo = moduloDe(archivo);
      porModulo.set(modulo, [...(porModulo.get(modulo) ?? []), `  ${archivo} [${formas.join(",")}]`]);
    }
    const reparto = [...porModulo.entries()]
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
      .map(([modulo, lista]) => `${modulo} (${lista.length})\n${lista.join("\n")}`)
      .join("\n");
    console.info(`Entregas propias por módulo (${nombres.length}):\n${reparto}`);
    const total = [...porModulo.values()].reduce((n, lista) => n + lista.length, 0);
    expect(total, reparto).toBe(nombres.length);
  });

  it("los pilotos de la fase 4 entregan por el kit", () => {
    expect(nombres).not.toContain("features/analitica/PaneKit.tsx");
    expect(nombres).not.toContain("features/graficos/ExportarInformeMenu.tsx");
  });

  it("ver un archivo en línea no es una entrega", () => {
    for (const vista of [
      "features/graficos/ArgField.tsx",
      "features/graficos/IconosEditor.tsx",
      "features/graficos/estilo/PestanaEstilo.tsx",
      "features/graficos/estilo/TarjetaLogo.tsx",
      "features/graficos/laminas/contenidoEspecial/SelectorIconoSubido.tsx",
    ]) {
      expect(nombres).not.toContain(vista);
    }
  });
});
