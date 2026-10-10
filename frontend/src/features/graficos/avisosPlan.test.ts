import { describe, expect, it, vi } from "vitest";
import { agruparAvisos, totalAvisos } from "./laminas/resumenInforme";

describe("avisos del plan al abrirlo", () => {
  it("el store los guarda por sesión sin repetir, anuncia sólo los nuevos y Láminas los cuenta", async () => {
    vi.resetModules();
    const emitidos: string[] = [];
    vi.doMock("../../components/toasterStore", () => ({
      toast: { aviso: (m: string, extra?: { detalle?: string; duracion?: number }) => { emitidos.push(`${m}|${extra?.duracion}`); return "t"; } },
    }));
    const { publicarAvisosConfig } = await import("../../api/graficosAvisosConfig");
    // El calentamiento publica antes de que cargue el código de Gráficos.
    publicarAvisosConfig("s1", ["Lámina 3 migrada"]);
    const { useAvisosPlan } = await import("./avisosPlan");
    expect(useAvisosPlan.getState().porSesion.s1).toEqual(["Lámina 3 migrada"]);
    // Un toast que no se cierra solo, para el Editor anterior.
    expect(emitidos).toEqual(["El plan de gráficos cambió al abrirlo|0"]);

    publicarAvisosConfig("s1", ["Lámina 3 migrada", "Lámina 9 migrada"]);
    expect(useAvisosPlan.getState().porSesion.s1).toEqual(["Lámina 3 migrada", "Lámina 9 migrada"]);
    expect(emitidos).toHaveLength(2);
    publicarAvisosConfig("s2", ["otra"]);
    expect(useAvisosPlan.getState().porSesion.s1).toHaveLength(2);

    const g = agruparAvisos([], {}, [], useAvisosPlan.getState().porSesion.s1);
    expect(g.plan).toHaveLength(2);
    expect(totalAvisos(g)).toBe(2);
    vi.doUnmock("../../components/toasterStore");
  });
});
