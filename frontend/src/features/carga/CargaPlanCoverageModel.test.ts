import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { EstudioBase } from "../../api/client";
import { coverageSummary } from "./CargaPlanCoverageModel";
import { CargaPlanOverview } from "./CargaPlanOverview";
import type { CargaTopologyResolution } from "./CargaTopologyModel";

const variasPlaneadas: CargaTopologyResolution = {
  mode: "multi",
  strategy: null,
  status: "planned",
  modeLocked: false,
  strategyLocked: false,
};

describe("Carga › Plan › Qué tiene cada base (F9)", () => {
  it("con «Varias bases» sobre una carga simple, la base existente sigue en la tabla", () => {
    const out = coverageSummary({ topology: variasPlaneadas, bases: [], hasInstrument: true, hasData: true });
    expect(out.baseCount).toBe(1);
    expect(out.instrumentCount).toBe(1);
    expect(out.dataCount).toBe(1);
    expect(out.rows[0]).toMatchObject({ label: "Base del estudio", state: "ready" });

    const html = renderToStaticMarkup(createElement(CargaPlanOverview, {
      topology: variasPlaneadas,
      bases: [],
      hasInstrument: true,
      hasData: true,
      pendingChoiceMapping: false,
      allReady: true,
    }));
    expect(html).not.toContain("Aún no hay bases creadas");
    expect(html).toContain("Base que ya tiene el estudio");
  });

  it("sin insumos el plan de varias bases sigue vacío", () => {
    const out = coverageSummary({ topology: variasPlaneadas, bases: [], hasInstrument: false, hasData: false });
    expect(out.rows).toEqual([]);
    expect(out.baseCount).toBe(0);
  });

  it("con bases del estudio manda la lista real", () => {
    const base = { nombre: "b2026", xlsform_file_id: "x", data_file_id: null } as unknown as EstudioBase;
    const out = coverageSummary({ topology: variasPlaneadas, bases: [base], hasInstrument: true, hasData: true });
    expect(out.rows.map((r) => r.key)).toEqual(["b2026"]);
    expect(out.dataCount).toBe(0);
  });

  it("topología por definir no tiene filas", () => {
    const out = coverageSummary({
      topology: { ...variasPlaneadas, mode: "undecided", status: "undefined" },
      bases: [],
      hasInstrument: true,
      hasData: true,
    });
    expect(out.rows).toEqual([]);
  });
});
