import fs from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { PROSECNUR_MODULES } from "../../lib/modules";
import { identidadDeFase } from "./identidadDeFase";

/**
 * Contrato de identidad de las etapas (ADR 0047).
 *
 * El catálogo de fases vive en R (`api/R/bitacora_fases.R`) y el manifiesto de
 * módulos en TS (`lib/modules.ts`). Nada obliga a que coincidan salvo este
 * test: si alguien renombra un slug de módulo o retira uno, las etapas del
 * cronograma perderían su sello en silencio y volverían a ser abstracciones.
 */
const CATALOGO_R = fileURLToPath(
  new URL("../../../../api/R/bitacora_fases.R", import.meta.url),
);

/**
 * Extrae los pares (modulo, seccion) del catálogo de R.
 *
 * Se acota al cuerpo de `.bit_fases_catalogo` a propósito: el archivo tiene
 * más adelante un `list(modulo = "", seccion = "")` como valor de fallback, y
 * un barrido del archivo entero lo contaría como una séptima etapa.
 */
function fasesDeclaradasEnR(): Array<{ modulo: string; seccion: string }> {
  const fuente = fs.readFileSync(CATALOGO_R, "utf8");
  const desde = fuente.indexOf(".bit_fases_catalogo <- function()");
  const hasta = fuente.indexOf("BITACORA_FASES <-", desde);
  const bloque = fuente.slice(desde, hasta === -1 ? undefined : hasta);

  const out: Array<{ modulo: string; seccion: string }> = [];
  const re = /modulo\s*=\s*"([^"]*)"\s*,\s*seccion\s*=\s*"([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(bloque)) !== null) {
    out.push({ modulo: m[1], seccion: m[2] });
  }
  return out;
}

describe("identidad de las etapas del cronograma", () => {
  it("el catálogo de R declara las cinco etapas con módulo", () => {
    const fases = fasesDeclaradasEnR();
    expect(fases).toHaveLength(5);
    expect(fases.every((f) => f.modulo.length > 0)).toBe(true);
  });

  it("cada módulo declarado en R existe en el manifiesto del frontend", () => {
    const slugs = new Set(PROSECNUR_MODULES.map((m) => m.slug));
    const huerfanos = fasesDeclaradasEnR()
      .map((f) => f.modulo)
      .filter((slug) => !slugs.has(slug as never));
    expect(huerfanos, "módulos de bitacora_fases.R ausentes en modules.ts").toEqual([]);
  });

  it("cada sección declarada en R existe dentro de su módulo", () => {
    const rotas = fasesDeclaradasEnR()
      .filter((f) => f.seccion)
      .filter((f) => {
        const modulo = PROSECNUR_MODULES.find((m) => m.slug === f.modulo);
        return !modulo?.sections.some((s) => s.id === f.seccion);
      })
      .map((f) => `${f.modulo}/${f.seccion}`);
    expect(rotas, "secciones declaradas que no existen").toEqual([]);
  });

  it("resuelve ícono, destino y acento de un módulo", () => {
    const id = identidadDeFase("monitoreo");
    expect(id.modulo?.slug).toBe("monitoreo");
    expect(id.icono).toBeTruthy();
    expect(id.href).toBe("/monitoreo");
    expect(id.etiquetaModulo).toBe("Monitoreo");
    expect(id.vars).toBeTruthy();
  });

  it("cuando hay sección, el destino y la etiqueta son los de la sección", () => {
    const id = identidadDeFase("procesamiento", "carga");
    expect(id.seccion?.id).toBe("carga");
    expect(id.etiquetaModulo).toContain("·");
    // Carga tiene ruta propia (`/carga`), no un query param: el destino se toma
    // del manifiesto, no se construye a mano.
    expect(id.href).toBe(id.seccion?.to);
    expect(id.href.length).toBeGreaterThan(1);
  });

  it("un módulo inexistente da identidad vacía en vez de un ícono inventado", () => {
    // Una etapa sin módulo real debe verse neutra: disfrazarla de otra cosa
    // sería peor que no tener sello.
    const id = identidadDeFase("modulo-que-no-existe");
    expect(id.modulo).toBeNull();
    expect(id.icono).toBeNull();
    expect(id.href).toBe("");
    expect(id.vars).toBeUndefined();
  });

  it("sin slug devuelve identidad vacía", () => {
    expect(identidadDeFase(undefined).modulo).toBeNull();
    expect(identidadDeFase("").modulo).toBeNull();
  });

  it("las cinco etapas resuelven a cinco íconos distintos", () => {
    // El color puede repetirse —Procesamiento y Entregables son dos secciones
    // del mismo módulo y compartir el teal es lo honesto— pero el ícono no: es
    // lo que le queda al usuario para distinguirlas de un vistazo.
    const iconos = fasesDeclaradasEnR().map(
      (f) => identidadDeFase(f.modulo, f.seccion).icono,
    );
    expect(iconos.every(Boolean)).toBe(true);
    expect(new Set(iconos).size).toBe(5);
  });

  it("cada etapa lleva a un destino propio", () => {
    const destinos = fasesDeclaradasEnR().map(
      (f) => identidadDeFase(f.modulo, f.seccion).href,
    );
    expect(destinos.every((d) => d.length > 1)).toBe(true);
    expect(new Set(destinos).size).toBe(5);
  });

  it("la etiqueta corta distingue etapas que comparten módulo", () => {
    // Procesamiento y Entregables viven ambas en el módulo Procesamiento: si la
    // etiqueta compacta mostrara el módulo, las dos dirían lo mismo.
    const cortas = fasesDeclaradasEnR().map(
      (f) => identidadDeFase(f.modulo, f.seccion).etiquetaCorta,
    );
    expect(new Set(cortas).size).toBe(5);
    expect(identidadDeFase("procesamiento", "carga").etiquetaCorta).toBe("Carga");
    expect(identidadDeFase("procesamiento", "graficos").etiquetaCorta).toBe("Gráficos");
    // Sin sección, la pieza más específica es el módulo.
    expect(identidadDeFase("monitoreo").etiquetaCorta).toBe("Monitoreo");
  });
});
