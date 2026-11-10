// Grupos internos pintados (ADR 0135 §6, maqueta Grupos): interruptores (sin casillas) con el tope «N de 4», padrón con
// «Padrón confiable» sólo en los incluidos, el aviso del grupo chico con el texto del pie y la línea «Base:». Sin conteo
// del cruce no hay vista previa de la base.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({ categorias: null as unknown }));
vi.mock("../useCategoriasGrafico", () => ({ useCategoriasGrafico: () => estado.categorias }));
vi.mock("./useGuardaNoConfiables", () => ({ useGuardaNoConfiables: () => true }));

import { GruposPadron } from "./GruposPadron";

const OPCIONES = [{ codigo: "1", etiqueta: "TC" }, { codigo: "2", etiqueta: "TP" }, { codigo: "3", etiqueta: "Contratado" }];
const LISTA = {
  fase: "lista", reintentar: () => undefined,
  datos: { categorias: [{ codigo: "1", n: 24 }, { codigo: "2", n: 91 }, { codigo: "3", n: 139 }] },
};

const pintar = (args: Record<string, unknown>, categorias: unknown = LISTA) => {
  estado.categorias = categorias;
  return renderToStaticMarkup(
    <GruposPadron args={args} cruce="docentes$dedicacion" opciones={OPCIONES} scope="active" onCambio={() => undefined} />,
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
    expect(html).toContain("Base: 24 docentes de TC y 91 de TP");
  });

  it("sin conteo no hay base ni grupo chico", () => {
    const html = pintar({ grupos: ["1", "2"] }, { fase: "cargando", reintentar: () => undefined });
    expect(html).not.toContain("Base:");
    expect(html).not.toContain("Grupo chico");
  });
});
