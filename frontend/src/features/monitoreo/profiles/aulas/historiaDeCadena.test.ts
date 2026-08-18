import { describe, expect, test } from "vitest";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { historiaDeCadena } from "./historiaDeCadena";
import { consumoDeCadena } from "./consumoDeCadena";

function titular(codigo: string, validas: number, meta: number, facultad = "Derecho"): MonitoreoAulasPlanRow {
  return {
    operational_code: codigo, sample_role: "titular", faculty: facultad,
    respuestas_validas: validas, expected_valid: meta, sample_status: "agendada",
  } as unknown as MonitoreoAulasPlanRow;
}

function reserva(codigo: string, de: string, orden: number, validas: number, meta: number): MonitoreoAulasPlanRow {
  return {
    operational_code: codigo, sample_role: "chain_reserve", replacement_for: de, titular_operational_code: de,
    replacement_order: orden, respuestas_validas: validas, expected_valid: meta,
    sample_status: "agendada",
  } as unknown as MonitoreoAulasPlanRow;
}

describe("historiaDeCadena", () => {
  test("dice cuál eslabón cerró la meta", () => {
    const res = historiaDeCadena([
      titular("CH 4", 5, 30),
      reserva("R 4.1", "CH 4", 1, 31, 30),
    ]);
    expect(res.historias).toHaveLength(1);
    expect(res.historias[0].cerro).toBe("R 4.1");
    expect(res.historias[0].desenlace).toBe("reemplazo");
    expect(res.cerraronEnReemplazo).toBe(1);
  });

  test("el cierre NO se acumula entre eslabones", () => {
    // 20 + 20 son 40 y la meta es 30, pero ningún aula llegó a la suya: cada
    // eslabon lleva su propio aforo elegible. Sumarlos diria que la cadena
    // cerro cuando en realidad ninguna aula alcanzo su meta.
    const res = historiaDeCadena([
      titular("CH 9", 20, 30),
      reserva("R 9.1", "CH 9", 1, 20, 30),
    ]);
    expect(res.historias[0].cerro).toBe("");
    expect(res.historias[0].desenlace).toBe("abierta");
    expect(res.historias[0].validas).toBe(40);
  });

  test("una cadena que cerró en el titular se distingue", () => {
    const res = historiaDeCadena([
      titular("CH 1", 31, 30),
      reserva("R 1.1", "CH 1", 1, 0, 30),
    ]);
    expect(res.historias[0].desenlace).toBe("titular");
    expect(res.cerraronEnTitular).toBe(1);
  });

  test("ordena los eslabones por su posición en la cadena", () => {
    const res = historiaDeCadena([
      reserva("R 2.2", "CH 2", 2, 0, 30),
      titular("CH 2", 4, 30),
      reserva("R 2.1", "CH 2", 1, 8, 30),
    ]);
    expect(res.historias[0].eslabones.map((e) => e.codigo)).toEqual(["CH 2", "R 2.1", "R 2.2"]);
    expect(res.historias[0].eslabones[0].orden).toBe(0);
  });

  test("los titulares sin reserva no llenan la vista", () => {
    // 170 filas de una sola línea no cuentan ninguna historia: se cuentan aparte.
    const res = historiaDeCadena([
      titular("CH 5", 30, 30),
      titular("CH 6", 10, 30),
      titular("CH 7", 4, 30),
      reserva("R 7.1", "CH 7", 1, 31, 30),
    ]);
    expect(res.historias).toHaveLength(1);
    expect(res.sinReserva).toBe(2);
  });

  test("las abiertas van primero: son las que piden decisión", () => {
    const res = historiaDeCadena([
      titular("CH 1", 31, 30), reserva("R 1.1", "CH 1", 1, 0, 30),
      titular("CH 2", 2, 30), reserva("R 2.1", "CH 2", 1, 3, 30),
    ]);
    expect(res.historias[0].titular).toBe("CH 2");
    expect(res.historias[0].desenlace).toBe("abierta");
    expect(res.abiertas).toBe(1);
  });
});

describe("las tres superficies de la cadena cuentan lo mismo", () => {
  // La historia, el gráfico de consumo y el contador de la cabecera hablan del
  // mismo hecho. Medido el 2026-08-17: la cabecera decía «50 filas» y la lectura
  // «3 con un reemplazo · 21 sin cerrar», que suman 24; y el mismo 146 salía como
  // «no necesitaron reemplazo» en la lectura y como «no tienen ninguna reserva,
  // sus metas quedan sin cubrir si caen» en el pie del gráfico. Números que
  // coinciden pueden estar contando cosas opuestas.
  const plan = [
    // Cadena con reserva: entra en `historias` y en el gráfico.
    { operational_code: "CH 1", sample_role: "titular", eligible_n: 30, expected_valid: 20, respuestas_validas: 0 },
    { operational_code: "R 1.1", sample_role: "chain_reserve", replacement_for: "CH 1", titular_operational_code: "CH 1",
      sample_status: "agendada", eligible_n: 28, expected_valid: 20, respuestas_validas: 20 },
    // Titulares SIN reserva: el conjunto que las dos frases leían al revés.
    { operational_code: "CH 2", sample_role: "titular", eligible_n: 30, expected_valid: 20, respuestas_validas: 0 },
    { operational_code: "CH 3", sample_role: "titular", eligible_n: 30, expected_valid: 20, respuestas_validas: 0 },
  ] as unknown as Parameters<typeof historiaDeCadena>[0];

  test("la historia y el consumo cuentan el MISMO conjunto sin reserva", () => {
    const h = historiaDeCadena(plan);
    const c = consumoDeCadena(plan);
    expect(h.sinReserva).toBe(2);
    // El aserto que ata las dos superficies: si una cambia su criterio, la otra
    // lo dice. Antes coincidían por casualidad y se describían al revés.
    expect(c.sinReserva).toBe(h.sinReserva);
  });

  test("la cabecera cuenta CADENAS, la unidad de la lectura", () => {
    const h = historiaDeCadena(plan);
    // 1 cadena con reserva; los 2 titulares pelados no son cadenas.
    expect(h.historias.length).toBe(1);
    expect(h.cerraronEnTitular + h.cerraronEnReemplazo + h.abiertas).toBe(h.historias.length);
  });
});

test("la meta de una cadena es la del titular y no la suma de sus eslabones", () => {
  // El control: si se sumaran, esta cadena diria 40 —15 + 12 + 13— donde el
  // plan pide 15. Reemplazar un aula no multiplica lo que el estudio pide; la
  // reserva entra a cubrir la misma meta que dejo el titular. La columna «Meta»
  // de la tabla de cadenas abiertas sale de aqui, y salio VACIA en las 21
  // porque el campo no existia y el componente lo leia igual.
  const { historias } = historiaDeCadena([
    { operational_code: "CH 4", sample_role: "titular", faculty: "Letras",
      expected_valid: 15, respuestas_validas: 0, sample_status: "reemplazada" },
    { operational_code: "R 4.1", sample_role: "chain_reserve", replacement_for: "CH 4", titular_operational_code: "CH 4",
      replacement_order: 1, expected_valid: 12, respuestas_validas: 0, sample_status: "agendada" },
    { operational_code: "R 4.2", sample_role: "chain_reserve", replacement_for: "CH 4", titular_operational_code: "CH 4",
      replacement_order: 2, expected_valid: 13, respuestas_validas: 0, sample_status: "en_reserva" },
  ] as never);

  expect(historias).toHaveLength(1);
  expect(historias[0].meta).toBe(15);
});

test("los codigos se ordenan como numeros y no como texto", () => {
  // «CH 10» salia ANTES que «CH 2» y asi se veian las 24 cadenas en pantalla:
  // CH 2, CH 10, CH 11 … CH 24, CH 5, CH 6. El caso esta puesto para que
  // «ordenada» no pueda confundirse con el alfabetico, que aqui da otro orden.
  const fila = (code: string) => ([
    { operational_code: code, sample_role: "titular", faculty: "Letras",
      expected_valid: 10, respuestas_validas: 0, sample_status: "reemplazada" },
    { operational_code: `R ${code}`, sample_role: "chain_reserve", replacement_for: code, titular_operational_code: code,
      replacement_order: 1, expected_valid: 10, respuestas_validas: 0, sample_status: "agendada" },
  ]);
  const { historias } = historiaDeCadena(
    [...fila("CH 10"), ...fila("CH 2"), ...fila("CH 5")] as never,
  );

  expect(historias.map((h) => h.titular)).toEqual(["CH 2", "CH 5", "CH 10"]);
});

/**
 * El banco no cuenta como titular sin reserva.
 *
 * Las filas de `extra_reserve_pool` no dibujaban tarjeta —caen en la rama «sin
 * reserva»— pero sí engordaban ese contador, y es el que alimenta la frase
 * «ninguno de los N cursos-horario titulares tiene reserva asignada». Sobre el
 * estudio real, esa N pasaba a incluir 639 aulas que no son titulares de nada.
 */
describe("historiaDeCadena y el banco", () => {
  test("las reservas sueltas no cuentan como titulares sin reserva", () => {
    const banco = (codigo: string) => ({
      operational_code: codigo,
      sample_role: "extra_reserve_pool",
    } as unknown as MonitoreoAulasPlanRow);

    const res = historiaDeCadena([
      { operational_code: "CH 9", sample_role: "titular" } as unknown as MonitoreoAulasPlanRow,
      banco("EXTRA 1"), banco("EXTRA 2"), banco("EXTRA 3"),
    ]);

    // Un titular sin reserva, no cuatro.
    expect(res.sinReserva).toBe(1);
  });
});
