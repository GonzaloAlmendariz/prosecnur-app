// Grupos internos pintados (ADR 0135 §6, maqueta Grupos): interruptores (sin casillas) con el tope «N de 4», padrón con
// «Padrón confiable» sólo en los incluidos, el aviso del grupo chico con el texto del pie y la línea «Base:». Sin conteo
// del cruce no hay vista previa de la base.
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { PadronPropuesto } from "../../../../api/graficosPadron";

const estado = vi.hoisted(() => ({ categorias: null as unknown, propuestas: [] as PadronPropuesto[] }));
vi.mock("../useCategoriasGrafico", () => ({ useCategoriasGrafico: () => estado.categorias }));
vi.mock("./useGuardaNoConfiables", () => ({ useGuardaNoConfiables: () => true }));
vi.mock("./usePadronPropuesto", () => ({
  usePadronPropuesto: () => ({ fase: "lista", propuestas: estado.propuestas, reintentar: () => undefined }),
  propuestasDe: (e: { propuestas: PadronPropuesto[] }) => e.propuestas,
}));
vi.mock("../../../estudio/usePlannerModos", () => ({
  usePlannerModos: () => ({ modos: { calc: { modo: "opinion-universitaria" }, monitoreo: { modos: [] } }, error: null, recargar: async () => undefined }),
}));

import { GruposPadron } from "./GruposPadron";

const OPCIONES = [{ codigo: "1", etiqueta: "TC" }, { codigo: "2", etiqueta: "TP" }, { codigo: "3", etiqueta: "Contratado" }];
const LISTA = {
  fase: "lista", reintentar: () => undefined,
  datos: { categorias: [{ codigo: "1", n: 24 }, { codigo: "2", n: 91 }, { codigo: "3", n: 139 }] },
};

const pintar = (args: Record<string, unknown>, categorias: unknown = LISTA) => {
  estado.categorias = categorias;
  return renderToStaticMarkup(
    <MemoryRouter>
      <GruposPadron args={args} cruce="docentes$dedicacion" opciones={OPCIONES} scope="active" onCambio={() => undefined} />
    </MemoryRouter>,
  );
};

describe("GruposPadron", () => {
  it("interruptores, tope, padrón de los incluidos, grupo chico y base", () => {
    const html = pintar({ grupos: ["1", "2"], universos: "TP: 103" });
    expect(html).toContain('data-qa-geometry-group="graficos/f6-grupos-padron"');
    expect(html).not.toContain('type="checkbox"');
    expect(html).toContain("2 de 4");
    expect((html.match(/role="switch"/g) ?? []).length).toBe(3 + 2);
    expect(html).toContain('aria-label="Padrón de TP"');
    expect(html).not.toContain('aria-label="Padrón de Contratado"');
    expect(html).toContain("Grupo chico: 24 docentes TC.");
    expect(html).toContain("Base: TC 24; TP 91 (88%)");
    expect(html).toContain('data-cobertura="en-base">Cobertura 88%');
    expect(html).toContain('aria-label="Lugar 1 de 2 en la lámina"');
    expect(html).toContain('aria-label="Subir TP"');
    expect(html).toContain("Diferencia: TC menos TP");
    expect(html).not.toContain('aria-label="Subir Contratado"');
  });

  it("sin conteo no hay base ni grupo chico", () => {
    const html = pintar({ grupos: ["1", "2"] }, { fase: "cargando", reintentar: () => undefined });
    expect(html).not.toContain("Base:");
    expect(html).not.toContain("Grupo chico");
  });

  it("X5: el grupo sin padrón se nombra con el enlace al marco; el padrón de la base va como referencia", () => {
    estado.propuestas = [{
      base: "docentes", padron: 254, padron_origen: "Cálculo de muestra: marco validado (Docentes)",
      meta: null, meta_unidad: null, meta_origen: "", motivo: "",
    }];
    const html = pintar({ grupos: ["1", "2"], universos: "TP: 103" });
    expect(html).toContain("Padrón de Docentes: 254");
    expect(html).toContain("Sin padrón: TC. La base va sólo con n.");
    expect(html).toContain('href="/calc-muestra?modo=opinion-universitaria"');
    expect(html).toContain("Ver el marco en Cálculo de muestra");
    const completo = pintar({ grupos: ["1", "2"], universos: "TC: 30; TP: 103" });
    expect(completo).not.toContain("Sin padrón:");
    expect(completo).toContain("Padrón de Docentes: 254");
    estado.propuestas = [];
  });
});
