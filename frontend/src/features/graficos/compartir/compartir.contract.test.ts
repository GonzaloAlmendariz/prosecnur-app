// Contrato de C11/C12 (decisión 10): la lógica de compartir vive una sola vez en `compartir/`; la barra de Láminas y el
// Editor anterior sólo la montan. Lee las fuentes: un mutante que vuelva a copiar la lógica en un header falla aquí.

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const dir = path.dirname(new URL(import.meta.url).pathname);
const graficos = path.join(dir, "..");
const leer = (...p: string[]) => fs.readFileSync(path.join(graficos, ...p), "utf8");

// Marcas de la lógica: llamadas a la API de compartir, parseo y composición del archivo, definición de las secciones.
const LOGICA = [
  /apiGraficosShare(Export|Inspect|Import)\b/,
  /apiGraficosConfig(Export|Import)\b/,
  /JSON\.parse\(/,
  /normalizeGraficosConfig\(/,
  /function (pickGraficosConfigSections|syncGlobalScopeRules|deepMerge)\b/,
  /GRAFICOS_JSON_SECTIONS\s*(:|=)/,
  /invalidateSlideCompositionPersistenceAck\(/,
];

function archivosTs(raiz: string): string[] {
  return fs.readdirSync(raiz, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(raiz, e.name);
    if (e.isDirectory()) return archivosTs(p);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [p] : [];
  });
}

describe("compartir: una sola fuente de lógica", () => {
  it("ni el header del Editor anterior ni la barra de Láminas reimplementan compartir", () => {
    for (const archivo of ["GraficosHeader.tsx", path.join("laminas", "BarraLaminas.tsx")]) {
      const fuente = leer(archivo);
      for (const marca of LOGICA) expect(fuente, `${archivo} contiene ${marca}`).not.toMatch(marca);
      expect(fuente, archivo).toMatch(/from "\.{1,2}\/(\.\.\/)?compartir\/useCompartirPlan"/);
      expect(fuente, archivo).toContain("useCompartirPlan(");
      expect(fuente, archivo).toContain("<PlanPortatilContenido control={compartir} />");
      expect(fuente, archivo).toContain("<SeccionesJsonContenido control={compartir} />");
    }
  });

  it("fuera de compartir/ nadie en Gráficos llama a la API de compartir ni importar", () => {
    const fuera = archivosTs(graficos).filter((p) => !p.includes(`${path.sep}compartir${path.sep}`));
    const culpables = fuera.filter((p) => /apiGraficosShare(Export|Inspect|Import)\b|apiGraficosConfigImport\b/.test(fs.readFileSync(p, "utf8")));
    expect(culpables.map((p) => path.relative(graficos, p))).toEqual([]);
  });

  it("las acciones respetan la disponibilidad del alcance antes de correr", () => {
    const hook = fs.readFileSync(path.join(dir, "useCompartirPlan.ts"), "utf8");
    for (const [accion, clave] of [
      ["exportarJson", "exportarJson"],
      ["prepararImportacion", "importarJson"],
      ["confirmarImportacion", "importarJson"],
      ["exportarPlan", "planPortatil"],
      ["inspeccionarPlan", "planPortatil"],
      ["confirmarPlan", "planPortatil"],
    ] as const) {
      const inicio = hook.indexOf(`const ${accion} = useCallback(`);
      expect(inicio, accion).toBeGreaterThan(0);
      const cuerpo = hook.slice(inicio, hook.indexOf("despachar({ tipo: \"inicio\"", inicio));
      expect(cuerpo, accion).toContain(`disponibilidadRef.current.${clave}.habilitado`);
    }
  });
});
