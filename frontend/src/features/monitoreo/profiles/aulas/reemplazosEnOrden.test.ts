import { describe, expect, it } from "vitest";
import { reemplazosEnOrdenDeCadena } from "./AulasMonitoreoPage";

/**
 * La cadena de reemplazos se lee de arriba abajo: la que cayó y detrás sus
 * reservas por turno.
 *
 * Medido en Consultas > Reemplazos el 2026-08-23, sobre las 507 reservas del
 * sorteo del 22: la tabla llegaba «R 3.3, R 11.3, R 2.3, R 1.3, R 1.1…», con
 * **146 saltos hacia atrás en 400 filas**, y cerraba en «R 158.1, R 156.1,
 * R 148.1» hacia abajo. Encontrar una cadena concreta obligaba a recorrerla
 * entera.
 */

const codigos = (filas: Array<Record<string, unknown>>) =>
  filas.map((f) => String(f.operational_code ?? ""));

const reserva = (cadena: number, orden: number, extra: Record<string, unknown> = {}) => ({
  operational_code: `R ${cadena}.${orden}`,
  sample_role: "chain_reserve",
  operational_sequence: cadena,
  replacement_order: orden,
  replacement_for: `CH ${cadena}`,
  ...extra,
});

describe("reemplazosEnOrdenDeCadena", () => {
  it("pone las cadenas en orden y las reservas por turno dentro de cada una", () => {
    const salida = reemplazosEnOrdenDeCadena([
      reserva(3, 3), reserva(11, 3), reserva(2, 3), reserva(1, 3), reserva(1, 1),
      reserva(1, 2), reserva(2, 1), reserva(2, 2), reserva(3, 1),
    ]);
    expect(codigos(salida)).toEqual([
      "R 1.1", "R 1.2", "R 1.3",
      "R 2.1", "R 2.2", "R 2.3",
      "R 3.1", "R 3.3",
      "R 11.3",
    ]);
  });

  it("ordena por número de cadena, no por texto: la 11 va después de la 2", () => {
    // Ordenar los códigos como texto pondría «R 11.1» entre «R 1.3» y «R 2.1»,
    // que es justo el desorden que se veía en pantalla.
    const salida = reemplazosEnOrdenDeCadena([reserva(11, 1), reserva(2, 1), reserva(1, 1)]);
    expect(codigos(salida)).toEqual(["R 1.1", "R 2.1", "R 11.1"]);
  });

  it("cuelga la reserva de su titular cuando no trae número de cadena", () => {
    // El motor no siempre rellena `operational_sequence` en esta lista; lo que
    // sí trae es a quién reemplaza.
    const salida = reemplazosEnOrdenDeCadena([
      { operational_code: "CH 2", sample_role: "titular", operational_sequence: 2 },
      { operational_code: "CH 1", sample_role: "titular", operational_sequence: 1 },
      { operational_code: "R 2.1", sample_role: "chain_reserve", replacement_for: "CH 2" },
      { operational_code: "R 1.1", sample_role: "chain_reserve", replacement_for: "CH 1" },
    ]);
    expect(codigos(salida)).toEqual(["CH 1", "R 1.1", "CH 2", "R 2.1"]);
  });

  it("usa `replacement_for` antes que el código del titular", () => {
    // Diferencia deliberada con la agenda: en esta lista una reserva puede
    // declarar a quién reemplaza sin traer `titular_operational_code`.
    const salida = reemplazosEnOrdenDeCadena([
      { operational_code: "CH 5", sample_role: "titular", operational_sequence: 5 },
      { operational_code: "CH 4", sample_role: "titular", operational_sequence: 4 },
      { operational_code: "R x", sample_role: "chain_reserve", replacement_for: "CH 4" },
    ]);
    expect(codigos(salida)).toEqual(["CH 4", "R x", "CH 5"]);
  });

  it("manda el banco de extras al final, detrás de todas las cadenas", () => {
    // Los extras son capacidad sin asignar: no son el siguiente turno de nadie.
    const salida = reemplazosEnOrdenDeCadena([
      { operational_code: "EXTRA 1", sample_role: "extra_reserve_pool" },
      reserva(2, 1),
      reserva(1, 1),
    ]);
    expect(codigos(salida)).toEqual(["R 1.1", "R 2.1", "EXTRA 1"]);
  });

  it("no pierde filas ni las duplica", () => {
    // Ordenar no puede tragarse una fila: una reserva que desaparece es una
    // que nadie va a activar.
    const entrada = [reserva(3, 1), reserva(1, 2), { operational_code: "raro" }, reserva(1, 1)];
    const salida = reemplazosEnOrdenDeCadena(entrada);
    expect(salida).toHaveLength(entrada.length);
    expect(new Set(codigos(salida))).toEqual(new Set(codigos(entrada)));
  });

  it("tolera una lista ausente sin reventar la pantalla", () => {
    expect(reemplazosEnOrdenDeCadena(null)).toEqual([]);
    expect(reemplazosEnOrdenDeCadena(undefined)).toEqual([]);
  });
});
