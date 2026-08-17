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
  return aulasKpis(tab, "avance").find((k) => k.label.toLowerCase().includes("cuota"));
}

const SECCIONES = ["fuentes", "modelo", "calidad", "consultas", "avance"] as const;

describe("la banda de KPIs", () => {
  it("cada cifra dice de dónde sale o sobre qué se cuenta, en las cinco secciones", () => {
    // El patrón viene de telefónico y acreditación, cuyas tarjetas llevan
    // `hint`. Sin él, «Aplicadas 0» al lado de «Válidas 3 700» se lee como app
    // rota, cuando son dos fuentes distintas: una la declara el aplicador y la
    // otra llega de Kobo.
    const sinPista = SECCIONES.flatMap((s) => aulasKpis(tablero(), s))
      .filter((k) => !k.pista?.trim());
    expect(sinPista.map((k) => k.label)).toEqual([]);
  });

  it("«Aplicadas» dice que la declara el registro, no las respuestas", () => {
    const aplicadas = aulasKpis(tablero(), "modelo").find((k) => k.label === "Aplicadas");
    expect(aplicadas?.value).toBe("0");
    expect(aplicadas?.pista).toContain("registro de campo");
  });

  it("contesta la pregunta de SU sección y no la de otra", () => {
    // La banda mostraba las mismas seis tarjetas en las cinco secciones: en
    // Fuentes presidía la pantalla un «Cuota por recoger» que no decide nada
    // ahí, y en Consultas no había ni una cifra de reemplazos.
    const etiquetas = (s: (typeof SECCIONES)[number]) => aulasKpis(tablero(), s).map((k) => k.label);
    expect(etiquetas("fuentes")).toContain("Respuestas leídas");
    expect(etiquetas("fuentes")).not.toContain("Cuota por recoger");
    expect(etiquetas("consultas")).toContain("Cerraron con reemplazo");
    expect(etiquetas("consultas")).toContain("Cadenas sin cerrar");
    expect(etiquetas("calidad")).toContain("Alertas");
    expect(etiquetas("avance")).toContain("Cuota por recoger");
    expect(etiquetas("avance")).toContain("Cumplen");
  });

  it("las cadenas se cuentan con la misma función que las cuenta abajo", () => {
    // `reemplazos_usados` del motor decía «0» —cuenta reservas cuyo estado
    // operativo salió de «planificada», o sea depende del registro de campo—
    // mientras el panel de al lado decía «3 cerraron con un reemplazo».
    const agenda = [
      { operational_code: "CH 1", sample_role: "titular", faculty: "Derecho", respuestas_validas: 2, expected_valid: 30 },
      { operational_code: "R 1.1", sample_role: "chain_reserve", replacement_for: "CH 1", replacement_order: 1, respuestas_validas: 31, expected_valid: 30 },
    ];
    const kpi = aulasKpis(tablero({ agenda, kpis: { reemplazos_usados: 0 } }), "consultas")
      .find((k) => k.label === "Cerraron con reemplazo");
    expect(kpi?.value).toBe("1");
  });

  it("toda tarjeta lleva ícono", () => {
    // En una banda que cambia por sección, el ícono es lo que deja reconocer de
    // qué habla la cifra sin releer el rótulo. Una tarjeta sin él rompería la
    // rejilla de las otras.
    const sinIcono = SECCIONES.flatMap((s) => aulasKpis(tablero(), s))
      .filter((k) => typeof k.icono !== "function" && typeof k.icono !== "object");
    expect(sinIcono.map((k) => k.label)).toEqual([]);
  });

  it("ninguna sección se queda sin banda", () => {
    // Un `seccion` que no case con ningún `if` devolvería la de Avance por
    // defecto; lo que no puede pasar es una sección vacía, que dejaría la franja
    // superior como un marco sin contenido.
    for (const s of SECCIONES) {
      expect(aulasKpis(tablero(), s).length, `sección ${s}`).toBeGreaterThanOrEqual(3);
    }
  });
});

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
