// La agenda es la vista del AGENDADOR, y él llama titular por titular.
//
// Listaba las 700 filas del plan —193 titulares y 507 reservas— al mismo nivel.
// Una reserva es un plan B que sólo entra en juego el día que su titular se
// declara caída: enseñárselas mezcladas multiplica su lista por 3,6 y le dice
// que hay 700 aulas que atender donde hay 193.
//
// Las reservas NO se esconden: se cuentan al lado del título.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const fuente = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "AulasMonitoreoPage.tsx"),
  "utf8",
);

describe("la agenda lista titulares y declara sus reservas", () => {
  it("filtra el banco y las reservas de cadena", () => {
    const cuerpo = (fuente.match(/function agendaRows[\s\S]*?\n}/) ?? [])[0] ?? "";
    expect(cuerpo).toContain("extra_reserve_pool");
    expect(cuerpo).toContain("chain_reserve");
  });

  it("cuenta las reservas en vez de esconderlas", () => {
    // Sin esto, las 507 desaparecerían sin dejar rastro y el agendador no sabría
    // que tiene plan B.
    expect(fuente).toContain("function agendaReservas");
    expect(fuente).toContain("reservas detrás");
  });

  it("la cuenta de reservas mira sólo las de cadena, no el banco", () => {
    // El banco es capacidad, no el plan B de nadie: sumarlo diría que hay 1 916
    // reservas donde hay 507.
    const cuerpo = (fuente.match(/function agendaReservas[\s\S]*?\n}/) ?? [])[0] ?? "";
    expect(cuerpo).toContain('=== "chain_reserve"');
    expect(cuerpo).not.toContain("extra_reserve_pool");
  });
});
