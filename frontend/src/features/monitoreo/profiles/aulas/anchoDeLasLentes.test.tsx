import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { AulasPestanaRendimiento } from "./AulasPestanaRendimiento";
import type { MonitoreoAulasDashboard } from "../../../../api/monitoreo";

/**
 * **El ranking de aplicadores se lleva SIEMPRE el ancho completo.**
 *
 * Historia de dos correcciones, porque la segunda existe porque la primera se
 * quedó corta:
 *
 * 1. Había un trío fijo —«Quién consigue más», «Franja horaria del operativo» y
 *    «Día de la semana» a un tercio cada uno—. El 2026-09-09, con el operativo
 *    recién arrancado, el ranking partía cada nombre en cuatro líneas
 *    —«Chamorro Rodriguez, Rosa Alejandrin/a»— mientras las otras dos gastaban
 *    una columna entera para UNA fila. Gonzalo: «se ve fatal». Se puso una
 *    regla: el trío sólo cuando las dos lentes de tiempo comparan.
 * 2. El 2026-09-10, con las dos lentes ya comparando, el trío volvió — y se
 *    midió en el DOM lo que hacía: **el panel daba 386 px de caja y la lista
 *    pedía 615**. La tabla del ranking se salía 229 px por la derecha y la del
 *    día se iba más allá del viewport, porque `minmax(60px, 1fr)` deja que el
 *    contenido empuje el track. Son 21 filas con nombres de treinta caracteres:
 *    no caben a un tercio ni cuando la comparación es legítima.
 *
 * Este test fija que el trío NO vuelve. Sin él, la vuelta a tres columnas es una
 * línea de CSS y un condicional, y el defecto sólo se ve con el operativo en
 * marcha —que es cuando más se mira el tablero—.
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

describe("el ancho de las lentes", () => {
  test("con UNA franja y UN día, el ranking va entero y las dos cortas en pareja", () => {
    const html = pintar([
      parte("Ana", "2026-09-07 10:00"),
      parte("Beto", "2026-09-07 11:00"),
    ]);
    expect(html).not.toContain("aulas-lentes-trio");
    expect(html).toContain("aulas-avance-pareja");
  });

  test("y con las dos lentes comparando TAMPOCO vuelve el trío", () => {
    // Éste es el caso que el reparto anterior mandaba a tres columnas y el que
    // se midió roto: dos franjas y dos días distintos.
    const html = pintar([
      parte("Ana", "2026-09-07 08:00"),
      parte("Beto", "2026-09-08 11:00"),
      parte("Ana", "2026-09-08 08:00"),
      parte("Beto", "2026-09-07 11:00"),
    ]);
    expect(html).not.toContain("aulas-lentes-trio");
    expect(html).toContain("aulas-avance-pareja");
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
