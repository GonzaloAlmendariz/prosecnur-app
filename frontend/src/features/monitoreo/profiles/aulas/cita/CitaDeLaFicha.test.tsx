import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { CitaDeLaFicha } from "./CitaDeLaFicha";
import { lecturaDeCita } from "./lecturaDeCita";

// P4: la cita vencida con sus tres salidas y la reagendada contra su parte.

const HOY = "2026-10-30";

describe("lecturaDeCita", () => {
  it("vencida: pasó la fecha sin parte ni respuestas", () => {
    expect(lecturaDeCita({ scheduled_date: "2026-10-27", sample_status: "agendada" }, null, HOY))
      .toEqual({ caso: "vencida", citada: "2026-10-27", dias: 3, yaReagendada: false });
  });

  it("con respuestas, con parte, rechazada o no aplicada no es vencida", () => {
    expect(lecturaDeCita({ scheduled_date: "2026-10-27", respuestas_validas: 12 }, null, HOY)).toBeNull();
    expect(lecturaDeCita({ scheduled_date: "2026-10-27" }, { applied_at: "2026-10-27" }, HOY)).toBeNull();
    expect(lecturaDeCita({ scheduled_date: "2026-10-27", sample_status: "rechazo" }, null, HOY)).toBeNull();
    expect(lecturaDeCita({ scheduled_date: "2026-10-27", application_status: "no_aplicada" }, null, HOY)).toBeNull();
    expect(lecturaDeCita({ scheduled_date: "2026-11-02" }, null, HOY)).toBeNull();
  });

  it("reagendada: contrasta la fecha citada con la del parte", () => {
    expect(lecturaDeCita({ scheduled_date: "2026-10-28", sample_status: "reagendada" }, { applied_at: "2026-10-29 10:00" }, HOY))
      .toMatchObject({ caso: "reagendada", conParte: true, aplicada: "2026-10-29", coincide: false });
    expect(lecturaDeCita({ scheduled_date: "2026-11-03", sample_status: "Reagendada" }, null, HOY))
      .toMatchObject({ caso: "reagendada", conParte: false, coincide: null });
  });
});

describe("CitaDeLaFicha", () => {
  it("la vencida ofrece reagendar, reemplazar y darla por no aplicada", () => {
    const lectura = lecturaDeCita({ scheduled_date: "2026-10-27", sample_status: "reagendada" }, null, HOY)!;
    const html = renderToStaticMarkup(<CitaDeLaFicha lectura={lectura} codigo="CH 900" onReemplazar={() => {}} />);
    expect(html).toContain("La cita venció");
    expect(html).toContain("hace 3 días");
    expect(html).toContain("ya se había reagendado una vez");
    expect(html).toContain("Reagendar");
    expect(html).toContain("Activar el reemplazo");
    expect(html).toContain("Darla por no aplicada");
  });

  it("la reagendada con parte en otra fecha lo dice", () => {
    const lectura = lecturaDeCita({ scheduled_date: "2026-10-28", sample_status: "reagendada" }, { applied_at: "2026-10-29" }, HOY)!;
    const html = renderToStaticMarkup(<CitaDeLaFicha lectura={lectura} codigo="CH 900" />);
    expect(html).toContain("la cita el 28 de octubre");
    expect(html).toContain("se aplicó el 29 de octubre");
  });
});
