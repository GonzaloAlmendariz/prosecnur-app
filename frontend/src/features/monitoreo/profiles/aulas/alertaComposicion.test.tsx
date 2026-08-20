import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { AulasAlertaDeAnticipacion } from "./AulasAlertaDeAnticipacion";

/**
 * La lista dice cuántas aulas pedir; también tiene que decir DE QUÉ.
 *
 * Sumar los dos sexos escondía la mitad de la instrucción: «pide 12 en Gestión»
 * con 52 mujeres y 24 hombres de brecha. El banco se elige por composición
 * —«¿qué extra me garantiza tantos hombres y tantas mujeres?»— así que el pedido
 * también.
 */

const historia = Array.from({ length: 8 }, (_, i) => ({
  operational_code: `CH ${i}`, faculty: "Gestion", applied_at: "2026-08-10",
  applied_date: "2026-08-10", effective_surveys: 20,
})) as unknown as MonitoreoRow[];

const agenda = [
  ...historia.map((h) => ({ ...h, scheduled_date: "2026-08-10" })),
] as unknown as MonitoreoRow[];

const pinta = (mujeres: number, hombres: number) => renderToStaticMarkup(
  <AulasAlertaDeAnticipacion
    partes={historia}
    agenda={agenda}
    cuotas={[
      { faculty: "Gestion", sex: "Mujer", target: mujeres, observed: 0 },
      { faculty: "Gestion", sex: "Hombre", target: hombres, observed: 0 },
    ] as unknown as MonitoreoRow[]}
  />,
);

describe("la alerta dice de qué lado es la brecha cuando está cargada", () => {
  it("con dos tercios o más de un lado, lo nombra", () => {
    // 60 mujeres y 20 hombres: el 75 % de lo que falta.
    const html = pinta(60, 20);
    expect(html).toContain("60 mujer");
  });

  it("con la brecha repartida NO nombra ninguno", () => {
    // 40 y 40: nombrar uno mandaría a pedir sesgado sin motivo.
    const html = pinta(40, 40);
    expect(html).not.toMatch(/· \d+ (mujer|hombre)/);
  });

  it("el reparto completo va siempre en el title, aunque no se nombre", () => {
    // El dato no se pierde por no caber: quien lo necesita lo tiene al pasar el
    // ratón, y quien no, no carga con él en una columna de 78 px.
    const html = pinta(40, 40);
    expect(html).toMatch(/title="[^"]*Mujer[^"]*Hombre/);
  });
});
