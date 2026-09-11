import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
// El CONTENIDO, no la ventana: `createPortal` pinta en `document.body`, así
// que un render estático del modal devuelve cadena vacía.
import { ContenidoDeReemplazo } from "./AulasPopoverReemplazo";

/**
 * Un cero medido y un cero por no medir no pueden verse igual.
 *
 * Cuando se escribió esto, Registro de campo NO pasaba brecha —nadie producía
 * una en todo el perfil— y los tres candidatos salían con una barra de
 * «cierra brecha 0 %». Eso se lee como una afirmación sobre las aulas
 * («ninguna ayuda a cerrar nada») cuando la verdad es que ahí no se está
 * midiendo eso. Comprobado en pantalla sobre el simulacro de campo malo, con
 * CH 1 y sus tres reservas al 98-100 % de parecido.
 *
 * «Se parece» se muestra siempre porque sí se calcula siempre: sale de comparar
 * el candidato con el aula que cae, y para eso no hace falta ninguna cuota.
 */

const fila = (codigo: string, extra: Record<string, unknown> = {}): MonitoreoAulasPlanRow =>
  ({
    operational_code: codigo, classroom_id: codigo, faculty: "DERECHO",
    course_name: `Curso ${codigo}`, eligible_n: 30, expected_valid: 15,
    sex_top_1: "F", sex_top_1_n: 18, sex_top_2_n: 12,
    tasa_efectividad_aula: 0.55, stratum: "DERECHO / F / G2", level: "3",
    sample_role: "titular", titular_operational_code: codigo,
    sample_status: "agendada", operational_status: "agendada", ...extra,
  }) as unknown as MonitoreoAulasPlanRow;

const CAIDO = fila("CH 1");
const RESERVAS = [
  CAIDO,
  fila("R 1.1", { sample_role: "chain_reserve", titular_operational_code: "CH 1",
                  replacement_order: 1, sample_status: "en_reserva",
                  operational_status: "planificada" }),
];

const pinta = (brecha?: { mujeres: number; hombres: number }) =>
  renderToStaticMarkup(
    <ContenidoDeReemplazo caido={CAIDO} filas={RESERVAS} brecha={brecha} />,
  );

describe("«cierra brecha» sólo se dibuja si hay brecha que cerrar", () => {
  it("sin brecha no pinta la medida en vez de pintarla a cero", () => {
    const html = pinta();
        // Registro formalizado el 2026-09-11 a petición de Gonzalo («cuidado con
    // la jerga, tratemos de ser más profesionales, formales»). Lo que el
    // contrato comprueba no cambia; cambia la palabra.
    expect(html).toContain("similitud");
    expect(html).not.toContain("cierra brecha");
  });

  it("con brecha real sí la pinta", () => {
    const html = pinta({ mujeres: 40, hombres: 12 });
    expect(html).toContain("cierra brecha");
  });

  it("una brecha de cero es una facultad cubierta: tampoco se pinta", () => {
    // No es lo mismo «no me pasaron la brecha» que «la brecha es 0», pero para
    // esta medida las dos significan que no hay nada que cerrar.
    const html = pinta({ mujeres: 0, hombres: 0 });
    expect(html).not.toContain("cierra brecha");
  });
});

describe("la fila de esperadas suma", () => {
  /**
   * Tres celdas en una línea donde dos tienen que dar la tercera. Salían de
   * tres `Math.floor` independientes —uno por sexo y otro sobre el total—, y
   * la suma de redondeos no es el redondeo de la suma.
   *
   * Visto a 1440 el 2026-08-30 en las dos solapas del popover, la primera vez
   * que se miró esa superficie: **los seis candidatos mostrados fallaban por
   * uno**, siempre de más en el total. Con 29 elegibles (5 mujeres, 24
   * hombres) y tasa 0,52: `floor(2,6) + floor(12,48) = 14` contra
   * `floor(29 × 0,52) = 15`.
   *
   * Redondear hacia abajo se queda —«una meta redondeada hacia arriba
   * prometería gente que el aula no tiene»—; lo que cambia es que el total no
   * se calcula aparte.
   */
  const conReparto = (mujeres: number, hombres: number, tasa: number) => {
    const caido = fila("CH 9");
    const reserva = fila("R 9.1", {
      sample_role: "chain_reserve", titular_operational_code: "CH 9",
      replacement_order: 1, sample_status: "en_reserva", operational_status: "planificada",
      // `sex_top_1` es el sexo DOMINANTE, no «mujeres»: con "M" el primero son
      // hombres. Se declara así para no invertir la tabla.
      sex_top_1: "M", sex_top_1_n: hombres, sex_top_2_n: mujeres,
      eligible_n: mujeres + hombres, tasa_efectividad_aula: tasa,
    });
    return renderToStaticMarkup(
      <ContenidoDeReemplazo caido={caido} filas={[caido, reserva]} />,
    );
  };

  /**
   * **La fila vive ahora en la tabla de tres varas** (2026-09-11): el candidato
   * enseña sus elegibles, lo que el plan pidió y lo que dará al ritmo de hoy,
   * y esta comprobación se hace sobre la última. Lo que el contrato pide —que
   * las dos cifras de sexo den el total— no cambia; cambia dónde se lee.
   */
  /**
   * Las celdas de GENTE de una fila, saltando la de la tasa.
   *
   * La columna de tasa se añadió el 2026-09-11 —Gonzalo: «el 50.5 % suyo no se
   * lee bien, debería ser una columna con ambos porcentajes»— y va delante de
   * los sexos, así que un lector posicional la recogería como si fuera una
   * cifra de personas. Se excluye por su clase, no por su posición: mover una
   * columna no debe cambiar lo que este contrato mide.
   */
  const celdas = (html: string) => {
    const fila = /<tr class="es-ritmo">[\s\S]*?<\/tr>/.exec(html)?.[0] ?? "";
    return [...fila.matchAll(/<td(?![^>]*es-tasa)[^>]*>(?:<b>)?(\d+)/g)].map((m) => Number(m[1]));
  };

  it("el caso real: 5 mujeres y 24 hombres al 0,52 dan 14, no 15", () => {
    // 2 + 12 = 14. El total ya no se redondea por su cuenta.
    expect(celdas(conReparto(5, 24, 0.52))).toEqual([2, 12, 14]);
  });

  it("cuando no hay resto, las tres cifras coinciden igual", () => {
    // El control: si el arreglo fuera «restar uno siempre», este caso fallaría.
    expect(celdas(conReparto(10, 10, 0.5))).toEqual([5, 5, 10]);
  });

  it("y las tres varas se leen a la vez: el techo, el plan y el ritmo", () => {
    // Lo que Gonzalo pedía: los elegibles por sexo y los DOS esperados, que
    // discrepan y por eso se enseñan juntos.
    const html = conReparto(10, 10, 0.5);
    expect(html).toContain("Elegibles");
    expect(html).toContain("Proyección actual");
    // Y la tasa en su columna, con las dos varas comparables.
    expect(html).toContain("Tasa");
    const techo = /<tr class="es-techo">[\s\S]*?<\/tr>/.exec(html)?.[0] ?? "";
    expect([...techo.matchAll(/<td(?![^>]*es-tasa)[^>]*>(?:<b>)?(\d+)/g)].map((m) => Number(m[1])))
      .toEqual([10, 10, 20]);
  });
});
