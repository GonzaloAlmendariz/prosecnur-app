import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { AulasPestanaRendimiento } from "./AulasPestanaRendimiento";
import type { MonitoreoAulasDashboard } from "../../../../api/monitoreo";

/**
 * **Una lente con una sola fila no es una comparación, es un dato.**
 *
 * El trío de Rendimiento repartía tres columnas iguales entre «Quién consigue
 * más», «Franja horaria del operativo» y «Día de la semana». El comentario que
 * lo justificaba había medido «7, 3 y 7 filas»; el 2026-09-09, con el operativo
 * recién arrancado, eran 5, 1 y 1. A un tercio de ancho el ranking partía cada
 * nombre en cuatro líneas —«Chamorro Rodriguez, Rosa Alejandrin/a»— mientras las
 * otras dos gastaban una columna entera para una fila. Gonzalo, mirándolo: «se
 * ve fatal».
 *
 * Este test fija que el ancho lo deciden los DATOS. Sin él, la regla es una
 * decisión de layout que nadie sujeta: el trío volvería en cuanto alguien
 * simplificara el condicional, y sólo se vería con el operativo empezando —que
 * es justo cuando más se mira el tablero—.
 */

/**
 * `applied_at` y no `franja`/`scheduled_date`: el parte publicado manda fecha y
 * hora en UN solo campo («2026-08-11 10:00»), y las dos lentes se derivan de
 * ahí (`rendimientoPorFacultad.ts:198-203`). Una fixture con `franja` suelto
 * mediría otra cosa: las dos lentes caerían en «Sin hora» / «Sin fecha» y el
 * test pasaría por el motivo equivocado.
 */
const parte = (aplicador: string, appliedAt: string) => ({
  operational_code: `CH ${aplicador}${appliedAt}`,
  applied_by: aplicador,
  applied_at: appliedAt,
  effective_surveys: 20,
  observed_students: 30,
  eligible_n: 40,
  faculty: "DERECHO",
});

function pintar(partes: ReturnType<typeof parte>[]): string {
  const dashboard = {
    agenda: partes,
    partes_campo: partes,
    ritmo_diario: [],
  } as unknown as MonitoreoAulasDashboard;
  return renderToStaticMarkup(
    <AulasPestanaRendimiento
      dashboard={dashboard}
      pestana="rendimiento"
      facultadEnFoco={undefined}
      onFoco={() => {}}
      diasDeCampoDelCorte={() => 1}
    />,
  );
}

describe("el ancho de las lentes lo deciden los datos", () => {
  test("con UNA franja y UN día no se reparten tres columnas iguales", () => {
    // Es el caso del arranque del operativo, y el que Gonzalo vio roto.
    const html = pintar([
      parte("Ana", "2026-09-07 10:00"),
      parte("Beto", "2026-09-07 11:00"),
    ]);
    expect(html).not.toContain("aulas-lentes-trio");
    expect(html).toContain("aulas-avance-pareja");
  });

  test("cuando las dos lentes SÍ comparan, vuelve el trío como se midió", () => {
    // Dos franjas y dos días distintos: ahí las tres columnas comparan de
    // verdad y el molde original es el bueno. La regla no es «nunca el trío».
    const html = pintar([
      parte("Ana", "2026-09-07 08:00"),
      parte("Beto", "2026-09-08 11:00"),
      parte("Ana", "2026-09-08 08:00"),
      parte("Beto", "2026-09-07 11:00"),
    ]);
    expect(html).toContain("aulas-lentes-trio");
  });

  test("el ranking de aplicadores está en los dos casos, no se pierde por el camino", () => {
    for (const partes of [
      [parte("Ana", "2026-09-07 10:00")],
      [parte("Ana", "2026-09-07 08:00"), parte("Beto", "2026-09-08 11:00")],
    ]) {
      expect(pintar(partes)).toContain("Quién consigue más");
    }
  });
});
