import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { MonitoreoAulasAvanceCuota } from "../../../../api/monitoreo";
import { AulasAvanceParaCliente } from "./AulasAvanceParaCliente";

/**
 * La muestra del estudio no es la suma de las cuotas por facultad.
 *
 * Medido el 2026-08-29 sobre HSVG2026: el diseño declara `n_objetivo = 2500`,
 * las quince filas suman 3.491 —una cuota por celda no se netea entre celdas,
 * ADR 0079— y este panel, que se llama «El avance que ve el cliente», abría
 * diciendo «De una muestra de 3.491 alumnos». Ni el objetivo (2.500) ni el
 * operativo (3.750). El motor publica el total en `avance_cuota$total$cuota` y
 * el panel lo resumaba en vez de leerlo.
 */

const cuota = (total: number | null, filas: Array<[string, number, number]>) => ({
  schema: "monitoreo_aulas_avance_cuota_v1",
  fuente: "design_targets",
  vigencia: "vigente",
  motivo: "",
  tasa_esperada: 0.53,
  tasa_fuente: "tau_disenio",
  total: {
    cuota: total,
    respuestas_validas: filas.reduce((s, f) => s + f[2], 0),
    brecha: 0,
    avance_pct: 0,
    fuera_universo: 0,
    huerfanas: 0,
  },
  facultades: filas.map(([facultad, c, v]) => ({
    facultad,
    faculty_key: facultad.toLowerCase(),
    cuota: c,
    respuestas_validas: v,
  })),
}) as unknown as MonitoreoAulasAvanceCuota;

// El separador de miles depende del ICU del runner —sin él `toLocaleString`
// degrada a inglés y sale «2,500» donde la app pinta «2 500»—, así que se
// compara sobre los dígitos pelados. Afirmar la coma o el espacio da rojos
// falsos que no dicen nada del componente.
const pinta = (c: MonitoreoAulasAvanceCuota) =>
  renderToStaticMarkup(<AulasAvanceParaCliente avanceCuota={c} />)
    .replace(/(\d)[\s,.\u00a0\u202f](?=\d{3}\b)/g, "$1");

describe("la muestra que enseña el panel del cliente", () => {
  // Dos facultades cuyas cuotas suman 3.400 con un objetivo declarado de 2.500:
  // el reparto con mínimos por celda sobrepasa el objetivo, que es justo lo que
  // pasa en el estudio real.
  const filas: Array<[string, number, number]> = [["Derecho", 2000, 400], ["Gestion", 1400, 267]];

  it("usa el total del motor, no la suma de sus filas", () => {
    const html = pinta(cuota(2500, filas));
    expect(html).toContain("2500");
    expect(html).not.toContain("3400");
  });

  it("cuando el motor no puede afirmar un total, cae a la suma y no inventa", () => {
    // `cuota: null` es el caso declarado del contrato («NA»). Ahí la suma de
    // filas es lo mejor que hay y callarla sería peor.
    const html = pinta(cuota(null, filas));
    expect(html).toContain("3400");
  });

  it("los faltantes SIGUEN sumándose sin netear", () => {
    // El control del arreglo: si alguien «armonizara» también los faltantes con
    // `total.brecha`, que viene neteada, se perdería el ADR 0079. Con 2.500 de
    // objetivo y 667 conseguidas, la resta neta daría 1.833; lo correcto es la
    // suma por facultad: (2000−400) + (1400−267) = 2.733.
    expect(pinta(cuota(2500, filas))).toContain("2733");
  });
});
