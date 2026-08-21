import { describe, expect, it } from "vitest";
import { esVisitaComprometida } from "./visitaComprometida";

/**
 * El módulo lleva cuatro decisiones de dominio en su cabecera y ninguna estaba
 * fijada: se podían romper las cuatro sin que nada se pusiera rojo. La medición
 * que lo motivó está en su propio comentario — de 269 filas con fecha por
 * delante del corte, 106 no eran visitas.
 */
describe("esVisitaComprometida", () => {
  it("una fila agendada es una visita por hacer", () => {
    expect(esVisitaComprometida("agendada")).toBe(true);
  });

  it("lo que duerme en reserva o ya fue reemplazado NO es una visita", () => {
    // Las 106 que tapaban la brecha: 80 esperando que caiga alguien y 26 que ya
    // cayeron. Contarlas como trabajo comprometido esconde la brecha justo
    // donde la alerta existe para verla.
    expect(esVisitaComprometida("en_reserva")).toBe(false);
    expect(esVisitaComprometida("reemplazada")).toBe(false);
    expect(esVisitaComprometida("sin_contactar")).toBe(false);
    // Así escribe el equipo «todavía nada aquí» en el Excel.
    expect(esVisitaComprometida("-")).toBe(false);
  });

  it("reconoce «en reserva 3», que es como lo escribe el Excel", () => {
    // El normalizador convierte unas y deja otras, así que llegan las dos
    // formas. Sin el prefijo, una reserva del libro contaría como visita.
    expect(esVisitaComprometida("en reserva 3")).toBe(false);
    expect(esVisitaComprometida("En Reserva 11")).toBe(false);
    expect(esVisitaComprometida("en_reserva 2")).toBe(false);
  });

  it("un estado que NO se reconoce cuenta como visita, no se descarta", () => {
    // Es una lista de lo que descalifica, no una lista de lo permitido: un
    // allow-list de «agendada» dejaría la proyección en cero, y en silencio, en
    // un estudio que use «contactada» o «planificada». Proyectar de más se ve;
    // proyectar de menos no.
    expect(esVisitaComprometida("contactada")).toBe(true);
    expect(esVisitaComprometida("planificada")).toBe(true);
    expect(esVisitaComprometida("un estado que nadie ha visto")).toBe(true);
  });

  it("una fila con fecha y SIN estado cuenta: la fecha es el hecho positivo", () => {
    // Un plan recién importado no trae estado todavía.
    expect(esVisitaComprometida("")).toBe(true);
    expect(esVisitaComprometida(null)).toBe(true);
    expect(esVisitaComprometida(undefined)).toBe(true);
  });

  it("no depende de mayúsculas ni de espacios sobrantes", () => {
    expect(esVisitaComprometida("  EN_RESERVA  ")).toBe(false);
    expect(esVisitaComprometida("Reemplazada")).toBe(false);
  });
});
