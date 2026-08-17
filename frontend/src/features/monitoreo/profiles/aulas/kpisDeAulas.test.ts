import { describe, expect, it } from "vitest";

import type { MonitoreoAulasDashboard } from "../../../../api/monitoreo";
import { cuotasResumen } from "./cuotasResumen";
import { aulasKpis } from "./kpisDeAulas";

/**
 * El KPI de cuota y el panel de Avance no pueden decir cosas distintas.
 *
 * Decían: arriba «2/12» —celdas— y abajo «701 personas por recoger». Las dos
 * cifras eran correctas y juntas se leían como una contradicción, además de
 * contestar en una unidad que no es la del operativo: doce celdas pueden estar a
 * una respuesta o a doscientas y el contador se ve igual.
 */

/** Doce celdas como las del estudio: dos cumplidas y mucha gente por recoger. */
const celdas = [
  { faculty: "Derecho", sex: "F", target: 300, observed: 300 },
  { faculty: "Derecho", sex: "M", target: 100, observed: 100 },
  { faculty: "Ciencias", sex: "F", target: 300, observed: 12 },
  { faculty: "Ciencias", sex: "M", target: 100, observed: 4 },
];

function tablero(extra: Record<string, unknown> = {}): MonitoreoAulasDashboard {
  return {
    kpis: { total_aulas: 196, aulas_aplicadas: 0, respuestas_validas: 3700, brechas: 92 },
    quotas_sex_faculty: celdas,
    ...extra,
  } as unknown as MonitoreoAulasDashboard;
}

function cuotaKpi(tab: MonitoreoAulasDashboard) {
  return aulasKpis(tab).find((k) => k.label.toLowerCase().includes("cuota"));
}

describe("el KPI de cuota", () => {
  it("cuenta personas, no celdas", () => {
    const kpi = cuotaKpi(tablero());
    // 288 + 96 = 384 personas por recoger. Si volviera a contar celdas diría
    // «2/4», que es el defecto que este guard existe para atrapar.
    expect(kpi?.value).toBe("384");
    expect(kpi?.value).not.toContain("/");
  });

  it("dice lo mismo que el panel de Avance", () => {
    // La propiedad, no el número: las dos superficies leen la misma función.
    const general = cuotasResumen(celdas as never).general;
    expect(cuotaKpi(tablero())?.value).toBe(
      new Intl.NumberFormat("es-PE").format(general.faltan),
    );
  });

  it("guarda el detalle sin gastar alto", () => {
    // Va al `title`: la banda es un grupo de marco igual (C2) y una tarjeta con
    // una línea más rompería el marco de las otras cinco.
    expect(cuotaKpi(tablero())?.detalle).toContain("416 de 800 personas");
    expect(cuotaKpi(tablero())?.detalle).toContain("2 de 4 celdas");
    // 800 − 416 son 384 aquí por casualidad; con celdas pasadas de meta no
    // cuadraría, y por eso el detalle dice cómo se suma.
    expect(cuotaKpi(tablero())?.detalle).toContain("celda a celda");
  });

  it("distingue «sin cuotas declaradas» de «cuota cumplida»", () => {
    // Un plan sin cuotas y un plan con todo recogido darían ambos 0 por recoger.
    // «S/D» dice que no hay vara; «0» diría que ya no falta nadie.
    const sinCuotas = cuotaKpi(tablero({ quotas_sex_faculty: [] }));
    expect(sinCuotas?.value).toBe("S/D");
    expect(sinCuotas?.tone).toBe("neutral");

    const cumplida = cuotaKpi(tablero({
      quotas_sex_faculty: [{ faculty: "Derecho", sex: "F", target: 300, observed: 300 }],
    }));
    expect(cumplida?.value).toBe("0");
  });
});
