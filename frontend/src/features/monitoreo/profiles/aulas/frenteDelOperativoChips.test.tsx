import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { AulasFrenteDelOperativo } from "./AulasFrenteDelOperativo";

/**
 * Sistema Pabellón en los vencidos (B33/P2): la lista de cursos-horario que ya
 * pasaron su fecha pinta la hora como chip y el aula como chip de pabellón —
 * el mismo A206 que la Agenda—, con el texto entero del Excel conservado en el
 * title. Los días y el código quedan en su peso: son lo que ordena la lista.
 */

const fila = (extra: Record<string, unknown>): MonitoreoAulasPlanRow =>
  ({
    operational_code: "CH 7",
    faculty: "DERECHO",
    sample_role: "titular",
    scheduled_date: "2026-08-20",
    scheduled_time: "16:00",
    label: "LUN 16:00 A206",
    classroom_id: "der101_0101",
    ...extra,
  }) as unknown as MonitoreoAulasPlanRow;

const pinta = (filas: MonitoreoAulasPlanRow[]) =>
  renderToStaticMarkup(
    <AulasFrenteDelOperativo filas={filas} partes={[]} corte="2026-09-01" />,
  );

describe("los vencidos llevan los chips del sistema", () => {
  it("hora como chip de hora y aula como chip de pabellón, con el Excel en el title", () => {
    const html = pinta([fila({})]);
    expect(html).toContain("aulas-chip-hora");
    expect(html).toContain("aulas-chip-lugar");
    expect(html).toContain("A206");
    expect(html).toContain('title="LUN 16:00 A206"');
  });

  it("sin aula ni hora, el hueco sigue diciendo «—» y no un chip vacío", () => {
    const html = pinta([fila({ scheduled_time: "", label: "" })]);
    expect(html).not.toContain("aulas-chip-lugar");
    expect(html).not.toContain("aulas-chip-hora");
    expect(html).toContain("—");
  });
});
