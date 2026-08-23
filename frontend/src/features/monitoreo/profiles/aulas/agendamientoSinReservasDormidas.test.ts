// «0 de 700 que se van a visitar», al pie de una tabla de 193.
//
// El KPI contaba las 507 reservas encadenadas como aulas por agendar. No es sólo
// una cifra descuadrada: nadie va a llamar a los docentes de esas 507. Una
// reserva entra en juego el día que su titular se cae, y hasta entonces pedirle
// cita sería llamar a un aula que no toca.
//
// La regla de «dormida» es la del motor: una `chain_reserve` con estado vacío,
// `en_reserva` o `sin_contactar` está esperando.
import { describe, expect, it } from "vitest";
import { agendamiento } from "./agendamiento";

const aula = (rol: string, estado = "", extra: Record<string, unknown> = {}) =>
  ({ sample_role: rol, sample_status: estado, ...extra }) as Record<string, unknown>;

describe("qué aulas se van a agendar de verdad", () => {
  it("las reservas dormidas no cuentan como visitas", () => {
    const r = agendamiento([
      aula("titular"),
      aula("chain_reserve", "en_reserva"),
      aula("chain_reserve", "sin_contactar"),
      aula("chain_reserve", ""),
    ]);
    expect(r.enJuego).toBe(1);
  });

  it("una reserva activada sí se agenda", () => {
    // Su titular cayó: ahora hay que llamar a este docente.
    const r = agendamiento([aula("titular"), aula("chain_reserve", "agendada")]);
    expect(r.enJuego).toBe(2);
  });

  it("el banco nunca se agenda", () => {
    expect(agendamiento([aula("titular"), aula("extra_reserve_pool", "agendada")]).enJuego).toBe(1);
  });

  it("una titular reemplazada sale de la cuenta", () => {
    // Su reserva ocupó su sitio: llamarla otra vez sería un error.
    expect(agendamiento([aula("titular", "reemplazada"), aula("titular")]).enJuego).toBe(1);
  });

  it("los estados llegan como el libro los escribe", () => {
    // «EN RESERVA 1», «Sin contactar»: el motor los normaliza, la tabla recibe
    // lo que haya.
    expect(agendamiento([aula("chain_reserve", "EN RESERVA")]).enJuego).toBe(0);
    expect(agendamiento([aula("chain_reserve", "Sin Contactar")]).enJuego).toBe(0);
  });

  it("un titular sin estado sigue siendo una visita", () => {
    // Sin contactar todavía es exactamente el trabajo del agendador.
    expect(agendamiento([aula("titular", "")]).enJuego).toBe(1);
  });
});
