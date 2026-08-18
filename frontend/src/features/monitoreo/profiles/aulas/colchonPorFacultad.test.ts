import { describe, expect, it } from "vitest";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { colchonPorFacultad } from "./consumoDeCadena";

const fila = (f: Partial<MonitoreoAulasPlanRow>) => f as MonitoreoAulasPlanRow;

describe("colchonPorFacultad", () => {
  it("no suma la cadena sin dotar con la agotada", () => {
    // Dos cadenas de Derecho: una que nunca tuvo reserva y otra que gastó la
    // suya. Sumadas darían «2 sin colchón» y dirían que el campo se comió un
    // colchón que a la primera jamás le dieron.
    const [derecho] = colchonPorFacultad([
      fila({ operational_code: "CH 1", faculty: "Derecho", titular_operational_code: "CH 1" }),
      fila({ operational_code: "CH 2", faculty: "Derecho", titular_operational_code: "CH 2" }),
      fila({
        operational_code: "R 2.1", faculty: "Derecho", sample_role: "chain_reserve",
        titular_operational_code: "CH 2", sample_status: "agendada",
      }),
    ]);
    expect(derecho.nuncaTuvo).toBe(1);
    expect(derecho.agotadas).toBe(1);
    expect(derecho.gastadas).toBe(1);
    expect(derecho.libres).toBe(0);
  });

  it("una cadena con reserva libre no está agotada", () => {
    const [f] = colchonPorFacultad([
      fila({ operational_code: "CH 1", faculty: "Letras", titular_operational_code: "CH 1" }),
      fila({
        operational_code: "R 1.1", faculty: "Letras", sample_role: "chain_reserve",
        titular_operational_code: "CH 1", sample_status: "en_reserva",
      }),
    ]);
    expect(f.agotadas).toBe(0);
    expect(f.nuncaTuvo).toBe(0);
    expect(f.libres).toBe(1);
  });

  it("la reserva cuenta para la facultad de su titular, no para la suya", () => {
    // Sólo repone la cuota de la facultad del aula que cayó: contarla en la
    // suya diría que Ciencias tiene colchón cuando el aula caída es de Derecho.
    const salida = colchonPorFacultad([
      fila({ operational_code: "CH 1", faculty: "Derecho", titular_operational_code: "CH 1" }),
      fila({
        operational_code: "R 1.1", faculty: "Ciencias", sample_role: "chain_reserve",
        titular_operational_code: "CH 1", sample_status: "en_reserva",
      }),
    ]);
    expect(salida).toHaveLength(1);
    expect(salida[0]).toMatchObject({ facultad: "Derecho", libres: 1, agotadas: 0 });
  });

  it("los extras no entran: no reponen ninguna cadena", () => {
    const salida = colchonPorFacultad([
      fila({ operational_code: "CH 1", faculty: "Derecho", titular_operational_code: "CH 1" }),
      fila({
        operational_code: "EXTRA 1", faculty: "Derecho", sample_role: "extra_reserve_pool",
        titular_operational_code: "EXTRA 1", sample_status: "en_reserva",
      }),
    ]);
    expect(salida[0].titulares).toBe(1);
    expect(salida[0].libres).toBe(0);
    expect(salida[0].nuncaTuvo).toBe(1);
  });

  it("abre por la facultad que más cadenas agotó", () => {
    const salida = colchonPorFacultad([
      fila({ operational_code: "A1", faculty: "Poca", titular_operational_code: "A1" }),
      fila({
        operational_code: "RA1", faculty: "Poca", sample_role: "chain_reserve",
        titular_operational_code: "A1", sample_status: "agendada",
      }),
      fila({ operational_code: "B1", faculty: "Mucha", titular_operational_code: "B1" }),
      fila({ operational_code: "B2", faculty: "Mucha", titular_operational_code: "B2" }),
      fila({
        operational_code: "RB1", faculty: "Mucha", sample_role: "chain_reserve",
        titular_operational_code: "B1", sample_status: "agendada",
      }),
      fila({
        operational_code: "RB2", faculty: "Mucha", sample_role: "chain_reserve",
        titular_operational_code: "B2", sample_status: "reemplazada",
      }),
    ]);
    expect(salida.map((f) => f.facultad)).toEqual(["Mucha", "Poca"]);
  });
});
