import { describe, expect, it } from "vitest";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import {
  ayudaCon,
  reservaAdicionalDeLaFacultad,
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

describe("disponible son DOS condiciones, sobre dos ejes", () => {
  // El backend y esta vista lo preguntaban de dos maneras distintas. Ahora:
  // (1) su cadena ya no la necesita —eje de aplicación— y (2) ella misma sigue
  // sin desplegarse —eje de agendación—. Las dos hacen falta.
  const base = [
    fila({ operational_code: "CH 1", titular_operational_code: "CH 1", sample_role: "titular", operational_status: "aplicada" }),
    fila({ operational_code: "CH 2", titular_operational_code: "CH 2", sample_role: "titular" }),
  ];

  it("una reserva de cadena resuelta pero YA AGENDADA no está libre", () => {
    const filas = [...base,
      fila({ operational_code: "R 1.1", titular_operational_code: "CH 1", sample_role: "chain_reserve",
             sample_status: "agendada" } as never),
      fila({ operational_code: "R 1.2", titular_operational_code: "CH 1", sample_role: "chain_reserve",
             sample_status: "en_reserva" } as never),
    ];
    const caido = filas.find((f) => f.operational_code === "CH 2")!;
    expect(reservasDisponibles(filas, caido).map((f) => f.operational_code)).toEqual(["R 1.2"]);
  });

  it("el «-» del Excel cuenta como dormida, no como desplegada", () => {
    // 1.810 de 2.040 celdas de STATUS MUESTRA en 2025 llevan «-». Tratarlo como
    // desplegada dejaria la lista vacia teniendo reservas.
    const filas = [...base,
      fila({ operational_code: "R 1.1", titular_operational_code: "CH 1", sample_role: "chain_reserve",
             sample_status: "-" } as never),
    ];
    const caido = filas.find((f) => f.operational_code === "CH 2")!;
    expect(reservasDisponibles(filas, caido).map((f) => f.operational_code)).toEqual(["R 1.1"]);
  });

  it("«en reserva 3», como lo escribe el Excel, tambien es dormida", () => {
    const filas = [...base,
      fila({ operational_code: "R 1.1", titular_operational_code: "CH 1", sample_role: "chain_reserve",
             sample_status: "En reserva 3" } as never),
    ];
    const caido = filas.find((f) => f.operational_code === "CH 2")!;
    expect(reservasDisponibles(filas, caido)).toHaveLength(1);
  });

  it("un extra ya agendado sale de la reserva adicional", () => {
    const filas = [
      fila({ operational_code: "E1", sample_role: "extra_reserve_pool", sample_status: "en_reserva" } as never),
      fila({ operational_code: "E2", sample_role: "extra_reserve_pool", sample_status: "agendada" } as never),
    ];
    expect(reservaAdicionalDeLaFacultad(filas, "ARQ").map((f) => f.operational_code)).toEqual(["E1"]);
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

  it("quedarse corto en elegibles se advierte con las dos cifras", () => {
    const r = parecidoCon(caido, fila({ operational_code: "X", stratum: "ARQ / M / G1", eligible_n: 8 }));
    expect(r.concesiones.join(" ")).toContain("8");
    expect(r.concesiones.join(" ")).toContain("20");
  });

  it("traer más elegibles que el caído no se concede: es la ventaja que se busca", () => {
    const r = parecidoCon(caido, fila({ operational_code: "X", stratum: "ARQ / M / G1", eligible_n: 60 }));
    expect(r.concesiones).toEqual([]);
    expect(r.parecido).toBeCloseTo(1, 5);
  });
});

describe("la utilidad de elegibles crece con el candidato, no sólo se le parece", () => {
  const caido = fila({ operational_code: "CH 1", stratum: "ARQ / M / G1", eligible_n: 20, faculty: "ARQ", level: "3" });

  it("un candidato con más elegibles no puntúa peor que uno igual en tamaño", () => {
    // Igualar ya es la mejor situación posible en este eje -pasarse no puede
    // restar-; el crecimiento real de la utilidad al pasarse lo mide `ayuda`,
    // que sí escala con la composición real del aula, topada en la brecha.
    const igual = parecidoCon(caido, fila({ operational_code: "A", stratum: "ARQ / F / G4", eligible_n: 20 }));
    const grande = parecidoCon(caido, fila({ operational_code: "B", stratum: "ARQ / F / G4", eligible_n: 40 }));
    expect(grande.parecido).toBeCloseTo(igual.parecido, 5);
  });

  it("un candidato con menos elegibles puntúa peor, proporcional a lo que falta", () => {
    const mitad = parecidoCon(caido, fila({ operational_code: "C", stratum: "ARQ / F / G4", eligible_n: 10 }));
    const cuarto = parecidoCon(caido, fila({ operational_code: "D", stratum: "ARQ / F / G4", eligible_n: 5 }));
    expect(cuarto.parecido).toBeLessThan(mitad.parecido);
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
    expect(r.cadena.mejores.map((c) => c.fila.operational_code)).toEqual(["R 1.1", "R 1.2"]);
    // …y la puntuación viaja igual, para poder enseñarla
    expect(r.cadena.mejores[1].parecido).toBeGreaterThan(r.cadena.mejores[0].parecido);
  });
});

describe("la facultad es frontera dura, no una preferencia", () => {
  // «La reserva adicional es siempre siempre siempre dentro de la misma facultad, jamás de
  // otra.» Y medido sobre ULT2: 0 de 1.173 reservas de cadena cruzan facultad.
  // Un candidato de otra facultad no es un reemplazo peor: no es un reemplazo,
  // porque la cuota se reparte por facultad y sexo.
  const escena = [
    fila({ operational_code: "CH 1", titular_operational_code: "CH 1", sample_role: "titular", faculty: "ARQ", stratum: "ARQ / M / G1" }),
    // Otra cadena de SU facultad, ya resuelta
    fila({ operational_code: "CH 2", titular_operational_code: "CH 2", sample_role: "titular", faculty: "ARQ", stratum: "ARQ / F / G1", operational_status: "aplicada" }),
    fila({ operational_code: "R 2.1", titular_operational_code: "CH 2", sample_role: "chain_reserve", faculty: "ARQ", stratum: "ARQ / F / G1" }),
    // Otra cadena de OTRA facultad, tambien resuelta
    fila({ operational_code: "CH 9", titular_operational_code: "CH 9", sample_role: "titular", faculty: "DERECHO", stratum: "DERECHO / F / G4", operational_status: "aplicada" }),
    fila({ operational_code: "R 9.1", titular_operational_code: "CH 9", sample_role: "chain_reserve", faculty: "DERECHO", stratum: "DERECHO / F / G4" }),
    // Extras de las dos
    fila({ operational_code: "E-ARQ", sample_role: "extra_reserve_pool", faculty: "ARQ", stratum: "ARQ / F / G2" }),
    fila({ operational_code: "E-DER", sample_role: "extra_reserve_pool", faculty: "DERECHO", stratum: "DERECHO / F / G4" }),
  ];
  const caido = escena[0];

  it("la reserva adicional no ofrece extras de otra facultad", () => {
    expect(reservaAdicionalDeLaFacultad(escena, "ARQ").map((f) => f.operational_code)).toEqual(["E-ARQ"]);
  });

  it("las reservas al aire tampoco cruzan de facultad", () => {
    expect(reservasDisponibles(escena, caido).map((f) => f.operational_code)).toEqual(["R 2.1"]);
  });

  it("y el conjunto completo se queda dentro de la facultad del que cae", () => {
    const r = candidatosDeReemplazo(escena, caido, { mujeres: 40, hombres: 0 });
    const todos = [...r.cadena.mejores, ...r.otra_cadena.mejores, ...r.extra.mejores].map((c) => c.fila.faculty);
    expect(todos.every((f) => f === "ARQ")).toBe(true);
    // …aunque el de Derecho cerraria mas brecha: por eso el filtro va en el
    // origen y no en la puntuacion.
    expect([...r.otra_cadena.mejores, ...r.extra.mejores].map((c) => c.fila.operational_code)).not.toContain("E-DER");
  });
});

describe("la reserva adicional", () => {
  it("incluye las aulas de una ampliación declarada, que también son extra", () => {
    const filas = [
      fila({ operational_code: "E1", sample_role: "extra_reserve_pool" }),
      fila({ operational_code: "E2", sample_role: "extra_reserve_pool", equivalence_level: "reserva_extra" }),
      fila({ operational_code: "E3", sample_role: "extra_reserve_pool", operational_status: "aplicada" }),
      fila({ operational_code: "CH 1", sample_role: "titular" }),
    ];
    expect(reservaAdicionalDeLaFacultad(filas, "ARQ").map((f) => f.operational_code)).toEqual(["E1", "E2"]);
  });

  it("con el aula caída sin facultad no ofrece la reserva adicional de las demás", () => {
    // «La reserva adicional es siempre siempre siempre dentro de la misma facultad, jamás
    // de otra.» Un `!fac ||` desactivaba el filtro justo cuando la facultad
    // venía vacía, y entonces se ofrecía la reserva adicional ENTERA. El motor tampoco lo
    // ataja: exige que las dos facultades sean no vacías para rechazar.
    const filas = [
      fila({ operational_code: "E-ARQ", sample_role: "extra_reserve_pool", faculty: "ARQ" }),
      fila({ operational_code: "E-DER", sample_role: "extra_reserve_pool", faculty: "DERECHO" }),
    ];
    expect(reservaAdicionalDeLaFacultad(filas, "").map((f) => f.operational_code)).toEqual([]);
    expect(reservaAdicionalDeLaFacultad(filas, undefined).map((f) => f.operational_code)).toEqual([]);
  });

  it("si el estudio no reparte por facultad, la reserva adicional entera sigue disponible", () => {
    // El otro escenario del mismo cambio: cuando NADIE declara facultad, la
    // comparación es «"" === ""» y no se pierde nada. Sin este caso, endurecer
    // el filtro dejaría sin reserva adicional a los estudios que no usan facultades.
    const filas = [
      fila({ operational_code: "E1", sample_role: "extra_reserve_pool", faculty: "" }),
      fila({ operational_code: "E2", sample_role: "extra_reserve_pool", faculty: "" }),
    ];
    expect(reservaAdicionalDeLaFacultad(filas, "").map((f) => f.operational_code)).toEqual(["E1", "E2"]);
  });
});

describe("nunca devuelve «no hay reemplazo»", () => {
  it("con la cadena agotada, sigue ofreciendo otra cadena y la reserva adicional", () => {
    const filas = [
      fila({ operational_code: "CH 1", titular_operational_code: "CH 1", sample_role: "titular", stratum: "ARQ / M / G1" }),
      fila({ operational_code: "CH 2", titular_operational_code: "CH 2", sample_role: "titular", operational_status: "aplicada" }),
      fila({ operational_code: "R 2.1", titular_operational_code: "CH 2", sample_role: "chain_reserve", stratum: "ARQ / F / G1" }),
      fila({ operational_code: "E1", sample_role: "extra_reserve_pool", stratum: "ARQ / F / G2" }),
    ];
    const r = candidatosDeReemplazo(filas, filas[0], { mujeres: 20, hombres: 0 });
    expect(r.cadena.mejores).toHaveLength(0);
    expect(r.cadena.disponibles).toBe(0);
    expect(r.otra_cadena.mejores.map((c) => c.fila.operational_code)).toEqual(["R 2.1"]);
    expect(r.extra.mejores.map((c) => c.fila.operational_code)).toEqual(["E1"]);
    // y cada uno dice en qué se aleja
    expect(r.otra_cadena.mejores[0].concesiones.length).toBeGreaterThan(0);
  });
});


describe("el contador dice cuántas HAY, no cuántas se enseñan", () => {
  it("con más candidatos que el tope, `disponibles` no se recorta", () => {
    // Sobre el simulacro de campo malo, CH 1 tiene 9 reservas disponibles en su
    // cadena y la solapa decía «Su cadena 3» —el tope del motor— como si fuera
    // el inventario. Quien lo lee entiende que la cadena está casi agotada.
    const caido = fila({ operational_code: "CH 1", sample_role: "titular",
                         titular_operational_code: "CH 1" });
    const reservas = Array.from({ length: 9 }, (_, i) =>
      fila({
        operational_code: `R 1.${i + 1}`,
        sample_role: "chain_reserve", titular_operational_code: "CH 1",
        replacement_order: i + 1, sample_status: "en_reserva",
        operational_status: "planificada",
      }));
    const r = candidatosDeReemplazo([caido, ...reservas], caido);
    expect(r.cadena.disponibles).toBe(9);
    expect(r.cadena.mejores).toHaveLength(3);
  });
});

/**
 * **El candidato sin teléfono se propone, pero avisado y detrás.**
 *
 * Visto el 2026-09-11: R 85.1 encabezaba la cadena de CH 85 con el número
 * muerto, y ni el popover ni la tira lo decían. No se descarta —puede tener
 * otra vía— pero ponerlo primero manda a gastar la primera llamada en la que
 * ya se sabe perdida.
 */
describe("el candidato sin vía de contacto", () => {
  const reserva = (codigo: string, orden: number, call: string) =>
    fila({ operational_code: codigo, titular_operational_code: "CH 1",
           sample_role: "chain_reserve", replacement_order: orden,
           call_status: call } as never);

  it("se marca por el resultado de la llamada y no descarta al candidato", () => {
    const caido = fila({ operational_code: "CH 1", titular_operational_code: "CH 1",
                         sample_role: "titular", sample_status: "rechazo" });
    const filas = [
      caido,
      reserva("R 1.1", 1, "Número no existe"),
      reserva("R 1.2", 2, "Contactar después"),
    ];
    const res = candidatosDeReemplazo(filas, caido, { mujeres: 5, hombres: 5 });
    const por = Object.fromEntries(
      res.cadena.mejores.map((c) => [String(c.fila.operational_code), c.sinVia]));
    expect(por["R 1.1"]).toBe(true);
    expect(por["R 1.2"]).toBe(false);
    // Sigue estando: es el usuario quien decide si le busca otra vía.
    expect(res.cadena.disponibles).toBe(2);
  });

  it("dentro de su cadena NO se reordena: ahí manda el procedimiento", () => {
    // La reserva 1 va antes que la 2 aunque su teléfono esté muerto. Cambiar eso
    // es la decisión D4 —qué manda en el orden— y está en manos de Gonzalo: lo
    // que la app hace es AVISAR, no decidir por él.
    const caido = fila({ operational_code: "CH 1", titular_operational_code: "CH 1",
                         sample_role: "titular", sample_status: "rechazo" });
    const res = candidatosDeReemplazo(
      [caido, reserva("R 1.1", 1, "Número no existe"), reserva("R 1.2", 2, "")],
      caido, { mujeres: 5, hombres: 5 });
    expect(String(res.cadena.mejores[0].fila.operational_code)).toBe("R 1.1");
    expect(res.cadena.mejores[0].sinVia).toBe(true);
  });

  it("fuera de su cadena sí va detrás: ahí no hay procedimiento que respetar", () => {
    // Las reservas de OTRA cadena y el banco se ordenan por puntuación, no por
    // orden de relevo: entre dos que puntúan igual, primero la que se puede
    // llamar.
    const caido = fila({ operational_code: "CH 9", titular_operational_code: "CH 9",
                         sample_role: "titular", sample_status: "rechazo" });
    const suelta = (codigo: string, call: string) =>
      fila({ operational_code: codigo, titular_operational_code: "CH 1",
             sample_role: "chain_reserve", replacement_order: 1, call_status: call } as never);
    const filas = [
      caido,
      // Su titular ya salió: sus reservas quedan al aire y son candidatas.
      fila({ operational_code: "CH 1", titular_operational_code: "CH 1",
             sample_role: "titular", operational_status: "aplicada" }),
      suelta("R 1.1", "NUMERO FUERA DE SERVICIO"),
      suelta("R 1.2", ""),
    ];
    const res = candidatosDeReemplazo(filas, caido, { mujeres: 5, hombres: 5 });
    const orden = res.otra_cadena.mejores.map((c) => String(c.fila.operational_code));
    expect(orden[0]).toBe("R 1.2");
    expect(orden).toContain("R 1.1");
  });
});
