// C11/C12 en el menú ⋯ de Láminas (decisión 10) y deshabilitados con motivo en el informe compartido (decisión 20).
// Sin DOM: el modelo de ítems, el markup estático de los cuerpos y la fuente de la barra.

import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { disponibilidadCompartir, MOTIVO_IMPORTAR_JSON_CONSOLIDADO, MOTIVO_PLAN_PORTATIL_CONSOLIDADO } from "./disponibilidadCompartir";
import { itemsCompartirMenu } from "./menuCompartir";
import { PlanPortatilContenido } from "./PlanPortatilContenido";
import { SeccionesJsonContenido } from "./SeccionesJsonContenido";
import { ESTADO_COMPARTIR_INICIAL } from "./compartirReducer";
import type { ControlCompartir } from "./useCompartirPlan";
import { PANEL_PLAN_PORTATIL, PANEL_SECCIONES_JSON, PANELES_GRAFICOS } from "../panelesGraficos";

const dir = path.dirname(new URL(import.meta.url).pathname);

function control(scope: "active" | "consolidated"): ControlCompartir {
  const nada = vi.fn();
  const asinc = vi.fn(async () => undefined);
  return {
    estado: ESTADO_COMPARTIR_INICIAL,
    disponibilidad: disponibilidadCompartir(scope),
    nSecciones: 9,
    totalSecciones: 9,
    basesElegidas: [],
    elegirSeccion: nada, elegirTodas: nada, elegirModo: nada, alternarAvanzado: nada, elegirBase: nada,
    exportarJson: asinc, prepararImportacion: asinc, confirmarImportacion: asinc,
    exportarPlan: asinc, inspeccionarPlan: asinc, pedirConfirmarPlan: nada, confirmarPlan: asinc, cancelarConfirmacion: nada,
  };
}

const botones = (html: string) => [...html.matchAll(/<button([^>]*)>(.*?)<\/button>/g)].map((m) => ({ attrs: m[1], texto: m[2].replace(/<[^>]+>/g, "") }));

describe("menú ⋯ de Láminas: plan portátil y secciones JSON", () => {
  it("ofrece las dos acciones, cada una con su panel declarado", () => {
    const items = itemsCompartirMenu(disponibilidadCompartir("active"));
    expect(items.map((i) => [i.clave, i.panel.id, i.habilitado])).toEqual([
      ["plan-portatil", "plan-portatil", true],
      ["secciones-json", "secciones-json", true],
    ]);
    expect(PANELES_GRAFICOS).toContain(PANEL_PLAN_PORTATIL);
    expect(PANELES_GRAFICOS).toContain(PANEL_SECCIONES_JSON);
  });

  it("en el informe compartido los dos ítems quedan deshabilitados y dicen por qué", () => {
    for (const item of itemsCompartirMenu(disponibilidadCompartir("consolidated"))) {
      expect(item.habilitado, item.clave).toBe(false);
      expect(item.detalle, item.clave).toMatch(/^El informe compartido no se comparte por base: /);
    }
  });

  it("la barra pinta los ítems del modelo y abre cada panel; el ítem viejo «Compartir… en el Editor anterior» ya no está", () => {
    const fuente = fs.readFileSync(path.join(dir, "..", "laminas", "BarraLaminas.tsx"), "utf8");
    expect(fuente).toContain("itemsCompartirMenu(compartir.disponibilidad)");
    expect(fuente).toContain("usePanelDireccionable(PANEL_PLAN_PORTATIL)");
    expect(fuente).toContain("usePanelDireccionable(PANEL_SECCIONES_JSON)");
    expect(fuente).toMatch(/compartir\.map\(\(accion\) => \(\s*<button[^>]*role="menuitem"/);
    expect(fuente).toContain('"aria-disabled": true');
    expect(fuente).toContain("useCompartirPlan(reportScope)");
    expect(fuente).not.toContain("Compartir, importar o vaciar el plan");
  });
});

describe("cuerpos de los diálogos según el alcance", () => {
  it("plan portátil: en una base las acciones están habilitadas y sin motivo", () => {
    const html = renderToStaticMarkup(<PlanPortatilContenido control={control("active")} />);
    const acciones = botones(html).filter((b) => /Exportar plan|Importar plan/.test(b.texto));
    expect(acciones).toHaveLength(2);
    for (const b of acciones) expect(b.attrs).not.toMatch(/disabled=""/);
    expect(html).not.toContain(MOTIVO_PLAN_PORTATIL_CONSOLIDADO);
  });

  it("plan portátil: en el informe compartido se deshabilitan, con el motivo enlazado", () => {
    const html = renderToStaticMarkup(<PlanPortatilContenido control={control("consolidated")} />);
    const acciones = botones(html).filter((b) => /Exportar plan|Importar plan/.test(b.texto));
    expect(acciones).toHaveLength(2);
    const id = html.match(/<p id="([^"]+)" class="pulso-f6-compartir-motivo">/)?.[1];
    expect(id).toBeTruthy();
    for (const b of acciones) {
      expect(b.attrs).toMatch(/disabled=""/);
      expect(b.attrs).toContain(`aria-describedby="${id}"`);
    }
    expect(html).toContain(MOTIVO_PLAN_PORTATIL_CONSOLIDADO);
  });

  it("secciones JSON: en el informe compartido exportar e importar se deshabilitan con motivo", () => {
    const html = renderToStaticMarkup(<SeccionesJsonContenido control={control("consolidated")} />);
    const acciones = botones(html).filter((b) => /componentes/.test(b.texto));
    expect(acciones.map((b) => b.texto.trim())).toEqual(["Exportar componentes", "Importar componentes"]);
    for (const b of acciones) expect(b.attrs).toMatch(/disabled=""/);
    expect(html).toContain(MOTIVO_IMPORTAR_JSON_CONSOLIDADO);
  });

  it("los archivos se eligen con un botón (teclado), no con una etiqueta sin foco", () => {
    for (const html of [
      renderToStaticMarkup(<PlanPortatilContenido control={control("active")} />),
      renderToStaticMarkup(<SeccionesJsonContenido control={control("active")} />),
    ]) {
      expect(html).toMatch(/<input[^>]*type="file"[^>]*hidden=""/);
      expect(html).not.toMatch(/<label(?:(?!<\/label>)[^])*<input[^>]*type="file"/);
    }
  });
});

describe("importar pide confirmación antes de escribir", () => {
  it("con una importación preparada, el cuerpo muestra la confirmación con el modo y el archivo", () => {
    const c = control("active");
    const html = renderToStaticMarkup(<SeccionesJsonContenido control={{
      ...c,
      estado: {
        ...c.estado,
        importacionPendiente: { nombreArchivo: "otro.json", entrante: {}, secciones: c.estado.secciones, seccionIds: ["plan", "paletas"], modo: "replace" },
      },
    }} />);
    expect(html).toContain("¿Reemplazar 2 secciones con «otro.json»?");
    expect(html).toContain("No se puede revertir con Deshacer");
    expect(botones(html).map((b) => b.texto.trim())).toEqual(expect.arrayContaining(["Cancelar", "Reemplazar"]));
  });

  it("sin importación preparada no hay confirmación", () => {
    expect(renderToStaticMarkup(<SeccionesJsonContenido control={control("active")} />)).not.toContain("pulso-f6-compartir-confirmar");
  });
});
