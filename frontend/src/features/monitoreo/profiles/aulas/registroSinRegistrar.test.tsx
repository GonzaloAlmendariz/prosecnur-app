import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";

vi.mock("../../../../lib/PlotlyChart", () => ({ PlotlyChart: () => null }));
const { RegistroDeCampo } = await import("./RegistroDeCampo");

/**
 * «Todavía sin registrar» tiene que contar las que SE VAN a registrar.
 *
 * Cuando un titular cae, su reserva toma el relevo y él se queda en
 * `planificada` para siempre —nunca llegó a salir—. Contando ese estado a secas,
 * la pestaña decía «26 de 196 todavía sin registrar» y, medido sobre el corte,
 * **las 26 eran reemplazadas**: mandaba a registrar veintiséis aulas muertas y
 * callaba las dieciocho que de verdad esperan su parte.
 */

const aula = (codigo: string, sample_status: string, operational_status: string): MonitoreoAulasPlanRow =>
  ({ operational_code: codigo, classroom_id: codigo, sample_role: "titular",
     faculty: "Derecho", sample_status, operational_status }) as unknown as MonitoreoAulasPlanRow;

const pinta = (filas: MonitoreoAulasPlanRow[]) => renderToStaticMarkup(
  <RegistroDeCampo agenda={filas} partes={[]} onGuardado={() => {}} />,
);

describe("«todavía sin registrar» no cuenta aulas muertas", () => {
  it("una reemplazada no está pendiente: no va a registrarse nunca", () => {
    const html = pinta([
      ...Array.from({ length: 26 }, (_, i) => aula(`CH ${i}`, "reemplazada", "planificada")),
      ...Array.from({ length: 18 }, (_, i) => aula(`CH 1${i}`, "agendada", "agendada")),
      ...Array.from({ length: 152 }, (_, i) => aula(`CH 2${i}`, "agendada", "aplicada")),
    ]);
    // 18, no 26 ni 44.
    expect(html).toMatch(/18<\/strong> de 170/);
    expect(html).not.toMatch(/26<\/strong> de/);
  });

  it("el denominador son las registrables, y la diferencia se nombra", () => {
    // Si la lista de al lado tiene 196 filas y aquí pone 170, sin explicación se
    // lee como aulas perdidas.
    const html = pinta([
      ...Array.from({ length: 26 }, (_, i) => aula(`CH ${i}`, "reemplazada", "planificada")),
      ...Array.from({ length: 18 }, (_, i) => aula(`CH 1${i}`, "agendada", "agendada")),
      ...Array.from({ length: 152 }, (_, i) => aula(`CH 2${i}`, "agendada", "aplicada")),
    ]);
    expect(html).toContain("26 reemplazadas no se registran");
  });

  it("sin reemplazadas no sobra la frase ni cambia el denominador", () => {
    const html = pinta(Array.from({ length: 5 }, (_, i) => aula(`CH ${i}`, "agendada", "agendada")));
    expect(html).toMatch(/5<\/strong> de 5/);
    expect(html).not.toContain("no se registran");
  });

  it("un estado que nadie previó sobre un aula viva cuenta como pendiente", () => {
    // La condición se escribe por lo que DESCARTA. Un aula viva en un estado
    // desconocido es justo lo que alguien tiene que mirar, no algo que esconder.
    const html = pinta([aula("CH 1", "agendada", "en_campo"), aula("CH 2", "agendada", "aplicada")]);
    expect(html).toMatch(/1<\/strong> de 2/);
  });
});
