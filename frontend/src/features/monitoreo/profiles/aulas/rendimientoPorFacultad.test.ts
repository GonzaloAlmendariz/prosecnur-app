import { describe, expect, it } from "vitest";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { franjaDeAplicacion, rendimientoPorFacultad } from "./rendimientoPorFacultad";

const parte = (f: Partial<MonitoreoRow>) => f as MonitoreoRow;

describe("rendimientoPorFacultad", () => {
  it("ordena por lo que deja cada visita, NO por porcentaje", () => {
    // El caso que Gonzalo describió: un aula de 100 elegibles al 40 % rinde más
    // que una de 20 al 70 %. Ordenar por porcentaje pondría primero a la que
    // menos aporta, que es exactamente el error que hay que no cometer.
    const salida = rendimientoPorFacultad(
      [
        parte({ operational_code: "G", faculty: "Grande", effective_surveys: 40, observed_students: 100 }),
        parte({ operational_code: "P", faculty: "Pequena", effective_surveys: 14, observed_students: 20 }),
      ],
    );
    expect(salida.map((f) => f.facultad)).toEqual(["Grande", "Pequena"]);
    expect(salida[0].porAula).toBe(40);
    // Y la tasa sobre asistentes dice lo contrario: por eso convive, no sustituye.
    expect(salida[0].deLosAsistentes).toBe(40);
    expect(salida[1].deLosAsistentes).toBe(70);
  });

  it("el encogimiento CAMBIA el orden cuando las facultades son de tamaños distintos", () => {
    // El caso real: en el estudio de 2025 las facultades van de 2 a 39 aulas
    // (Ciencias Contables 2, Ciencias e Ingeniería 39). Una facultad con dos
    // aulas afortunadas encabeza la lista cruda y no debería.
    const partes = [
      // Chica: 2 aulas, 40 efectivas cada una. Tasa cruda 40.
      parte({ operational_code: "A", faculty: "Chica", effective_surveys: 40, observed_students: 45 }),
      parte({ operational_code: "B", faculty: "Chica", effective_surveys: 40, observed_students: 45 }),
      // Grande: 10 aulas de 30. Tasa cruda 30, con cinco veces más evidencia.
      ...Array.from({ length: 10 }, (_, i) =>
        parte({ operational_code: `G${i}`, faculty: "Grande", effective_surveys: 30, observed_students: 35 })),
    ];
    const salida = rendimientoPorFacultad(partes);
    const chica = salida.find((f) => f.facultad === "Chica")!;
    const grande = salida.find((f) => f.facultad === "Grande")!;
    // Cruda: la chica gana.
    expect(chica.porAula).toBe(40);
    expect(grande.porAula).toBe(30);
    // Ajustada: la chica se acerca a la media y la grande apenas se mueve.
    expect(chica.porAulaAjustado!).toBeLessThan(chica.porAula!);
    expect(Math.abs(grande.porAulaAjustado! - grande.porAula!))
      .toBeLessThan(Math.abs(chica.porAulaAjustado! - chica.porAula!));
    // Y el dato observado SIGUE estando: el encogido no lo sustituye.
    expect(chica.porAula).toBe(40);
  });

  it("con muchas aulas el encogimiento casi no mueve la cifra", () => {
    const partes = Array.from({ length: 40 }, (_, i) =>
      parte({ operational_code: `A${i}`, faculty: "X", effective_surveys: 20, observed_students: 25 }));
    const [f] = rendimientoPorFacultad(partes);
    // Con una sola facultad, la media del estudio ES su propia tasa: el prior
    // no puede moverla, que es lo correcto.
    expect(f.porAulaAjustado).toBe(20);
  });

  it("un parte vacío no hunde la tasa de su facultad", () => {
    // Sin efectivas NI asistentes no es un aula que rindió cero: es un parte que
    // nadie llenó todavía.
    const [f] = rendimientoPorFacultad([
      parte({ operational_code: "A", faculty: "X", effective_surveys: 20, observed_students: 25 }),
      parte({ operational_code: "B", faculty: "X" }),
    ]);
    expect(f.aulas).toBe(1);
    expect(f.porAula).toBe(20);
  });

  it("el potencial sale de los elegibles del plan", () => {
    const [f] = rendimientoPorFacultad(
      [parte({ operational_code: "A", faculty: "X", effective_surveys: 30, observed_students: 40 })],
      [parte({ operational_code: "A", eligible_n: 60 })],
    );
    expect(f.elegibles).toBe(60);
    expect(f.delPotencial).toBe(50);
  });

  it("agrupa por aplicador con la MISMA función", () => {
    const salida = rendimientoPorFacultad(
      [
        parte({ operational_code: "A", applied_by: "Equipo 1", effective_surveys: 30, observed_students: 40 }),
        parte({ operational_code: "B", applied_by: "Equipo 1", effective_surveys: 10, observed_students: 20 }),
        parte({ operational_code: "C", applied_by: "Equipo 2", effective_surveys: 25, observed_students: 30 }),
      ],
      [],
      "applied_by",
    );
    expect(salida.map((f) => f.facultad)).toEqual(["Equipo 2", "Equipo 1"]);
    expect(salida[0].porAula).toBe(25);
    expect(salida[1].porAula).toBe(20);
  });

  it("las franjas son las del libro, y lo raro se declara aparte", () => {
    // 7:00–9:00 · 9:01–19:00 · 19:01–22:00, de la hoja «planilla». Un aula a las
    // 6 de la mañana es un dato que hay que ver, no un caso de «mañana».
    expect(franjaDeAplicacion("08:00")).toBe("7:00 – 9:00");
    expect(franjaDeAplicacion("09:01")).toBe("9:01 – 19:00");
    expect(franjaDeAplicacion("19:00")).toBe("9:01 – 19:00");
    expect(franjaDeAplicacion("20:30")).toBe("19:01 – 22:00");
    expect(franjaDeAplicacion("06:00")).toBe("Fuera de franja");
    expect(franjaDeAplicacion("23:10")).toBe("Fuera de franja");
    expect(franjaDeAplicacion("")).toBe("Sin hora");
    expect(franjaDeAplicacion("mediodía")).toBe("Sin hora");
    // El parte publicado manda fecha y hora juntas, no la hora sola.
    expect(franjaDeAplicacion("2026-08-11 10:00")).toBe("9:01 – 19:00");
    expect(franjaDeAplicacion("2026-08-11 08:30")).toBe("7:00 – 9:00");
  });

  it("sin elegibles conocidos el potencial es nulo, no cero", () => {
    // Un cero se leería como «no queda nada por exprimir», que es lo contrario
    // de «no se sabe».
    const [f] = rendimientoPorFacultad([
      parte({ operational_code: "A", faculty: "X", effective_surveys: 10, observed_students: 12 }),
    ]);
    expect(f.delPotencial).toBeNull();
    expect(f.deLosAsistentes).toBeCloseTo(83.3, 1);
  });
});
