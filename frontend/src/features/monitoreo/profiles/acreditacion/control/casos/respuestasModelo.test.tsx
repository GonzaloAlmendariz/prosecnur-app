import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { MonitoreoInternalQueries, MonitoreoInternalQueryCase } from "../../../../../../api/client";
import { conteoDeFaceta, filtrarRespuestas, respuestasDe } from "./respuestasModelo";
import { Respuestas } from "./Respuestas";

function caso(id: string, estado: string, advancement: string, fecha: string, channel = "Correo"): MonitoreoInternalQueryCase {
  return { response_id: id, platform_state: estado, advancement, date: fecha, channel, actor: "Egresados", base_result: "Cruzó", source_label: "SurveyMonkey · Egresados" } as unknown as MonitoreoInternalQueryCase;
}

const CASOS = [
  caso("1", "Completa", "effective", "2026-06-10"),
  caso("2", "Parcial", "partial", "2026-06-12", "Telefónico"),
  caso("3", "Rechazo", "refusal", "2026-06-11"),
  caso("", "", "pending", ""),
];

describe("Control › Respuestas", () => {
  const respuestas = respuestasDe(CASOS);

  it("deja fuera a quien no respondió y ordena por la más reciente", () => {
    expect(respuestas.map((r) => r.id)).toEqual(["2", "3", "1"]);
    expect(respuestas.filter((r) => r.cuenta).map((r) => r.id)).toEqual(["1"]);
  });

  it("las facetas cuentan con las demás aplicadas", () => {
    expect(conteoDeFaceta(respuestas, "canal", { cuenta: "No cuenta" })).toEqual([{ valor: "Correo", casos: 1 }, { valor: "Telefónico", casos: 1 }]);
    expect(filtrarRespuestas(respuestas, { estado: "Completa" }).map((r) => r.id)).toEqual(["1"]);
  });

  it("la vista no muestra claves crudas", () => {
    const consultas = { schema: "t", cases: CASOS, issues: [], pending_exit: [], totals: { actor: [], date: [], channel: [], source: [], collector: [] }, flow: { nodes: [], links: [] } } as unknown as MonitoreoInternalQueries;
    const html = renderToStaticMarkup(<Respuestas consultas={consultas} />);
    expect(html).toContain("cuentan en el avance");
    expect(html).not.toMatch(/>[a-z0-9]+([_-][a-z0-9]+)+</);
  });
});
