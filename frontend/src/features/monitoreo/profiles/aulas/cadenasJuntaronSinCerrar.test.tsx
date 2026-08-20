import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { AulasHistoriaCadena } from "./AulasHistoriaCadena";

/**
 * Dos cifras de la misma pantalla que se contradicen a la vista, y la
 * explicación que las reconcilia.
 *
 * La tabla enseña «válidas 17» al lado de «meta 15» —la del titular, sumando la
 * cadena— y el resumen dice «sin cerrar». Las dos son ciertas: una cadena cierra
 * cuando UN aula alcanza SU propia meta, porque el resto del perfil calcula la
 * brecha por aula, y sumar los eslabones diría que cerró mientras `brechas` y el
 * KPI la siguen contando.
 *
 * **La regla es deliberada y no se toca** —hay un test que la fija, «el cierre
 * NO se acumula entre eslabones», con su razón escrita—. Lo que faltaba es
 * decirlo: dos fuentes del mismo hecho que no coinciden tienen que declararlo, o
 * quien lee elige una y desconfía de la otra.
 */

const fila = (f: Partial<MonitoreoAulasPlanRow>) => f as MonitoreoAulasPlanRow;

const cadena = (titular: string, vT: number, mT: number, vR: number, mR: number) => [
  fila({ operational_code: titular, sample_role: "titular", faculty: "Derecho",
         sample_status: "reemplazada", respuestas_validas: vT, expected_valid: mT }),
  fila({ operational_code: `R ${titular.slice(3)}.1`, sample_role: "chain_reserve",
         titular_operational_code: titular, faculty: "Derecho", replacement_order: 1,
         respuestas_validas: vR, expected_valid: mR }),
];

const pinta = (filas: MonitoreoAulasPlanRow[]) =>
  renderToStaticMarkup(<AulasHistoriaCadena filas={filas} />);

describe("las cadenas que juntaron lo que pide el hueco sin cerrar", () => {
  it("se nombran cuando las hay", () => {
    // 0 + 17 son 17 y el hueco pide 15, pero la reserva tiene su propia meta de
    // 28 y no llegó: sin cerrar, y con brecha viva en el resto del perfil.
    const html = pinta(cadena("CH 1", 0, 15, 17, 28));
    expect(html).toContain("sin cerrar");
    expect(html).toMatch(/En <strong>1<\/strong> de las abiertas/);
    expect(html).toContain("ninguna aula sola");
  });

  it("no se dice nada cuando no hay ninguna", () => {
    // La cadena junta 5 y el hueco pide 15: abierta y sin contradicción que
    // explicar. Una nota que aparece siempre deja de leerse.
    const html = pinta(cadena("CH 2", 0, 15, 5, 28));
    expect(html).not.toContain("ninguna aula sola");
  });

  it("tampoco cuando la cadena SÍ cerró", () => {
    // La reserva alcanzó su propia meta: no hay nada raro que reconciliar.
    const html = pinta(cadena("CH 3", 0, 15, 30, 28));
    expect(html).not.toContain("ninguna aula sola");
  });
});
