import { describe, expect, it } from "vitest";

import { fichaDeCursoHorario } from "./fichaDeCursoHorario";

/**
 * **«Que se muestre absolutamente todo lo que sabemos sobre ese CH»**
 * (Gonzalo, 2026-09-12), «con estado de agendación, de aplicación, de duración».
 *
 * Medido ese día sobre el operativo: **107 campos por curso-horario**, 83 con
 * dato, repartidos en CUATRO fuentes —el plan, el parte de campo, la banda de
 * efectividad y la Base de control—. La ficha ya cruzaba las tres primeras; la
 * duración vive sólo en la cuarta y no llegaba a la pantalla.
 */
const fila = (p: Record<string, unknown> = {}) => ({
  operational_code: "CH 1", faculty: "CIENCIAS E INGENIERIA", eligible_n: 28,
  contact_medium: "WhatsApp", contact_date: "2026-09-03", contact_attempts: 2,
  call_status: "Contactado por WhatsApp", email_received: "Sí",
  teacher: "Docente", teacher_phone: "999888777", teacher_email: "d@pucp.pe",
  teacher_type: "TC", applied_at: "2026-09-05", applied_by: "González Rubio",
  enrolled_total: 30, observed_students: 27, refusals: 1, duplicates: 0,
  field_note: "La docente pidió que la encuesta se aplique al final",
  activation_origin: "refuerzo", activated_for: "DERECHO",
  pdf_link: "https://x/pdf", qr: "QR-1", ...p,
});

describe("la ficha trae las cuatro fuentes", () => {
  it("la DURACIÓN sale de la Base de control, que no es el plan", () => {
    const f = fichaDeCursoHorario(fila(), undefined, undefined,
      { duracion_media: 5.3, duracion_min: 3, duracion_max: 8.6 });
    expect(f.duracionMedia).toBe(5.3);
    expect(f.duracionMin).toBe(3);
    expect(f.duracionMax).toBe(8.6);
  });

  it("sin Base de control la duración se declara ausente, no se inventa", () => {
    const f = fichaDeCursoHorario(fila());
    expect(f.duracionMedia).toBeNull();
    expect(f.duracionMin).toBeNull();
    expect(f.duracionMax).toBeNull();
  });

  it("trae cómo se le contactó", () => {
    const f = fichaDeCursoHorario(fila());
    expect(f).toMatchObject({
      contactoMedio: "WhatsApp", contactoFecha: "2026-09-03", contactoIntentos: 2,
      estadoLlamada: "Contactado por WhatsApp", correoRecibido: "Sí",
    });
  });

  it("trae con qué llamar al docente sin salir de la ficha", () => {
    const f = fichaDeCursoHorario(fila());
    expect(f).toMatchObject({
      docenteTelefono: "999888777", docenteCorreo: "d@pucp.pe", docenteTipo: "TC",
    });
  });

  it("trae el aforo entero y lo que pasó en el aula", () => {
    const f = fichaDeCursoHorario(fila());
    expect(f).toMatchObject({ matriculados: 30, observados: 27, rechazos: 1, duplicados: 0 });
  });

  it("trae por qué está en juego, cuando es un refuerzo", () => {
    const f = fichaDeCursoHorario(fila());
    expect(f.origenDeActivacion).toBe("refuerzo");
    expect(f.activadoPara).toBe("DERECHO");
  });

  it("trae la nota que escribió el aplicador", () => {
    expect(fichaDeCursoHorario(fila()).notaDeCampo)
      .toBe("La docente pidió que la encuesta se aplique al final");
  });

  it("en lo que pasó EN EL AULA, el parte manda sobre el plan", () => {
    // Quien estuvo allí lo anotó; el plan lo recoge después y puede ir detrás.
    const f = fichaDeCursoHorario(fila(), {
      observed_students: 25, refusals: 4, duplicates: 2,
      applied_by: "Chamorro Rodríguez", applied_at: "2026-09-06",
      field_note: "Se aplicó en otro salón",
    });
    expect(f).toMatchObject({
      observados: 25, rechazos: 4, duplicados: 2,
      aplicadoPor: "Chamorro Rodríguez", aplicadoEn: "2026-09-06",
      notaDeCampo: "Se aplicó en otro salón",
    });
  });

  it("un cero del parte NO se pierde por el respaldo del plan", () => {
    // `?? ` y no `||`: con `||`, un 0 legítimo del parte caería al valor del
    // plan y la ficha diría que hubo rechazos donde no los hubo.
    const f = fichaDeCursoHorario(fila({ refusals: 9 }), { refusals: 0 });
    expect(f.rechazos).toBe(0);
  });
});
