import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { ContenidoDeReemplazo } from "./AulasPopoverReemplazo";

/**
 * Sistema Pabellón en el popover de reemplazo (B33/P6): cada candidato pinta
 * su aula como chip de pabellón y su sesión como chip de hora — los datos con
 * los que se decide a quién entrar, con la misma identidad que la Agenda. El
 * docente y los elegibles quedan en su peso de texto.
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
const RESERVA = fila("R 1.1", {
  sample_role: "chain_reserve", titular_operational_code: "CH 1",
  replacement_order: 1, sample_status: "en_reserva",
  operational_status: "planificada",
  venue: "A206", sesiones_dia_hora: "MAR 14:00-16:00", teacher: "R. QUISPE",
});

const pinta = (reserva = RESERVA) =>
  renderToStaticMarkup(
    <ContenidoDeReemplazo caido={CAIDO} filas={[CAIDO, reserva]} />,
  );

describe("los candidatos llevan los chips del sistema", () => {
  it("aula como chip de pabellón, facultad como badge y sesión como chip de hora", () => {
    const html = pinta();
    expect(html).toContain("aulas-chip-lugar");
    expect(html).toContain("aulas-chip-hora");
    expect(html).toContain("A206");
    expect(html).toContain("MAR 14:00-16:00");
    // La facultad también es seña del box (canon B34): al comparar candidatos
    // de tres orígenes hay que ver de dónde es cada uno.
    expect(html).toMatch(/aulas-chips-fila[\s\S]*DERECHO/);
    // El docente sigue en su peso, no dentro de un chip de color.
    expect(html).toContain("R. QUISPE");
  });

  it("sin aula ni sesión no hay chips de lugar ni hora; la facultad se queda", () => {
    const html = pinta(fila("R 1.1", {
      sample_role: "chain_reserve", titular_operational_code: "CH 1",
      replacement_order: 1, sample_status: "en_reserva",
      operational_status: "planificada",
    }));
    expect(html).not.toContain("aulas-chip-lugar");
    expect(html).not.toContain("aulas-chip-hora");
    // El box sigue diciendo su facultad (canon B34), aunque el catálogo no
    // traiga salón ni sesión.
    expect(html).toMatch(/aulas-chips-fila[\s\S]*DERECHO/);
  });
});
