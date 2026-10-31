import { describe, expect, it } from "vitest";

import type { MonitoreoAulasDashboard, MonitoreoAulasDosTasasAula } from "../../../../../api/monitoreo";
import {
  construirCursosHorario,
  MARCA_CURSOS_HORARIO_AULAS,
  ordenarPorDesvio,
  readinessDeCursosHorario,
} from "./cursosHorarioModelo";
import { senalesPorAula } from "../senalesPorAula";

function aula(
  codigo: string, facultad: string, elegibles: number, efectivas: number | null, prevista: number | null,
  senal: string, extra: Partial<MonitoreoAulasDosTasasAula> = {},
): MonitoreoAulasDosTasasAula {
  const observada = efectivas == null || elegibles <= 0 ? null : efectivas / elegibles;
  return {
    codigo, facultad, elegibles, efectivas, tasa_prevista: prevista, tasa_observada: observada,
    numerador: "plataforma", banda: elegibles >= 16 ? 0.15 : null, senal, ...extra,
  };
}

function cobertura(pleno: number, satisfactorio: number, parcial: number, insuficiente: number, critico: number, nulo = 0) {
  return [
    { clave: "nulo", aulas: nulo, etiqueta: "Sin respuestas" },
    { clave: "critico", aulas: critico, etiqueta: "Muy por debajo (menos de la mitad)" },
    { clave: "insuficiente", aulas: insuficiente, etiqueta: "Se quedó a medias (50-75 %)" },
    { clave: "parcial", aulas: parcial, etiqueta: "Llegó a la mayor parte (75-90 %)" },
    { clave: "satisfactorio", aulas: satisfactorio, etiqueta: "Casi llegó (90-100 % de lo esperado)" },
    { clave: "pleno", aulas: pleno, etiqueta: "Llegó a lo esperado" },
  ];
}

/**
 * HSVG 2026, segundo sorteo, recortado: las filas de la maqueta A3 con sus
 * cifras reales (CH 172, EXTRA 31, R 3.1, CH 121 que no cuadra…), más un
 * pendiente y un retirado que no entran a la tabla.
 */
function hsvg(): MonitoreoAulasDashboard {
  return {
    dos_tasas: {
      aulas: [
        aula("CH 82", "DERECHO", 45, 32, 0.558, "sobre"),
        aula("CH 172", "LETRAS Y CIENCIAS HUMANAS", 10, 1, 0.8, "sin_banda"),
        aula("EXTRA 31", "DERECHO", 44, 3, 0.558, "bajo"),
        aula("CH 121", "ARTE Y DISEÑO", 21, 25, 0.595, "descuadre"),
        aula("R 3.1", "CIENCIAS E INGENIERIA", 23, 5, 0.64, "bajo", { numerador: "parte" }),
        aula("CH 64", "ESTUDIOS GENERALES LETRAS", 43, 16, 0.509, "conforme"),
        { codigo: "CH 140", facultad: "GESTION Y ALTA DIRECCION", elegibles: 44, tasa_prevista: 0.55, senal: "pendiente", estado_operativo: "agendada" },
        { codigo: "CH 114", facultad: "DERECHO", elegibles: 40, tasa_prevista: 0.558, senal: "retirada", estado_operativo: "reemplazada" },
      ],
      criterio: { numerador: "", denominador: "", banda: "", vara_agregada: "", senal: "" },
    },
    course_status_rol_y_estado: {
      titulares: {
        total: 174, aplicado: 152, agendado: 14, sin_agendar: 2, rechazado: 4, reemplazado: 2,
        aplicado_sin_agenda: 3, agendado_vencido: 7,
      },
      reemplazos: { total: 1173, utilizado: 29, en_cadena: 40, al_aire: 1104, utilizado_sin_agenda: 0 },
      banco: { total: 45, utilizado: 7, disponible: 38 },
    },
    course_status_cobertura: cobertura(80, 12, 23, 27, 18),
    course_status_rol_y_estado_por_facultad: {
      DERECHO: {
        titulares: { total: 20, aplicado: 18, agendado: 1, sin_agendar: 1, rechazado: 0, reemplazado: 0, agendado_vencido: 1 },
        reemplazos: { total: 120, utilizado: 3 },
        banco: { total: 0, utilizado: 0 },
      },
    },
    course_status_cobertura_por_facultad: {
      DERECHO: { cobertura: cobertura(10, 2, 3, 1, 1), con_meta: 18, sin_aplicar: 2 },
    },
  } as unknown as MonitoreoAulasDashboard;
}

describe("construirCursosHorario — la tabla", () => {
  it("sólo entran los aplicados, primero lo señalado bajo lo previsto, por encuestas perdidas, con la lectura del motor", () => {
    const m = construirCursosHorario(hsvg());
    expect(m.estado).toBe("listo");
    if (m.tabla.tipo !== "filas") throw new Error("esperaba filas");
    expect(m.tabla.sub).toBe("6 aplicados, primero lo señalado bajo lo previsto, por encuestas perdidas");
    expect(m.tabla.filas.map((f) => f.codigo)).toEqual(["EXTRA 31", "R 3.1", "CH 121", "CH 82", "CH 64", "CH 172"]);
    // Pocos elegibles para juzgar va al final aunque su tasa sea la más baja.
    const primera = m.tabla.filas.find((f) => f.codigo === "CH 172");
    expect(primera).toMatchObject({
      facultad: "Letras y Ciencias Humanas", elegibles: "10", efectivas: "1",
      prevista: "80.0 %", observada: "10.0 %", lectura: "Pocos elegibles para juzgar", tono: "neutro",
      relleno: 10, marca: 80,
    });
    expect(m.tabla.filas.find((f) => f.codigo === "EXTRA 31")).toMatchObject({ lectura: "Por debajo de lo previsto", tono: "aviso" });
    expect(m.tabla.filas.find((f) => f.codigo === "CH 64")).toMatchObject({ lectura: "Dentro de lo previsto", tono: "ok" });
    expect(m.tabla.filas.find((f) => f.codigo === "CH 82")).toMatchObject({ lectura: "Por encima de lo previsto" });
  });

  it("el descuadre no se disfraza de logro: «No cuadra», con la barra recortada", () => {
    const m = construirCursosHorario(hsvg());
    if (m.tabla.tipo !== "filas") throw new Error("esperaba filas");
    const ch121 = m.tabla.filas.find((f) => f.codigo === "CH 121");
    expect(ch121).toMatchObject({ lectura: "No cuadra", tono: "riesgo", observada: "119.0 %", relleno: 100, desborda: true });
  });

  it("declara la fuente del parte y el margen del motor", () => {
    const m = construirCursosHorario(hsvg());
    if (m.tabla.tipo !== "filas") throw new Error("esperaba filas");
    expect(m.tabla.filas.find((f) => f.codigo === "R 3.1")?.delParte).toBe(true);
    expect(m.tabla.filas.find((f) => f.codigo === "EXTRA 31")?.delParte).toBe(false);
    expect(m.tabla.filas.find((f) => f.codigo === "EXTRA 31")?.porQue).toBe("Margen de ± 15 pts alrededor de la prevista, armado con sus elegibles.");
  });

  it("dice lo que no entra y por qué", () => {
    const m = construirCursosHorario(hsvg());
    if (m.tabla.tipo !== "filas") throw new Error("esperaba filas");
    expect(m.tabla.pie).toContain("No entran 1 sin aplicar todavía y 1 que ya no se aplicarán por esta vía");
  });

  it("una señal desconocida se enseña con su nombre, no cae a otra", () => {
    const d = hsvg();
    d.dos_tasas!.aulas.push(aula("CH 9", "DERECHO", 30, 10, 0.5, "rarisima"));
    const m = construirCursosHorario(d);
    if (m.tabla.tipo !== "filas") throw new Error("esperaba filas");
    expect(m.tabla.filas.find((f) => f.codigo === "CH 9")).toMatchObject({ lectura: "rarisima", tono: "neutro" });
  });

  it("con el foco en una facultad la tabla sólo habla de ella", () => {
    const m = construirCursosHorario(hsvg(), "DERECHO");
    expect(m.enFoco).toBe("Derecho");
    if (m.tabla.tipo !== "filas") throw new Error("esperaba filas");
    expect(m.tabla.filas.map((f) => f.codigo)).toEqual(["EXTRA 31", "CH 82"]);
    expect(m.tabla.sub).toBe("2 aplicados de Derecho, primero lo señalado bajo lo previsto, por encuestas perdidas");
    // El nombre se empareja sin tildes ni mayúsculas.
    const conTilde = construirCursosHorario(hsvg(), "Arte y Diseno");
    if (conTilde.tabla.tipo !== "filas") throw new Error("esperaba filas");
    expect(conTilde.tabla.filas.map((f) => f.codigo)).toEqual(["CH 121"]);
  });

  it("vacíos con su causa: sin bloque es desconexión; sin aplicados, legítimo", () => {
    const sinBloque = construirCursosHorario({} as MonitoreoAulasDashboard);
    expect(sinBloque.tabla).toMatchObject({ tipo: "vacio", vacio: { clase: "desconexion" } });

    const d = hsvg();
    d.dos_tasas!.aulas = d.dos_tasas!.aulas.filter((a) => a.senal === "pendiente");
    const sinAplicar = construirCursosHorario(d);
    expect(sinAplicar.tabla).toMatchObject({ tipo: "vacio", vacio: { clase: "legitimo" } });
    if (sinAplicar.tabla.tipo === "vacio") expect(sinAplicar.tabla.vacio.causa).toContain("1 espera su aplicación");

    const fuera = construirCursosHorario(hsvg(), "MEDICINA");
    expect(fuera.tabla).toMatchObject({ tipo: "vacio", vacio: { clase: "legitimo", causa: "El sorteo no dejó cursos-horario en Medicina." } });
  });

  it("muchas filas: el orden es total y estable", () => {
    const res = senalesPorAula({
      aulas: Array.from({ length: 185 }, (_, i) => aula(`CH ${i + 1}`, "DERECHO", 40, (i * 7) % 40, 0.5, "conforme")),
      criterio: { numerador: "", denominador: "", banda: "", vara_agregada: "", senal: "" },
    });
    if (res.estado !== "medido") throw new Error("esperaba medido");
    const ordenadas = ordenarPorDesvio(res.conformes);
    expect(ordenadas).toHaveLength(185);
    // Misma señal y mismos elegibles: más perdidas primero = menor observada primero.
    for (let i = 1; i < ordenadas.length; i += 1) {
      expect(ordenadas[i].tasaObservada! - ordenadas[i - 1].tasaObservada!).toBeGreaterThanOrEqual(0);
    }
  });

  it("ordena por encuestas perdidas, no por puntos: el aula grande a −20 va antes que la chica a −35", () => {
    const res = senalesPorAula({
      aulas: [
        aula("CH 1", "DERECHO", 5, 1, 0.55, "bajo"),
        aula("CH 2", "DERECHO", 80, 28, 0.55, "bajo"),
      ],
      criterio: { numerador: "", denominador: "", banda: "", vara_agregada: "", senal: "" },
    });
    if (res.estado !== "medido") throw new Error("esperaba medido");
    // CH 1 pierde 5 × 0.35 = 1.75 encuestas; CH 2, 80 × 0.20 = 16.
    expect(ordenarPorDesvio(res.senalados).map((a) => a.codigo)).toEqual(["CH 2", "CH 1"]);
  });
});

describe("construirCursosHorario — titulares y cobertura", () => {
  it("titulares: seis cifras que suman el total del sorteo, y lo usado de la reserva", () => {
    const m = construirCursosHorario(hsvg());
    if (m.titulares.tipo !== "reparto") throw new Error("esperaba reparto");
    expect(m.titulares.sub).toBe("174 del sorteo");
    expect(Object.fromEntries(m.titulares.cifras.map((c) => [c.clave, c.valor]))).toEqual({
      aplicado: "152", agendado: "7", vencido: "7", sin_agendar: "2", rechazado: "4", reemplazado: "2",
    });
    expect(m.titulares.cifras.reduce((s, c) => s + c.aulas, 0)).toBe(174);
    expect(m.titulares.sinClasificar).toBe(0);
    expect(m.titulares.reservas).toMatchObject({ rotulo: "Reservas usadas de 1,173", valor: "29" });
    expect(m.titulares.extras).toMatchObject({ rotulo: "Extras usados de 45", valor: "7" });
    expect(m.titulares.cifras[0].titulo).toContain("3 sin fecha en el libro");
  });

  it("titulares: sin la fecha agendada, «Vencidos» es una raya con su causa y no un cero", () => {
    const d = hsvg();
    delete d.course_status_rol_y_estado!.titulares!.agendado_vencido;
    const m = construirCursosHorario(d);
    if (m.titulares.tipo !== "reparto") throw new Error("esperaba reparto");
    const vencido = m.titulares.cifras.find((c) => c.clave === "vencido");
    expect(vencido).toMatchObject({ valor: "—" });
    expect(vencido?.titulo).toContain("no trae la fecha agendada");
    expect(m.titulares.cifras.find((c) => c.clave === "agendado")?.valor).toBe("14");
  });

  it("titulares: con foco usa el reparto de la facultad; sin banco lo dice", () => {
    const m = construirCursosHorario(hsvg(), "Derecho");
    if (m.titulares.tipo !== "reparto") throw new Error("esperaba reparto");
    expect(m.titulares.sub).toBe("20 del sorteo en Derecho");
    expect(m.titulares.extras).toMatchObject({ rotulo: "Extras usados", valor: "—" });
    expect(m.titulares.reservas.valor).toBe("3");
  });

  it("titulares: sin bloque es desconexión", () => {
    const m = construirCursosHorario({} as MonitoreoAulasDashboard);
    expect(m.titulares).toMatchObject({ tipo: "vacio", vacio: { clase: "desconexion" } });
  });

  it("cobertura: de lo que llegó a lo que no, con la etiqueta del motor y su base", () => {
    const m = construirCursosHorario(hsvg());
    if (m.cobertura.tipo !== "tramos") throw new Error("esperaba tramos");
    expect(m.cobertura.sub).toBe("160 cursos-horario aplicados con meta");
    expect(m.cobertura.tramos.map((t) => [t.clave, t.aulas, t.relleno])).toEqual([
      ["pleno", 80, 100], ["satisfactorio", 12, 15], ["parcial", 23, 28.8],
      ["insuficiente", 27, 33.8], ["critico", 18, 22.5], ["nulo", 0, 0],
    ]);
    expect(m.cobertura.tramos[0].etiqueta).toBe("Llegó a lo esperado");
  });

  it("cobertura: con foco, la de la facultad; sin aplicados, un vacío legítimo con lo que espera", () => {
    const m = construirCursosHorario(hsvg(), "DERECHO");
    if (m.cobertura.tipo !== "tramos") throw new Error("esperaba tramos");
    expect(m.cobertura.sub).toBe("17 cursos-horario aplicados con meta");

    const d = hsvg();
    d.course_status_cobertura = cobertura(0, 0, 0, 0, 0);
    d.course_status_sin_aplicar = 174;
    const vacia = construirCursosHorario(d);
    expect(vacia.cobertura).toMatchObject({ tipo: "vacio", vacio: { clase: "legitimo" } });
    if (vacia.cobertura.tipo === "vacio") expect(vacia.cobertura.vacio.causa).toContain("174 esperan su aplicación");

    const sinBloque = construirCursosHorario({} as MonitoreoAulasDashboard);
    expect(sinBloque.cobertura).toMatchObject({ tipo: "vacio", vacio: { clase: "desconexion" } });
  });

  it("cobertura: una etiqueta ausente cae a la misma redacción local", () => {
    const d = hsvg();
    d.course_status_cobertura = [{ clave: "pleno", aulas: 3 }];
    const m = construirCursosHorario(d);
    if (m.cobertura.tipo !== "tramos") throw new Error("esperaba tramos");
    expect(m.cobertura.tramos[0]).toMatchObject({ clave: "pleno", etiqueta: "Llegó a lo esperado", aulas: 3 });
  });
});

describe("readiness de Cursos-horario", () => {
  it("false mientras carga, la dirección cuando pinta y vacío sin tablero", () => {
    expect(MARCA_CURSOS_HORARIO_AULAS).toBe("monitoreo-aulas-avance-cursos");
    expect(readinessDeCursosHorario(null, true)).toBe("false");
    expect(readinessDeCursosHorario(construirCursosHorario(hsvg()), false)).toBe(MARCA_CURSOS_HORARIO_AULAS);
    expect(readinessDeCursosHorario(construirCursosHorario(null), false)).toBe("vacio:sin-tablero");
  });
});
