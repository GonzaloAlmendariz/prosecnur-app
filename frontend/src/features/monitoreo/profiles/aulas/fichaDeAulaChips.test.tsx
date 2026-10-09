import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AulasFichaDeAula } from "./AulasFichaDeAula";

/**
 * Sistema Pabellón en la ficha (B33/P4): la identidad de la cita —dónde, a qué
 * hora, qué día— va como fila de chips bajo el código, con el mismo tono de
 * pabellón que el resto del perfil. Y el estado deja de hablar en clave de
 * motor: «agendada» se pinta «Agendado», como en todas las tablas.
 */

const FUENTES: Record<"agenda" | "partes" | "control" | "brechas", Array<Record<string, unknown>>> = {
  agenda: [{
    operational_code: "CH 31",
    faculty: "Derecho",
    venue: "A206",
    scheduled_time: "16:00",
    scheduled_date: "2026-09-03",
    operational_status: "agendada",
    eligible_n: 40,
    expected_valid: 14,
  }],
  partes: [],
  control: [],
  brechas: [],
};

const pinta = (fuentes = FUENTES) =>
  renderToStaticMarkup(
    <AulasFichaDeAula codigo="CH 31" fuentes={fuentes} onCerrar={() => {}} />,
  );

describe("la ficha lleva la fila de chips de identidad", () => {
  it("lugar como chip de pabellón, hora como chip y fecha como badge", () => {
    const html = pinta();
    expect(html).toContain("aulas-chips-fila");
    expect(html).toContain("aulas-chip-lugar");
    expect(html).toContain("aulas-chip-hora");
    expect(html).toContain("A206");
    expect(html).toContain("2026-09-03");
  });

  it("el estado habla el idioma de la casa, no la clave del motor", () => {
    const html = pinta();
    expect(html).toContain("Agendado");
    expect(html).not.toContain(">agendada<");
  });

  it("sin lugar ni hora ni fecha, la fila no se pinta: nada de chips vacíos", () => {
    const html = pinta({
      ...FUENTES,
      agenda: [{ operational_code: "CH 31", faculty: "Derecho" }],
    });
    expect(html).not.toContain("aulas-chips-fila");
  });
});
