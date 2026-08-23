import { describe, expect, it } from "vitest";
import { formaDelOperativo } from "./formaDelOperativo";
import type { CollectionUnit } from "../../api/recopiladores";
// La lectura del respaldo es una frase con reglas, y en esta casa eso se prueba.
import { lecturaDelRespaldo } from "./PlanSection";

const u = (role: string, seq?: number, id = Math.random().toString(36)): CollectionUnit => ({
  unit_id: id,
  label: "x",
  role,
  dimensions: seq === undefined ? {} : { operational_sequence: seq },
});

describe("formaDelOperativo", () => {
  it("separa visitas, respaldo encadenado y banco", () => {
    const f = formaDelOperativo([
      u("titular", 1), u("chain_reserve", 1), u("chain_reserve", 1),
      u("titular", 2), u("chain_reserve", 2),
      u("extra_reserve_pool"), u("extra_reserve_pool"),
    ]);
    expect(f).toMatchObject({ titulares: 2, reservas: 3, banco: 2 });
  });

  it("mide la cadena más corta y la más honda", () => {
    // Es lo que contesta «¿tengo con qué?»: 2 a 4 dice que ninguna aula está
    // sola, y el mínimo es la cifra que manda, no la media.
    const f = formaDelOperativo([
      u("titular", 1), u("chain_reserve", 1), u("chain_reserve", 1),
      u("titular", 2), u("chain_reserve", 2), u("chain_reserve", 2),
      u("chain_reserve", 2), u("chain_reserve", 2),
    ]);
    expect(f.minReservas).toBe(2);
    expect(f.maxReservas).toBe(4);
    expect(f.sinReserva).toBe(0);
  });

  it("cuenta el titular que se quedó sin ninguna reserva", () => {
    // Es el riesgo del operativo: si esa aula cae, no hay plan B. No puede
    // diluirse en un promedio.
    const f = formaDelOperativo([
      u("titular", 1), u("chain_reserve", 1),
      u("titular", 2),
    ]);
    expect(f.sinReserva).toBe(1);
    expect(f.minReservas).toBe(0);
  });

  it("un titular sin número de cadena cuenta como sin respaldo medido", () => {
    // No se puede emparejar con reservas, así que decir que tiene respaldo
    // sería inventarlo. Se declara para que la pantalla no prometa cobertura
    // que no midió.
    const f = formaDelOperativo([u("titular"), u("titular", 1), u("chain_reserve", 1)]);
    expect(f.titulares).toBe(2);
    expect(f.sinReserva).toBe(1);
  });

  it("el banco no cuenta como respaldo de nadie", () => {
    // 1.916 extras no hacen que una cadena vacía deje de estarlo: son
    // capacidad sin asignar, no el siguiente turno de una titular concreta.
    const f = formaDelOperativo([
      u("titular", 1),
      ...Array.from({ length: 50 }, () => u("extra_reserve_pool")),
    ]);
    expect(f.banco).toBe(50);
    expect(f.reservas).toBe(0);
    expect(f.sinReserva).toBe(1);
  });

  it("tolera la secuencia como texto, que es como llega de algunos planes", () => {
    const filas: CollectionUnit[] = [
      { unit_id: "t", label: "x", role: "titular", dimensions: { operational_sequence: "7" } },
      { unit_id: "r", label: "x", role: "chain_reserve", dimensions: { operational_sequence: "7" } },
    ];
    expect(formaDelOperativo(filas)).toMatchObject({ titulares: 1, reservas: 1, sinReserva: 0 });
  });

  it("un plan vacío no inventa una forma", () => {
    expect(formaDelOperativo([])).toMatchObject({
      titulares: 0, reservas: 0, banco: 0, minReservas: 0, maxReservas: 0, sinReserva: 0,
    });
  });
});

const forma = (p: Partial<ReturnType<typeof formaDelOperativo>>) => ({
  titulares: 193, reservas: 507, banco: 1916, minReservas: 2, maxReservas: 4, sinReserva: 0, ...p,
});

describe("lecturaDelRespaldo", () => {
  it("dice el rango cuando ninguna aula está sola", () => {
    expect(lecturaDelRespaldo(forma({})))
      .toBe("Ninguna aula se queda sin plan B: cada una lleva entre 2 y 4 reservas detrás.");
  });

  it("las aulas sin respaldo mandan sobre cualquier otra lectura", () => {
    // Es la única parte accionable del panel: un plan con 2 a 4 reservas de
    // media y once aulas sin ninguna está DESCUBIERTO en esas once, y decir el
    // rango primero lo esconde detrás de una buena noticia.
    const texto = lecturaDelRespaldo(forma({ sinReserva: 11, minReservas: 0 }));
    expect(texto).toContain("11 cursos-horario se quedaron sin ninguna reserva");
    expect(texto).toContain("no hay plan B");
    expect(texto).not.toContain("Ninguna aula se queda");
  });

  it("no dice «1 cursos-horario se quedaron»", () => {
    expect(lecturaDelRespaldo(forma({ sinReserva: 1, minReservas: 0 })))
      .toBe("Un curso-horario se quedó sin ninguna reserva detrás: si cae, no hay plan B.");
  });

  it("no da un rango cuando todas las cadenas miden lo mismo", () => {
    // «entre 3 y 3 reservas» es un rango que no es un rango.
    expect(lecturaDelRespaldo(forma({ minReservas: 3, maxReservas: 3 })))
      .toBe("Cada aula lleva 3 reservas detrás.");
    expect(lecturaDelRespaldo(forma({ minReservas: 1, maxReservas: 1 })))
      .toBe("Cada aula lleva 1 reserva detrás.");
  });

  it("un plan sin aulas lo dice, en vez de afirmar que están cubiertas", () => {
    expect(lecturaDelRespaldo(forma({ titulares: 0, reservas: 0, minReservas: 0, maxReservas: 0 })))
      .toBe("Todavía no hay aulas en el plan.");
  });
});
