import { describe, expect, it } from "vitest";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { pronosticoDeCierre, sumarDiasDeCampo } from "./pronosticoDeCierre";

const fila = (f: Partial<MonitoreoRow>) => f as MonitoreoRow;
const aula = (codigo: string) => fila({ operational_code: codigo });
const aplicada = (codigo: string, fecha: string) =>
  fila({ operational_code: codigo, applied_at: `${fecha} 10:00` });

const planDe = (n: number) => Array.from({ length: n }, (_, i) => aula(`CH ${i + 1}`));

describe("pronosticoDeCierre", () => {
  it("proyecta al ritmo mediano y devuelve una banda, no un punto", () => {
    const partes = [
      aplicada("CH 1", "2026-08-10"), aplicada("CH 2", "2026-08-10"),
      aplicada("CH 3", "2026-08-11"),
      aplicada("CH 4", "2026-08-12"), aplicada("CH 5", "2026-08-12"), aplicada("CH 6", "2026-08-12"),
    ];
    const p = pronosticoDeCierre(partes, planDe(12));
    expect(p.aplicadas).toBe(6);
    expect(p.faltan).toBe(6);
    expect(p.ritmo).toBe(2);        // mediana de 2, 1, 3
    expect(p.ritmoLento).toBe(1);
    expect(p.ritmoRapido).toBe(3);
    expect(p.diasQueFaltan).toBe(3);
    // La banda va al revés: el ritmo lento da los días MÁS lejanos.
    expect(p.diasLento).toBe(6);
    expect(p.diasRapido).toBe(2);
  });

  it("con menos de tres días NO proyecta, y dice por qué", () => {
    // Dos días buenos seguidos darían una fecha que nadie puede sostener.
    const p = pronosticoDeCierre(
      [aplicada("CH 1", "2026-08-10"), aplicada("CH 2", "2026-08-11")],
      planDe(10),
    );
    expect(p.motivo).toBe("pocos-dias");
    expect(p.diasQueFaltan).toBeNull();
  });

  it("el banco no entra en el universo que hay que cerrar", () => {
    const plan = [aula("CH 1"), fila({ operational_code: "EXTRA 1", sample_role: "extra_reserve_pool" })];
    const p = pronosticoDeCierre([aplicada("CH 1", "2026-08-10")], plan);
    expect(p.universo).toBe(1);
    expect(p.motivo).toBe("ya-cerrado");
  });

  it("dos partes de la misma aula no son dos aulas aplicadas", () => {
    const p = pronosticoDeCierre(
      [aplicada("CH 1", "2026-08-11"), aplicada("CH 1", "2026-08-10")],
      planDe(5),
    );
    expect(p.aplicadas).toBe(1);
    // Se cuenta el día de la PRIMERA aplicación.
    expect(p.ultimaFecha).toBe("2026-08-10");
  });

  it("los días de campo saltan el fin de semana", () => {
    // 2026-08-14 es viernes: sumar un día de campo lleva al lunes 17, no al 15.
    expect(sumarDiasDeCampo("2026-08-14", 1)).toBe("2026-08-17");
    expect(sumarDiasDeCampo("2026-08-14", 5)).toBe("2026-08-21");
    expect(sumarDiasDeCampo("2026-08-14", 0)).toBe("2026-08-14");
  });
});
