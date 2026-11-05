import { describe, expect, test } from "vitest";
import type { ProjectOverview } from "../../../api/overview";
import type { PonderacionConfig } from "../store";
import { poblacionInferida, poblacionVigente } from "./poblacionReferenciaModel";

const ov = (familia: string, hojas: string): ProjectOverview => ({
  metrics: { monitoring_family: familia },
  modules: [{ id: "hojas-ruta", state: hojas }],
} as unknown as ProjectOverview);
const POND: PonderacionConfig = { enabled: true, rake: { margins: [] } };

describe("población de referencia de la ponderación", () => {
  test("territorial por Monitoreo o por Hojas de ruta con trabajo", () => {
    expect(poblacionInferida(ov("territorial", "pending"))).toBe("territorio");
    expect(poblacionInferida(ov("", "ready"))).toBe("territorio");
  });

  test("universidad o acreditación: marco propio, sin metas del censo", () => {
    expect(poblacionInferida(ov("acreditacion", "pending"))).toBe("marco");
    expect(poblacionInferida(ov("aulas", "pending"))).toBe("marco");
  });

  test("lo elegido manda sobre lo inferido y se marca como elegido", () => {
    expect(poblacionVigente({ ...POND, poblacion: "marco" }, ov("territorial", "ready"))).toEqual({ valor: "marco", inferida: false });
    expect(poblacionVigente(POND, ov("territorial", "pending"))).toEqual({ valor: "territorio", inferida: true });
    expect(poblacionVigente(POND, null)).toEqual({ valor: "marco", inferida: true });
  });
});
