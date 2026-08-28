import { describe, expect, it } from "vitest";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import {
  ayudaCon,
  bolsonExtra,
  cadenaPropia,
  candidatosDeReemplazo,
  parecidoCon,
  reservasDisponibles,
} from "./candidatosDeReemplazo";

const fila = (p: Partial<MonitoreoAulasPlanRow> & { operational_code: string }) =>
  ({
    selection_run_id: "sel", wave: "M1", orden: 0, classroom_id: p.operational_code,
    label: "", course_id: "", course_name: "", section: "", schedule: "",
    teacher: "", teacher_email: "", faculty: "ARQ", program: "", level: "3",
    stratum: "ARQ / F / G2", eligible_n: 30, expected_valid: 15, link: "", qr: "",
    collector_id: "", responsible: "", operational_status: "agendada",
    replacement_for: "", replacement_reason: "", replacement_note: "",
    ...p,
  }) as MonitoreoAulasPlanRow;

describe("qué reserva está DISPONIBLE", () => {
  it("libera la cadena cuyo titular ya se aplicó, y no la que sigue esperando", () => {
    const filas = [
      // Cadena A: su titular salió → sus reservas quedan al aire.
      fila({ operational_code: "CH 1", titular_operational_code: "CH 1", sample_role: "titular", operational_status: "aplicada" }),
      fila({ operational_code: "R 1.1", titular_operational_code: "CH 1", sample_role: "chain_reserve" }),
      fila({ operational_code: "R 1.2", titular_operational_code: "CH 1", sample_role: "chain_reserve" }),
      // Cadena B: nadie salió todavía → sus reservas siguen comprometidas.
      fila({ operational_code: "CH 2", titular_operational_code: "CH 2", sample_role: "titular" }),
      fila({ operational_code: "R 2.1", titular_operational_code: "CH 2", sample_role: "chain_reserve" }),
    ];
    const caido = filas.find((f) => f.operational_code === "CH 2")!;
    const libres = reservasDisponibles(filas, caido).map((f) => f.operational_code);
    expect(libres.sort()).toEqual(["R 1.1", "R 1.2"]);
  });

  it("también libera cuando el que salió fue un reemplazo, no el titular", () => {
    // «ya se aplicó su titular o ya se aplicó un reemplazo previo, entonces
    // esas quedan al aire».
    const filas = [
      fila({ operational_code: "CH 1", titular_operational_code: "CH 1", sample_role: "titular", operational_status: "reemplazada" }),
      fila({ operational_code: "R 1.1", titular_operational_code: "CH 1", sample_role: "chain_reserve", operational_status: "aplicada" }),
      fila({ operational_code: "R 1.2", titular_operational_code: "CH 1", sample_role: "chain_reserve" }),
      fila({ operational_code: "CH 2", titular_operational_code: "CH 2", sample_role: "titular" }),
    ];
    const caido = filas.find((f) => f.operational_code === "CH 2")!;
    const libres = reservasDisponibles(filas, caido).map((f) => f.operational_code);
    // R 1.1 no aparece: es la que cubrió el slot. R 1.2 sí.
    expect(libres).toEqual(["R 1.2"]);
  });

  it("no ofrece la cadena del propio caído como si fuera ajena", () => {
    const filas = [
      fila({ operational_code: "CH 1", titular_operational_code: "CH 1", sample_role: "titular", operational_status: "aplicada" }),
      fila({ operational_code: "R 1.1", titular_operational_code: "CH 1", sample_role: "chain_reserve" }),
    ];
    const caido = filas[0];
    expect(reservasDisponibles(filas, caido)).toEqual([]);
    // pero sí como su propia cadena, que es lo que va primero
    expect(cadenaPropia(filas, caido).map((f) => f.operational_code)).toEqual(["R 1.1"]);
  });

  it("un estado nuevo que nadie mapeó deja la reserva comprometida, no libre", () => {
    // La lista de estados que LIBERAN es cerrada a propósito. Si fuera al
    // revés, un estado desconocido soltaría reservas que su cadena necesita.
    const filas = [
      fila({ operational_code: "CH 1", titular_operational_code: "CH 1", sample_role: "titular", operational_status: "estado_que_nadie_declaro" }),
      fila({ operational_code: "R 1.1", titular_operational_code: "CH 1", sample_role: "chain_reserve" }),
      fila({ operational_code: "CH 2", titular_operational_code: "CH 2", sample_role: "titular" }),
    ];
    const caido = filas.find((f) => f.operational_code === "CH 2")!;
    expect(reservasDisponibles(filas, caido)).toEqual([]);
  });
});

describe("el parecido nombra lo que se concede", () => {
  const caido = fila({ operational_code: "CH 1", stratum: "ARQ / M / G1", eligible_n: 20, faculty: "ARQ", level: "3" });

  it("misma celda no lleva concesiones", () => {
    const r = parecidoCon(caido, fila({ operational_code: "X", stratum: "ARQ / M / G1", eligible_n: 20 }));
    expect(r.concesiones).toEqual([]);
    expect(r.parecido).toBeGreaterThan(0.9);
  });

  it("otro sexo dominante se dice, y en palabras", () => {
    const r = parecidoCon(caido, fila({ operational_code: "X", stratum: "ARQ / F / G1", eligible_n: 20 }));
    expect(r.concesiones.join(" ")).toMatch(/femenina/);
  });

  it("otra facultad tapa las demás concesiones: es la que manda", () => {
    const r = parecidoCon(caido, fila({ operational_code: "X", faculty: "DERECHO", stratum: "DERECHO / F / G4", eligible_n: 20 }));
    expect(r.concesiones).toHaveLength(1);
    expect(r.concesiones[0]).toMatch(/otra facultad/);
  });

  it("una diferencia grande de tamaño se advierte con las dos cifras", () => {
    const r = parecidoCon(caido, fila({ operational_code: "X", stratum: "ARQ / M / G1", eligible_n: 60 }));
    expect(r.concesiones.join(" ")).toContain("60");
    expect(r.concesiones.join(" ")).toContain("20");
  });
});

describe("la ayuda mide cierre de brecha, no tamaño", () => {
  const conSexo = (m: number, h: number) =>
    fila({ operational_code: "X", sex_top_1: "F", sex_top_1_n: m, sex_top_2_n: h, tasa_efectividad_aula: 1 } as never);

  it("sin brecha, ninguna ayuda", () => {
    expect(ayudaCon(conSexo(30, 10), { mujeres: 0, hombres: 0 })).toBe(0);
  });

  it("no acredita más allá de la brecha", () => {
    // Traer 200 mujeres donde faltan 30 no es mejor que traer 30.
    const a = ayudaCon(conSexo(200, 0), { mujeres: 30, hombres: 0 });
    const b = ayudaCon(conSexo(30, 0), { mujeres: 30, hombres: 0 });
    expect(a).toBe(b);
    expect(a).toBe(1);
  });

  it("lee el sexo dominante y no asume que el primero es mujer", () => {
    const dominanteM = fila({ operational_code: "X", sex_top_1: "M", sex_top_1_n: 40, sex_top_2_n: 5, tasa_efectividad_aula: 1 } as never);
    // Faltan mujeres: este aula trae 5, no 40.
    expect(ayudaCon(dominanteM, { mujeres: 100, hombres: 0 })).toBeCloseTo(0.05, 5);
  });
});

describe("el orden de la cadena propia es el del sorteo, no el de la puntuación", () => {
  it("respeta replacement_order aunque otro eslabón se parezca más", () => {
    const filas = [
      fila({ operational_code: "CH 1", titular_operational_code: "CH 1", sample_role: "titular", stratum: "ARQ / M / G1" }),
      // R 1.2 se parece más al caído, pero R 1.1 es el reemplazo 1.
      fila({ operational_code: "R 1.1", titular_operational_code: "CH 1", sample_role: "chain_reserve", replacement_order: 1, stratum: "ARQ / F / G4" }),
      fila({ operational_code: "R 1.2", titular_operational_code: "CH 1", sample_role: "chain_reserve", replacement_order: 2, stratum: "ARQ / M / G1" }),
    ];
    const r = candidatosDeReemplazo(filas, filas[0]);
    expect(r.cadena.map((c) => c.fila.operational_code)).toEqual(["R 1.1", "R 1.2"]);
    // …y la puntuación viaja igual, para poder enseñarla
    expect(r.cadena[1].parecido).toBeGreaterThan(r.cadena[0].parecido);
  });
});

describe("el bolsón extra", () => {
  it("incluye las aulas de una ampliación declarada, que también son extra", () => {
    const filas = [
      fila({ operational_code: "E1", sample_role: "extra_reserve_pool" }),
      fila({ operational_code: "E2", sample_role: "extra_reserve_pool", equivalence_level: "reserva_extra" }),
      fila({ operational_code: "E3", sample_role: "extra_reserve_pool", operational_status: "aplicada" }),
      fila({ operational_code: "CH 1", sample_role: "titular" }),
    ];
    expect(bolsonExtra(filas).map((f) => f.operational_code)).toEqual(["E1", "E2"]);
  });
});

describe("nunca devuelve «no hay reemplazo»", () => {
  it("con la cadena agotada, sigue ofreciendo otra cadena y el bolsón", () => {
    const filas = [
      fila({ operational_code: "CH 1", titular_operational_code: "CH 1", sample_role: "titular", stratum: "ARQ / M / G1" }),
      fila({ operational_code: "CH 2", titular_operational_code: "CH 2", sample_role: "titular", operational_status: "aplicada" }),
      fila({ operational_code: "R 2.1", titular_operational_code: "CH 2", sample_role: "chain_reserve", stratum: "ARQ / F / G1" }),
      fila({ operational_code: "E1", sample_role: "extra_reserve_pool", stratum: "ARQ / F / G2" }),
    ];
    const r = candidatosDeReemplazo(filas, filas[0], { mujeres: 20, hombres: 0 });
    expect(r.cadena).toHaveLength(0);
    expect(r.otra_cadena.map((c) => c.fila.operational_code)).toEqual(["R 2.1"]);
    expect(r.extra.map((c) => c.fila.operational_code)).toEqual(["E1"]);
    // y cada uno dice en qué se aleja
    expect(r.otra_cadena[0].concesiones.length).toBeGreaterThan(0);
  });
});
