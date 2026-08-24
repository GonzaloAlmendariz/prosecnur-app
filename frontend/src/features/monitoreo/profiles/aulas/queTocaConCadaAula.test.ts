// Patrón 7: la tabla de Cálculo termina en «A COORDINAR» porque es lo que hay
// que hacer. Las de Monitoreo enseñaban el estado y dejaban que el agendador lo
// tradujera a una acción en su cabeza, fila por fila, 193 veces.
import { describe, expect, it } from "vitest";
import { queTocaConCadaAula } from "./queTocaConCadaAula";

const CORTE = "2026-08-22";

describe("queTocaConCadaAula", () => {
  it("sin contactar, se llama", () => {
    expect(queTocaConCadaAula({ sample_status: "sin_contactar" }, CORTE))
      .toBe("Llamar al docente");
  });

  it("contactada y sin fecha, se cierra la fecha —no se vuelve a empezar", () => {
    // Es el caso que más se atasca. Decir «llamar» otra vez empezaría de cero un
    // trabajo que ya avanzó.
    expect(queTocaConCadaAula({ sample_status: "agendada" }, CORTE)).toBe("Cerrar fecha");
    expect(queTocaConCadaAula({ sample_status: "reagendada" }, CORTE)).toBe("Cerrar fecha");
  });

  it("con fecha por venir, sólo esperar", () => {
    expect(queTocaConCadaAula({ sample_status: "agendada", scheduled_date: "2026-08-30" }, CORTE))
      .toBe("Esperar al día");
  });

  it("la fecha pasó y no hay parte: hay que confirmar", () => {
    expect(queTocaConCadaAula({ sample_status: "agendada", scheduled_date: "2026-08-11" }, CORTE))
      .toBe("Confirmar si se aplicó");
  });

  it("con parte de campo ya no toca nada, y se dice por qué", () => {
    // **«Aplicada» y no «—».** El guion decía bien que no toca nada y no decía
    // por qué, y en la misma fila la columna de al lado marca «Sin contactar»
    // —`sample_status` llega vacío del libro y el motor lo normaliza así—. Las
    // dos juntas se leen como un aula olvidada: medido con la simulación de
    // campo, CH 1 a CH 5 salían «Sin contactar · —» estando aplicadas.
    expect(queTocaConCadaAula(
      { sample_status: "agendada", scheduled_date: "2026-08-11", applied_at: "2026-08-11" }, CORTE,
    )).toBe("Aplicada");
    expect(queTocaConCadaAula({ operational_status: "aplicada" }, CORTE)).toBe("Aplicada");
    expect(queTocaConCadaAula({ operational_status: "cerrada" }, CORTE)).toBe("Aplicada");
    // Y manda sobre el estado de muestra vacío, que es el caso de la simulación.
    expect(queTocaConCadaAula(
      { sample_status: "sin_contactar", operational_status: "aplicada" }, CORTE,
    )).toBe("Aplicada");
  });

  it("una reemplazada sale del trabajo del agendador", () => {
    // Su reserva ocupó su sitio: llamar a ese docente sería un error.
    expect(queTocaConCadaAula({ sample_status: "reemplazada" }, CORTE)).toBe("Reemplazada");
  });

  it("una que está en reserva tampoco se llama", () => {
    expect(queTocaConCadaAula({ sample_status: "en_reserva" }, CORTE)).toBe("En reserva");
  });

  it("sin corte no acusa a nadie de atraso", () => {
    // Sin día contra el que medir, una fecha pasada no se puede declarar vencida.
    expect(queTocaConCadaAula({ sample_status: "agendada", scheduled_date: "2026-01-01" }, ""))
      .toBe("Esperar al día");
  });

  it("los estados llegan como el libro los escribe", () => {
    // «Sin contactar», «EN RESERVA 1»… el motor los normaliza, pero la tabla
    // recibe lo que haya: espacios, mayúsculas y guiones no deben despistar.
    expect(queTocaConCadaAula({ sample_status: "Sin Contactar" }, CORTE)).toBe("Llamar al docente");
    expect(queTocaConCadaAula({ sample_status: "EN-RESERVA" }, CORTE)).toBe("En reserva");
  });
});
