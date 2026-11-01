import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { TerritorialQuotaObservedCross } from "../../../../../api/client";
import type { UmpPlanificada } from "../../../../../api/monitoreoAsignacionPlanificada";
import { CruceConCoordinacion } from "./CruceConCoordinacion";
import { claveDeCelda, construirCruceConCoordinacion } from "./cruceConCoordinacionModelo";

// 2h parte 2: lo declarado por coordinación contra Kobo, celda por celda.

const cruce = {
  rows: [{ label: "Hombre", total: 3, cells: [] }, { label: "Mujer", total: 2, cells: [] }],
  columns: [{ label: "18-29", total: 4 }, { label: "30-44", total: 1 }],
} as unknown as TerritorialQuotaObservedCross;

const ump = (sexo: Array<[string, number]>, edad: Array<[string, number]>) => ({
  idManzana: "M1",
  coordinacionPorSexo: sexo.map(([celda, valor]) => ({ celda, valor })),
  coordinacionPorEdad: edad.map(([celda, valor]) => ({ celda, valor })),
}) as unknown as UmpPlanificada;

describe("cruce con coordinación", () => {
  it("empareja H/M con Hombre/Mujer y «18 a 29» con «18-29»", () => {
    expect(claveDeCelda("H", "Sexo")).toBe(claveDeCelda("Hombre", "Sexo"));
    expect(claveDeCelda("18 a 29", "Edad")).toBe(claveDeCelda("18-29", "Edad"));
    expect(claveDeCelda("60 o más", "Edad")).toBe(claveDeCelda("60+", "Edad"));
  });

  it("marca las celdas que no cuadran, por marginal y sin sumar", () => {
    const m = construirCruceConCoordinacion(cruce, ump([["H", 3], ["M", 3]], [["18 a 29", 4], ["30 a 44", 1]]));
    expect(m.estado).toBe("listo");
    if (m.estado !== "listo") return;
    expect(m.noCuadran).toBe(1);
    expect(m.marginales[0].celdas.find((c) => c.celda === "Mujer")).toMatchObject({ coordinacion: 3, kobo: 2, diferencia: 1 });
    expect(m.marginales[1].noCuadran).toBe(0);
  });

  it("una celda que coordinación anota y Kobo no tiene también se ve", () => {
    const m = construirCruceConCoordinacion(cruce, ump([], [["60+", 2]]));
    if (m.estado !== "listo") throw new Error("debía estar listo");
    expect(m.marginales).toHaveLength(1);
    expect(m.marginales[0].celdas.at(-1)).toMatchObject({ celda: "60+", coordinacion: 2, kobo: 0, diferencia: 2 });
  });

  it("sin registro lo dice; con diferencias pinta la alerta", () => {
    expect(construirCruceConCoordinacion(cruce, ump([], [])).estado).toBe("sin-registro");
    const html = renderToStaticMarkup(
      <CruceConCoordinacion modelo={construirCruceConCoordinacion(cruce, ump([["H", 3], ["M", 3]], []))} ump="12" />,
    );
    expect(html).toContain("1 celda no cuadra");
    expect(html).toContain("+1");
  });
});
