import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CalcMuestraComponente } from "../../../../api/calcMuestra";
import type { CalcMuestraGeneralCorrida } from "../../../../api/calcMuestraGeneral";
import { tecnicaCalculadaLabel, tecnicaLabel } from "../catalogos";
import { FichaCorrida } from "../FichaCorrida";
import { nombreDeCorrida } from "../tituloCorrida";

const corrida = (over: {
  metodo?: CalcMuestraGeneralCorrida["corrida"]["metodo"];
  modalidad?: CalcMuestraGeneralCorrida["corrida"]["modalidad"];
  claves?: string[];
} = {}): CalcMuestraGeneralCorrida => ({
  corrida: {
    run_id: "r1", semilla: 20260924, rng_kind: "", r_version: "", metodo: over.metodo ?? "mas",
    modalidad: over.modalidad ?? "probabilistica", marco_hash: "h", config_hash: "c", N: 2000,
    n_titulares: 300, n_reservas: 0, piso_incumplible: false, reservas_omitidas_pps: false,
  },
  estratos: (over.claves ?? ["Cercado", "Cayma"]).map((clave) => ({ clave, N_h: 1000, n_h: 150, n_reservas: 0, arranque: null, pi: 0.15 })),
  unidades: [],
  n_fuente: 300,
  componente_id: "c1",
  sorteado_at: "2026-09-24T06:00:00Z",
});

const comp = (
  tecnica: CalcMuestraComponente["tecnica"],
  asignacion: { parametros?: "proporcional" | "neyman"; resultado?: "proporcional" | "neyman" } = {},
) => ({
  id: "c1",
  tecnica,
  parametros: asignacion.parametros ? { asignacion: asignacion.parametros } : {},
  resultado: asignacion.resultado ? { n_operativo: 300, asignacion: asignacion.resultado } : { n_operativo: 300 },
}) as unknown as CalcMuestraComponente;

describe("nombre de la corrida en su ficha", () => {
  it("estratificado con Neyman: el diseño manda y MAS es lo que pasa dentro del estrato", () => {
    const n = nombreDeCorrida(corrida(), comp("prob_estratificado", { resultado: "neyman" }));
    expect(n.titulo).toBe("Estratificado (Neyman) · MAS dentro de cada estrato · semilla 20260924");
    expect(n.modalidad).toBe("Probabilística · Estratificado (Neyman) · MAS dentro de cada estrato");
  });

  it("la asignación del resultado gana a la declarada; sin resultado, la declarada; sin nada, proporcional", () => {
    expect(nombreDeCorrida(corrida(), comp("prob_estratificado", { parametros: "neyman", resultado: "proporcional" })).titulo)
      .toMatch(/^Estratificado \(proporcional\)/);
    expect(nombreDeCorrida(corrida(), comp("prob_estratificado", { parametros: "neyman" })).titulo)
      .toMatch(/^Estratificado \(Neyman\)/);
    expect(nombreDeCorrida(corrida({ metodo: "sistematico" }), comp("prob_estratificado")).titulo)
      .toBe("Estratificado (proporcional) · Sistemático dentro de cada estrato · semilla 20260924");
  });

  it("sin estratos en el marco, o con otra técnica, se titula por el método", () => {
    expect(nombreDeCorrida(corrida({ claves: ["(total)"] }), comp("prob_estratificado", { resultado: "neyman" })).titulo)
      .toBe("MAS · semilla 20260924");
    const mas = nombreDeCorrida(corrida(), comp("prob_aleatorio_simple"));
    expect(mas).toEqual({ titulo: "MAS · semilla 20260924", modalidad: "Probabilística · MAS" });
  });

  it("un censo sigue siendo cobertura censal", () => {
    expect(nombreDeCorrida(corrida({ modalidad: "censo" }), comp("intencion_censal")))
      .toEqual({ titulo: "Cobertura censal · semilla 20260924", modalidad: "Censo" });
  });

  it("la ficha pinta el título y la modalidad del diseño", () => {
    const html = renderToStaticMarkup(<FichaCorrida corrida={corrida()} componente={comp("prob_estratificado", { resultado: "neyman" })} />);
    expect(html).toContain("Estratificado (Neyman) · MAS dentro de cada estrato · semilla 20260924");
    expect(html).toContain("<dd>Probabilística · Estratificado (Neyman) · MAS dentro de cada estrato</dd>");
    expect(html).not.toContain(">MAS · semilla");
  });
});

describe("rótulo de la técnica", () => {
  it("el estratificado ya no se llama proporcional por defecto", () => {
    expect(tecnicaLabel("prob_estratificado")).toBe("Estratificado");
  });

  it("una técnica calculada lleva su asignación", () => {
    expect(tecnicaCalculadaLabel(comp("prob_estratificado", { resultado: "neyman" }))).toBe("Estratificado · Neyman");
    expect(tecnicaCalculadaLabel(comp("prob_estratificado"))).toBe("Estratificado · proporcional");
    expect(tecnicaCalculadaLabel(comp("prob_aleatorio_simple"))).toBe("Probabilístico clásico");
  });
});
