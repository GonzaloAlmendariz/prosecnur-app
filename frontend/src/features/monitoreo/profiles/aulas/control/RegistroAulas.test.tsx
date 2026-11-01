import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { MonitoreoAulasDashboard } from "../../../../../api/monitoreo";
import { construirRegistro } from "./registroModelo";
import { RegistroAulas } from "./RegistroAulas";

// Ficha Ctl4 con P5 («manda la hoja»): el parte se lee del libro; en la app
// sólo se declara el caso B o C de una reserva.

const tablero = {
  agenda: [
    { operational_code: "CH 144", faculty: "DERECHO", course_name: "Derecho I", eligible_n: 25, expected_valid: 17.2, respuestas_validas: 13 },
    { operational_code: "CH 9", faculty: "LETRAS", respuestas_validas: 5 },
    { operational_code: "R 140.2", faculty: "DERECHO", sample_role: "chain_reserve", replacement_for: "CH 140" },
  ],
  partes_campo: [
    { operational_code: "CH 144", application_status: "APLICADA", actual_room: "A301", applied_by: "Ana Ruiz", applied_at: "2026-09-21 10:00",
      observed_students: 20, refusals: 2, duplicates: 3, effective_surveys: 13, cuadra: false, diferencia: -2 },
  ],
  refuerzos: { ok: true, activadas: [
    { codigo: "R 140.2", facultad: "DERECHO", clase: "adicional", caso: "", estado: "agendada" },
    { codigo: "R 7.1", facultad: "LETRAS", clase: "complemento", caso: "B", estado: "aplicada" },
  ] },
} as unknown as MonitoreoAulasDashboard;

describe("construirRegistro", () => {
  it("lista primero lo que falta: sin parte en el libro, después los que no cuadran", () => {
    const m = construirRegistro(tablero);
    if (m.estado !== "listo") throw new Error("esperaba listo");
    expect(m.items.map((i) => [i.codigo, i.lectura])).toEqual([["CH 9", "Sin parte en el libro"], ["CH 144", "Faltan 2"]]);
    expect(m.cuentas).toEqual({ todos: 2, con: 1, sin: 1 });
  });

  it("el parte se lee tal cual, con lo esperado y lo de Kobo al lado", () => {
    const m = construirRegistro(tablero, "con");
    if (m.estado !== "listo" || !m.elegido) throw new Error("esperaba parte");
    expect(m.elegido.franja.map((c) => c.valor)).toEqual(["25", "17.2", "13"]);
    expect(m.elegido.campos.find((c) => c.rotulo === "Aula real")?.valor).toBe("A301");
    expect(m.elegido.cuadre.tono).toBe("aviso");
  });

  it("sólo las reservas adicionales sin caso piden B o C, con su titular para B", () => {
    const m = construirRegistro(tablero);
    if (m.estado !== "listo") throw new Error("esperaba listo");
    expect(m.sinCaso).toEqual([{ codigo: "R 140.2", facultad: "DERECHO", titular: "CH 140", estado: "agendada" }]);
  });
});

describe("RegistroAulas", () => {
  it("publica su marca, no tiene formulario del parte y ofrece B y C", () => {
    const html = renderToStaticMarkup(<RegistroAulas dashboard={tablero} cargando={false} vacioSinTablero={null} />);
    expect(html).toContain('data-audit-ready="monitoreo-aulas-control-registro"');
    expect(html).not.toContain("<input");
    expect(html).toContain("B · complemento");
    expect(html).toContain("C · refuerzo");
    expect(html).toContain("se corrige allí");
  });
});
