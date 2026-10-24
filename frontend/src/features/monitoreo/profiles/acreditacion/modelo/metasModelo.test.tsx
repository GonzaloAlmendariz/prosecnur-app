import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { MonitoreoGoal, MonitoreoState } from "../../../../../api/client";
import { cambios, conCobertura, conMeta, filasDeMetas, metasAGuardar } from "./metasModelo";
import { Metas } from "./Metas";
import { MetasEnEspera } from "./MetasEnEspera";

const PUBLICOS = [
  { actor: "Administrativos", universo: 16, efectivas: 15, meta: 15, variables: [] },
  { actor: "Egresados", universo: 270, efectivas: 178, meta: 108, variables: [] },
];
const GOALS = [
  { filters: { dim_actor: "Administrativos" }, meta: 15, meta_pct: 90 },
  { filters: { dim_actor: "Egresados" }, meta: 108, meta_pct: 40 },
] as unknown as MonitoreoGoal[];

describe("Modelo › Metas", () => {
  const filas = filasDeMetas(PUBLICOS, GOALS);

  it("lee la meta y la cobertura guardadas", () => {
    expect(filas).toEqual([
      { publico: "Administrativos", personas: 16, meta: 15, cobertura: 90 },
      { publico: "Egresados", personas: 270, meta: 108, cobertura: 40 },
    ]);
  });

  it("un meta_pct en cero con meta positiva no es la cobertura: sale de la meta", () => {
    const sinPct = [{ filters: { dim_actor: "Egresados" }, meta: 108, meta_pct: 0 }] as unknown as MonitoreoGoal[];
    expect(filasDeMetas([PUBLICOS[1]], sinPct)).toEqual([{ publico: "Egresados", personas: 270, meta: 108, cobertura: 40 }]);
  });

  it("la cobertura recalcula la meta y al revés, con la regla de la tarjeta de hoy", () => {
    expect(conCobertura(filas[1], "45")).toEqual({ cobertura: "45", meta: "122" });
    expect(conMeta(filas[1], "135")).toEqual({ meta: "135", cobertura: "50" });
  });

  it("guarda solo lo que cambió con el mismo contrato de metas", () => {
    const borradores = { Administrativos: { meta: "15", cobertura: "90" }, Egresados: conCobertura(filas[1], "45") };
    const cambiadas = cambios(filas, borradores);
    expect(cambiadas.map((fila) => fila.publico)).toEqual(["Egresados"]);
    expect(metasAGuardar(GOALS, cambiadas, borradores, "dim_actor")).toEqual([
      { filters: { dim_actor: "Administrativos" }, meta: 15, meta_pct: 90 },
      { filters: { dim_actor: "Egresados" }, meta: 122, meta_pct: 45 },
    ]);
  });

  it("la vista no muestra claves crudas", () => {
    const state = { config: { goals: GOALS }, variables: [] } as unknown as MonitoreoState;
    const html = renderToStaticMarkup(<Metas state={state} publicosDePrueba={PUBLICOS} />);
    expect(html).toContain("Meta del estudio");
    expect(html).toContain("Padrón");
    expect(html).not.toMatch(/>[a-z0-9]+([_-][a-z0-9]+)+</);
  });

  it("sin filas conserva el marco: el aviso va dentro de la tarjeta y la espera muestra el esqueleto", () => {
    const vacio = renderToStaticMarkup(<Metas state={{ config: { goals: [] } } as unknown as MonitoreoState} publicosDePrueba={[]} />);
    expect(vacio).toContain("Meta del estudio");
    expect(vacio).toContain("todavía no tiene públicos");
    expect(vacio).not.toContain("is-esqueleto");
    const leyendo = renderToStaticMarkup(<MetasEnEspera motivo="leyendo" />);
    expect(leyendo).toContain("Leyendo los públicos");
    expect(leyendo).toContain("acr-mo-tarjetas is-esqueleto");
    expect(leyendo).toContain('aria-busy="true"');
  });
});
