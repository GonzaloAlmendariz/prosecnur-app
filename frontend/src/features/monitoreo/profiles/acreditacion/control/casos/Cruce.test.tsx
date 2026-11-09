import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { MonitoreoInternalQueries } from "../../../../../../api/client";
import { Cruce } from "./Cruce";

describe("Control › Cruce", () => {
  it("dice los registros del flujo y las listas sin claves crudas", () => {
    const consultas = {
      schema: "test", cases: [], issues: [], pending_exit: [],
      totals: { actor: [], date: [], channel: [], source: [], collector: [] },
      flow: { nodes: [], links: [
        { source: "En base", target: "Correo", value: 10 },
        { source: "Fuera de base", target: "Correo", value: 2 },
        { source: "Correo", target: "Completa", value: 12 },
        { source: "Completa", target: "Incluido en avance", value: 12 },
      ] },
      case_rollup: [
        { primary_identity_label: "Llave en base", base_result: "Cruzó", platform_state: "Sin respuesta", channel_key_strategy_label: "Base sin respuesta" },
        { primary_identity_label: "Código PUCP declarado", base_result: "Cruzó", channel_key_strategy_label: "Correo: metadata del envío" },
      ],
    } as unknown as MonitoreoInternalQueries;
    const html = renderToStaticMarkup(<Cruce consultas={consultas} />);
    expect(html).toContain("12 respuestas");
    // El padrón que no respondió no cuenta como «llave usada»: la vista es de respuestas.
    expect(html).not.toContain("Llave del padrón, sin respuesta");
    expect(html).toContain("Código PUCP declarado");
    expect(html).toContain("Cruzó por llave");
    expect(html).not.toMatch(/>[a-z0-9]+([_-][a-z0-9]+)+</);
  });

  it("con padrón pendiente, el diagrama es de respuestas y el pendiente se dice aparte", () => {
    const consultas = {
      schema: "test", cases: [], issues: [], pending_exit: [],
      totals: { actor: [], date: [], channel: [], source: [], collector: [] },
      flow: { nodes: [], links: [
        { source: "En base", target: "Correo", value: 110 },
        { source: "Correo", target: "Completa", value: 10 },
        { source: "Correo", target: "Sin respuesta", value: 100 },
        { source: "Sin respuesta", target: "Pendiente de respuesta", value: 100 },
        { source: "Completa", target: "Incluido en avance", value: 10 },
      ] },
      case_rollup: [
        { primary_identity_label: "Llave en base", base_result: "Cruzó", platform_state: "Sin respuesta", identity_status: "pendiente_base", channel_key_strategy_label: "Base sin respuesta" },
        { primary_identity_label: "Código PUCP declarado", base_result: "Cruzó", platform_state: "Completa", channel_key_strategy_label: "Correo: metadata del envío" },
      ],
    } as unknown as MonitoreoInternalQueries;
    const html = renderToStaticMarkup(<Cruce consultas={consultas} />);
    expect(html).toContain("10 respuestas");
    expect(html).toContain("100 del padrón sin responder");
    expect(renderToStaticMarkup(<Cruce consultas={{ ...consultas, case_rollup: [{ primary_identity_label: "Llave usada", base_result: "Cruzó", platform_state: "Completa" }] } as unknown as MonitoreoInternalQueries} />)).toContain("Llave configurada");
    expect(html).not.toContain("Base sin respuesta");
  });

  it('una lectura de una sola categoría va como dato en "Cómo se cruzó", sin barra', () => {
    const consultas = {
      schema: "test", cases: [], issues: [], pending_exit: [],
      totals: { actor: [], date: [], channel: [], source: [], collector: [] },
      flow: { nodes: [], links: [{ source: "En base", target: "Correo", value: 3 }, { source: "Correo", target: "Completa", value: 3 }] },
      case_rollup: [
        { primary_identity_label: "Llave usada", base_result: "Cruzó", platform_state: "Completa", channel_key_strategy_label: "Correo: metadata del envío" },
        { primary_identity_label: "Llave usada", base_result: "Cruzó", platform_state: "Completa", channel_key_strategy_label: "Correo: metadata del envío" },
      ],
    } as unknown as MonitoreoInternalQueries;
    const html = renderToStaticMarkup(<Cruce consultas={consultas} />);
    expect(html).toContain("Cómo se cruzó");
    expect(html).toContain("acr-cr-datos");
    expect(html).not.toContain('aria-label="Llave usada"');
  });
});
