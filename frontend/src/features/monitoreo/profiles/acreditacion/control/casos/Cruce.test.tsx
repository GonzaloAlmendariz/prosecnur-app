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
        { primary_identity_label: "Llave en base", base_result: "Sin respuesta", channel_key_strategy_label: "Base sin respuesta" },
        { primary_identity_label: "Código PUCP declarado", base_result: "Cruzó", channel_key_strategy_label: "Correo: metadata del envío" },
      ],
    } as unknown as MonitoreoInternalQueries;
    const html = renderToStaticMarkup(<Cruce consultas={consultas} />);
    expect(html).toContain("12 registros: 10 personas del padrón y 2 respuestas fuera de él");
    expect(html).toContain("Llave del padrón, sin respuesta");
    expect(html).toContain("Cruzó por llave");
    expect(html).not.toMatch(/>[a-z0-9]+([_-][a-z0-9]+)+</);
  });
});
