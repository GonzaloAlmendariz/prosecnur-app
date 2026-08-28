import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { AulasPopoverReemplazo } from "./AulasPopoverReemplazo";

/**
 * Un cero medido y un cero por no medir no pueden verse igual.
 *
 * Montado en Registro de campo el popover NO recibe brecha —esa vista no tiene
 * las cuotas por facultad—, y los tres candidatos salían con una barra de
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
    <AulasPopoverReemplazo caido={CAIDO} filas={RESERVAS} brecha={brecha} />,
  );

describe("«cierra brecha» sólo se dibuja si hay brecha que cerrar", () => {
  it("sin brecha no pinta la medida en vez de pintarla a cero", () => {
    const html = pinta();
    expect(html).toContain("se parece");
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
