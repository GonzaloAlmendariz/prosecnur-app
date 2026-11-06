import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { PANELES_POR_MODULO } from "./manifiesto";

/**
 * **L2 — todo panel que se declara entra al manifiesto.**
 *
 * Un `PanelDeclarado` se abre con `?panel=<id>`, pero el QA visual
 * (`__pulsoNav.paneles().declarados`, `ui-quick-check --panel`) solo recorre lo
 * que está en `PANELES_POR_MODULO`. Un panel declarado y montado que no está
 * ahí es enlazable pero invisible para la auditoría: así quedaron «Orden de la
 * serie» (Carga), «Variables de control» (Material de campo) y «Nuevo filtro»
 * (Formularios) hasta el 2026-10-28.
 *
 * Monitoreo queda fuera mientras lo trabaja su propia sesión: sus paneles se
 * declaran en cada perfil y comparten ids entre perfiles («caso», «publico»).
 * Al llevarlos al manifiesto, se borra la excepción.
 */

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const FUERA_DE_ALCANCE = ["features/monitoreo/"];

const DECLARACION = /export const (\w+): PanelDeclarado = \{\s*id: "([^"]+)"/g;

function archivos(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = path.join(dir, entrada.name);
    if (entrada.isDirectory()) return archivos(ruta);
    if (!/\.tsx?$/.test(entrada.name) || /\.test\.tsx?$/.test(entrada.name)) return [];
    return [ruta];
  });
}

function declaracionesEnElArbol(): { archivo: string; nombre: string; id: string }[] {
  return archivos(SRC).flatMap((ruta) => {
    const archivo = path.relative(SRC, ruta).split(path.sep).join("/");
    if (FUERA_DE_ALCANCE.some((prefijo) => archivo.startsWith(prefijo))) return [];
    const texto = fs.readFileSync(ruta, "utf8");
    return [...texto.matchAll(DECLARACION)].map(([, nombre, id]) => ({ archivo, nombre, id }));
  });
}

describe("paneles declarados", () => {
  const enManifiesto = new Set(
    Object.values(PANELES_POR_MODULO).flatMap((lista) => (lista ?? []).map((panel) => panel.id)),
  );
  const declarados = declaracionesEnElArbol();

  test("el escáner encuentra las declaraciones", () => {
    // Si el patrón deja de casar (otra forma de declarar), el contrato no
    // puede quedar verde por no ver nada.
    expect(declarados.length).toBeGreaterThanOrEqual(45);
  });

  test("cada panel declarado fuera de Monitoreo está en PANELES_POR_MODULO", () => {
    const faltan = declarados
      .filter(({ id }) => !enManifiesto.has(id))
      .map(({ archivo, nombre, id }) => `${nombre} (id «${id}») en ${archivo}`);
    expect(faltan).toEqual([]);
  });
});
