import { describe, expect, it } from "vitest";
import { ejeDeFechas, ticksDeFechas } from "../../../core/ejeDeFechas";
import { advanceAxisDate } from "./ritmoDiario";

// El ritmo diario del avance rotula con el eje común de Monitoreo: el día bajo
// su barra y el mes debajo sólo donde empieza (Gonzalo, 3/11). Antes era
// «jun<br>30»: el mes arriba y repetido en cada día.
describe("eje de fechas del ritmo diario", () => {
  it("advanceAxisDate lleva cada corte a ISO y el corte sin fecha a S/D", () => {
    expect(advanceAxisDate("30/06/2026")).toBe("2026-06-30");
    expect(advanceAxisDate("2026-07-01")).toBe("2026-07-01");
    expect(advanceAxisDate("Sin fecha")).toBe("S/D");
  });

  it("el día va en cada rótulo y el mes sólo donde empieza; S/D pasa tal cual", () => {
    const fechas = ["30/06/2026", "01/07/2026", "02/07/2026", "Sin fecha"].map(advanceAxisDate);
    expect(ejeDeFechas(fechas, 40)).toEqual([
      { indice: 0, dia: "30", mes: "jun" },
      { indice: 1, dia: "1", mes: "jul" },
      { indice: 2, dia: "2", mes: null },
      { indice: 3, dia: "S/D", mes: null },
    ]);
    expect(ticksDeFechas(fechas, 40).ticktext).toEqual(["30<br><b>jun</b>", "1<br><b>jul</b>", "2", "S/D"]);
  });
});
