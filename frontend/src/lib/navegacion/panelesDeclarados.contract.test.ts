/**
 * L2: todo overlay existente está declarado en el manifiesto.
 *
 * El QA visual recorre `PANELES_POR_MODULO`; un overlay que solo existe en
 * runtime nunca entra en una corrida. Este contrato cruza, sin montar React:
 *
 * 1. **Conectados → declarados.** Toda constante `PanelDeclarado` que un
 *    componente de producción conecta (`usePanelDireccionable`, `panel={…}`,
 *    `searchConPanel`, `panelAbiertoEn`) tiene su id y su clase declarados en
 *    el manifiesto.
 * 2. **Declarados → conectados.** Todo panel declarado está conectado en algún
 *    componente, salvo los de `PANELES_SIN_CONECTAR` (la lista de excepción
 *    explícita).
 * 3. **Sin conectar → existen.** Cada excepción cita un archivo que monta de
 *    verdad un overlay, y deja de ser excepción en cuanto se conecta.
 *
 * Es un barrido de texto y no de AST a propósito: las constantes de panel son
 * literales planos (`const X: PanelDeclarado = { id: "…", … }`) y el barrido
 * tiene que ver también las que viven en features, fuera del manifiesto.
 */
import { describe, expect, test } from "vitest";
import { readSources, type SourceText } from "../../test/contractSourceScan";
import {
  PANELES_POR_MODULO,
  PANELES_SIN_CONECTAR,
  type AmbitoPanel,
} from "./manifiesto";
import type { PanelDeclarado } from "./paneles";

type Firma = { id: string; clase: PanelDeclarado["clase"] };
type Declaracion = Firma & { nombre: string; archivo: string };

const SOURCES = readSources([".ts", ".tsx"]);

/** Primitivas que reciben el panel por parámetro: no conectan uno concreto. */
const PRIMITIVAS = new Set([
  "lib/navegacion/paneles.ts",
  "components/Dialog.tsx",
  "components/Sideover.tsx",
]);

const MARCAS_DE_CONEXION = /usePanelDireccionable\(|searchConPanel\(|panelAbiertoEn\(|\bpanel=\{/;
const MARCAS_DE_OVERLAY =
  /role="dialog"|aria-modal|createPortal\(|Dialog\.Content|<Dialog\b|<Sideover\b/;

function rel(source: SourceText): string {
  return source.relative.split("\\").join("/");
}

/** `const X: PanelDeclarado = { id: "…", clase: "…" }` en cualquier archivo. */
function declaracionesLiterales(): Declaracion[] {
  const salida: Declaracion[] = [];
  const patron = /\bconst\s+(\w+)\s*:\s*PanelDeclarado\s*=\s*\{([\s\S]*?)\n\};/g;
  for (const source of SOURCES) {
    if (!source.text.includes("PanelDeclarado")) continue;
    for (const match of source.text.matchAll(patron)) {
      const id = /\bid:\s*"([^"]+)"/.exec(match[2])?.[1];
      const clase = /\bclase:\s*"(\w+)"/.exec(match[2])?.[1];
      if (!id || !clase) continue;
      salida.push({
        nombre: match[1],
        id,
        clase: clase as Firma["clase"],
        archivo: rel(source),
      });
    }
  }
  return salida;
}

/** `const PANEL = PANELES_POR_MODULO.monitoreo![0]` → la entrada real. */
function declaracionesPorIndice(): Declaracion[] {
  const salida: Declaracion[] = [];
  const patron =
    /\bconst\s+(\w+)\s*=\s*PANELES_POR_MODULO(?:\.([\w]+)|\["([^"]+)"\])!?\??\.?\[(\d+)\]/g;
  for (const source of SOURCES) {
    if (!source.text.includes("PANELES_POR_MODULO")) continue;
    for (const match of source.text.matchAll(patron)) {
      const ambito = (match[2] ?? match[3]) as AmbitoPanel;
      const panel = PANELES_POR_MODULO[ambito]?.[Number(match[4])];
      if (!panel) {
        throw new Error(`${rel(source)}: PANELES_POR_MODULO.${ambito}[${match[4]}] no existe`);
      }
      salida.push({ nombre: match[1], id: panel.id, clase: panel.clase, archivo: rel(source) });
    }
  }
  return salida;
}

const DECLARACIONES = [...declaracionesLiterales(), ...declaracionesPorIndice()];

function resolver(nombre: string, archivo: string): Declaracion | "ambigua" | null {
  const local = DECLARACIONES.find((d) => d.nombre === nombre && d.archivo === archivo);
  if (local) return local;
  const globales = DECLARACIONES.filter((d) => d.nombre === nombre);
  if (globales.length === 0) return null;
  const firmas = new Set(globales.map((d) => `${d.id}:${d.clase}`));
  return firmas.size === 1 ? globales[0] : "ambigua";
}

type Conexion = Firma & { archivo: string; nombre: string };

/** Paneles concretos que algún componente conecta a la dirección. */
function conexiones(): { conectados: Conexion[]; irresolubles: string[] } {
  const conectados: Conexion[] = [];
  const irresolubles: string[] = [];
  const nombres = [...new Set(DECLARACIONES.map((d) => d.nombre))];

  for (const source of SOURCES) {
    const archivo = rel(source);
    if (PRIMITIVAS.has(archivo) || !MARCAS_DE_CONEXION.test(source.text)) continue;

    for (const nombre of nombres) {
      const usos = source.text.match(new RegExp(`\\b${nombre}\\b`, "g"))?.length ?? 0;
      const declaradaAqui = DECLARACIONES.some(
        (d) => d.nombre === nombre && d.archivo === archivo,
      );
      // Quien declara la constante la nombra una vez; conectarla es otra.
      if (usos - (declaradaAqui ? 1 : 0) <= 0) continue;
      const decl = resolver(nombre, archivo);
      if (decl === "ambigua") {
        irresolubles.push(`${archivo}: \`${nombre}\` tiene declaraciones con ids distintos`);
      } else if (decl) {
        conectados.push({ archivo, nombre, id: decl.id, clase: decl.clase });
      }
    }

    // Un argumento que parece panel pero no se puede resolver es un overlay
    // conectado que este contrato no sabe nombrar: tampoco vale.
    const argumentos = [
      ...source.text.matchAll(/usePanelDireccionable\(\s*([A-Za-z_]\w*)\s*\)/g),
      ...source.text.matchAll(/\bpanel=\{\s*(PANEL\w*)\s*\}/g),
    ].map((m) => m[1]);
    for (const nombre of argumentos) {
      if (resolver(nombre, archivo) === null) {
        irresolubles.push(`${archivo}: \`${nombre}\` no resuelve a un PanelDeclarado literal`);
      }
    }
  }
  return { conectados, irresolubles };
}

const DECLARADOS = (
  Object.entries(PANELES_POR_MODULO) as Array<[AmbitoPanel, readonly PanelDeclarado[]]>
).flatMap(([ambito, paneles]) => paneles.map((panel) => ({ ambito, panel })));

const SIN_CONECTAR_IDS = new Set(PANELES_SIN_CONECTAR.map((item) => item.panel.id));
const firma = (f: Firma) => `${f.id}:${f.clase}`;

describe("paneles declarados (L2)", () => {
  const { conectados, irresolubles } = conexiones();

  test("el barrido encuentra las conexiones conocidas", () => {
    // Centinela: si el regex deja de ver conexiones, todo lo demás pasaría
    // en vacío. Estos cuatro están conectados y probados por su feature.
    const ids = new Set(conectados.map((c) => c.id));
    for (const id of ["modulos", "conectar-fuente", "paletas", "reconciliacion"]) {
      expect(ids, `no se detecta la conexión de «${id}»`).toContain(id);
    }
  });

  test("todo argumento de panel resuelve a una declaración literal", () => {
    expect(irresolubles).toEqual([]);
  });

  test("todo overlay conectado está declarado en el manifiesto con su clase", () => {
    const declaradas = new Set(DECLARADOS.map(({ panel }) => firma(panel)));
    const huerfanos = conectados
      .filter((c) => !declaradas.has(firma(c)))
      .map((c) => `${c.archivo}: ${c.nombre} → ${firma(c)}`);
    expect(huerfanos, "declara el panel en PANELES_POR_MODULO (manifiesto.ts)").toEqual([]);
  });

  test("todo panel declarado está conectado, salvo la lista explícita «sin conectar»", () => {
    const conectadas = new Set(conectados.map(firma));
    const sinConexion = DECLARADOS.filter(
      ({ panel }) => !SIN_CONECTAR_IDS.has(panel.id) && !conectadas.has(firma(panel)),
    ).map(({ ambito, panel }) => `${ambito}#${panel.id}`);
    expect(sinConexion, "conéctalo o muévelo a PANELES_SIN_CONECTAR").toEqual([]);
  });

  test("un panel «sin conectar» deja de serlo al conectarse", () => {
    const conectadas = new Set(conectados.map((c) => c.id));
    const obsoletos = PANELES_SIN_CONECTAR.filter((item) => conectadas.has(item.panel.id)).map(
      (item) => `${item.ambito}#${item.panel.id}`,
    );
    expect(obsoletos, "sácalo de PANELES_SIN_CONECTAR").toEqual([]);
  });

  test("cada panel «sin conectar» cita un archivo que monta un overlay", () => {
    const porArchivo = new Map(SOURCES.map((source) => [rel(source), source.text]));
    const rotos = PANELES_SIN_CONECTAR.filter((item) => {
      const texto = porArchivo.get(item.archivo);
      return !texto || !MARCAS_DE_OVERLAY.test(texto);
    }).map((item) => `${item.panel.id} → ${item.archivo}`);
    expect(rotos).toEqual([]);
  });

  test("los «sin conectar» están todos dentro de PANELES_POR_MODULO", () => {
    for (const item of PANELES_SIN_CONECTAR) {
      expect(PANELES_POR_MODULO[item.ambito] ?? []).toContain(item.panel);
    }
  });

  test("ids ASCII estables y únicos dentro de cada ruta", () => {
    const porRaiz = new Map<string, string[]>();
    for (const { ambito, panel } of DECLARADOS) {
      expect(panel.id, `${ambito}#${panel.id}`).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(panel.label.trim(), `${ambito}#${panel.id} sin label`).not.toBe("");
      const raiz = ambito.split("/")[0];
      porRaiz.set(raiz, [...(porRaiz.get(raiz) ?? []), panel.id]);
    }
    const globales = new Set(porRaiz.get("global") ?? []);
    for (const [raiz, ids] of porRaiz) {
      const repetidos = ids.filter((id, i) => ids.indexOf(id) !== i);
      expect(repetidos, `ids repetidos en ${raiz}`).toEqual([]);
      if (raiz === "global") continue;
      const chocan = ids.filter((id) => globales.has(id));
      expect(chocan, `${raiz} reusa un id global`).toEqual([]);
    }
  });
});
