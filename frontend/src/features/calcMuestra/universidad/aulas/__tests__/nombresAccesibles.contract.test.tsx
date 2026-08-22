/**
 * Con teclado, cuatro botones iguales no son cuatro opciones.
 *
 * Las tarjetas del comparador llevaban cuatro botones «Usar método» sin más:
 * tabulando se oye el mismo nombre cuatro veces y nada dice cuál método es cuál.
 * Es «lo repetido es lo prominente» en su versión accesible, y no aparece en
 * ningún screenshot.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ClassroomMethodComparator } from "../ClassroomMethodComparator";

const METODOS = ["sistematico_pps", "cube_balanceado", "local_pivotal_balanceado", "pool_controlado"];

const html = renderToStaticMarkup(
  <ClassroomMethodComparator
    ready
    comparison={{ recommendation: { method_id: "pool_controlado" }, balance: [] } as never}
    methods={METODOS.map((id) => ({ method_id: id, representativity_score: 50, balance_score: 50 })) as never}
    recommendedMethodId="pool_controlado"
    config={{} as never}
    busy={null}
    onSelectMethod={() => undefined}
  />,
);

describe("los botones de elegir método se distinguen con teclado", () => {
  it("cada uno nombra su método", () => {
    for (const label of ["Usar Sistemático por facultad", "Usar Balance por cuotas y tamaño",
                         "Usar Balance + dispersión", "Usar Optimizar repetidos"]) {
      expect(html, `falta el nombre accesible «${label}»`).toContain(label);
    }
  });

  it("los cuatro nombres accesibles son distintos entre sí", () => {
    const nombres = [...html.matchAll(/aria-label="Usar ([^"]+)"/g)].map((m) => m[1]);
    expect(nombres).toHaveLength(4);
    expect(new Set(nombres).size).toBe(4);
  });

  it("el texto visible se queda corto porque la tarjeta ya lleva el nombre encima", () => {
    // Repetirlo en el botón visible sería ruido: el nombre está en la tarjeta.
    expect(html.split(">Usar método<").length - 1).toBe(4);
  });
});
