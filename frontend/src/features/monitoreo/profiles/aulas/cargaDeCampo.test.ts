import { describe, expect, it } from "vitest";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import {
  calcularCarga,
  comoHora,
  diaDeFecha,
  ejeSugerido,
  leerFecha,
  leerHora,
  leerSesiones,
  porPabellon,
  hayHorarioDeCurso,
  sesionesDelPlan,
} from "./cargaDeCampo";
import { libroDeCargaDeCampo } from "./cargaDeCampoExcel";

const aula = (over: Partial<MonitoreoAulasPlanRow>): MonitoreoAulasPlanRow =>
  ({
    selection_run_id: "r", wave: "M1", orden: 1, classroom_id: "x", label: "x", course_id: "c",
    course_name: "Curso", section: "", schedule: "", teacher: "", teacher_email: "", faculty: "F",
    program: "", level: "", stratum: "", eligible_n: 20, expected_valid: 10, link: "", qr: "",
    collector_id: "", responsible: "", sample_role: "titular",
    ...over,
  }) as MonitoreoAulasPlanRow;

describe("leerSesiones", () => {
  it("lee un bloque simple", () => {
    expect(leerSesiones("MAR 14:00-16:00")).toEqual([{ dia: 1, desde: 840, hasta: 960 }]);
  });

  it("separa los bloques por el punto medio del catálogo", () => {
    expect(leerSesiones("MAR 14:00-16:00 · MIE 10:00-12:00")).toHaveLength(2);
  });

  it("acepta también el separador HTML con el que viene el reporte crudo", () => {
    expect(leerSesiones("LUN 08:00-10:00<br />JUE 09:00-11:00")).toHaveLength(2);
  });

  it("descarta lo que no parsea en vez de inventar un bloque", () => {
    expect(leerSesiones("MAR 14:00")).toEqual([]);
    expect(leerSesiones("XXX 14:00-16:00")).toEqual([]);
    expect(leerSesiones("")).toEqual([]);
    expect(leerSesiones(undefined)).toEqual([]);
  });

  it("descarta un rango invertido: seria una ocupacion negativa", () => {
    expect(leerSesiones("MAR 16:00-14:00")).toEqual([]);
  });
});

describe("calcularCarga", () => {
  const plan = [
    aula({ classroom_id: "a", sesiones_dia_hora: "LUN 10:00-13:00", venue: "A501" }),
    aula({ classroom_id: "b", sesiones_dia_hora: "LUN 11:00-12:00", venue: "A502" }),
    aula({ classroom_id: "c", sesiones_dia_hora: "LUN 15:00-17:00", venue: "L101" }),
  ];

  it("cuenta el RANGO y no la hora de inicio: es la razon de ser de la vista", () => {
    // A las 11:00 hay DOS aulas en curso aunque solo una empiece a esa hora.
    const m = calcularCarga(plan, { duracionMin: 180 });
    const j = m.franjas.indexOf(11 * 60);
    expect(m.aulas[0][j]).toBe(2);
  });

  it("la duracion NO recorta lo plausible: sin agendar cuenta la clase entera", () => {
    // El momento lo fija cada docente al confirmar. Suponer que todas entran al
    // inicio —o todas al final— inventa una coincidencia que no existe, asi que
    // mientras no haya hora la banda es la clase completa, dure lo que dure la
    // aplicacion.
    const uno = [aula({ classroom_id: "a", sesiones_dia_hora: "LUN 10:00-13:00" })];
    const corta = calcularCarga(uno, { duracionMin: 10 });
    const larga = calcularCarga(uno, { duracionMin: 170 });
    for (const h of [10, 11, 12]) {
      const j = corta.franjas.indexOf(h * 60);
      expect(corta.plausibles[0][j]).toBe(1);
      expect(larga.plausibles[0][j]).toBe(1);
    }
  });

  it("sin agendar, un aula ocupa TODO su rango: es un techo, no un instante", () => {
    // Una clase de 10 a 13 sin agendar puede aplicarse en cualquier momento, asi
    // que las tres horas quedan marcadas como posibles. Contarla solo a las 10
    // —lo que hacia la primera version— convertia una posibilidad en un dato.
    const uno = [aula({ classroom_id: "a", sesiones_dia_hora: "LUN 10:00-13:00" })];
    const m = calcularCarga(uno, { duracionMin: 30 });
    for (const h of [10, 11, 12]) {
      expect(m.plausibles[0][m.franjas.indexOf(h * 60)]).toBe(1);
    }
    expect(m.firmes[0][m.franjas.indexOf(10 * 60)]).toBe(0);
  });

  it("agendada, ocupa SOLO su hora y pasa a firme", () => {
    const uno = [
      aula({ classroom_id: "a", sesiones_dia_hora: "LUN 10:00-13:00", scheduled_time: "12:00" }),
    ];
    const m = calcularCarga(uno, { duracionMin: 30 });
    expect(m.firmes[0][m.franjas.indexOf(12 * 60)]).toBe(1);
    expect(m.firmes[0][m.franjas.indexOf(10 * 60)]).toBe(0);
    expect(m.plausibles[0].every((n) => n === 0)).toBe(true);
    expect(m.agendadas).toBe(1);
    expect(m.porAgendar).toBe(0);
  });

  it("el momento acordado con el docente manda sobre la hora suelta", () => {
    const uno = [
      aula({
        classroom_id: "a", sesiones_dia_hora: "LUN 10:00-13:00",
        scheduled_time: "10:00", scheduled_moment: "final",
      }),
    ];
    const m = calcularCarga(uno, { duracionMin: 30 });
    expect(m.firmes[0][m.franjas.indexOf(12 * 60 + 30)]).toBe(1);
    expect(m.firmes[0][m.franjas.indexOf(10 * 60)]).toBe(0);
  });

  it("intermedio centra la ventana en el medio de la clase", () => {
    // Clase de 10 a 12: el medio son las 11, y una ventana de 30 min centrada
    // va de 10:45 a 11:15. Cae en la franja de las 11, no en la de las 10:30.
    const uno = [
      aula({
        classroom_id: "a", sesiones_dia_hora: "LUN 10:00-12:00",
        scheduled_time: "10:00", scheduled_moment: "intermedio",
      }),
    ];
    const m = calcularCarga(uno, { duracionMin: 30 });
    expect(m.firmes[0][m.franjas.indexOf(11 * 60)]).toBe(1);
    expect(m.firmes[0][m.franjas.indexOf(10 * 60)]).toBe(0);
  });

  it("separa lo firme de lo plausible en el pico", () => {
    const mixto = [
      aula({ classroom_id: "a", sesiones_dia_hora: "LUN 10:00-11:00", scheduled_time: "10:00" }),
      aula({ classroom_id: "b", sesiones_dia_hora: "LUN 10:00-11:00" }),
    ];
    const m = calcularCarga(mixto, { duracionMin: 30 });
    expect(m.pico!.firmes).toBe(1);
    expect(m.pico!.plausibles).toBe(1);
    expect(m.agendadas).toBe(1);
    expect(m.porAgendar).toBe(1);
  });

  it("cada aula cuenta una sola vez, en su primera sesion", () => {
    const dos = [aula({ classroom_id: "a", sesiones_dia_hora: "LUN 10:00-12:00 · MAR 10:00-12:00" })];
    const m = calcularCarga(dos, { duracionMin: 60 });
    const j = m.franjas.indexOf(10 * 60);
    expect(m.plausibles[0][j]).toBe(1);
    expect(m.plausibles[1][j]).toBe(0);
  });

  it("ignora reemplazos y reserva: no se agendan", () => {
    const con = [
      ...plan,
      aula({ classroom_id: "r", sesiones_dia_hora: "LUN 10:00-13:00", sample_role: "chain_reserve" }),
      aula({ classroom_id: "e", sesiones_dia_hora: "LUN 10:00-13:00", sample_role: "extra_reserve_pool" }),
    ];
    const m = calcularCarga(con, { duracionMin: 180 });
    expect(m.aulas[0][m.franjas.indexOf(10 * 60)]).toBe(1);
  });

  it("cuenta las aulas sin horario en vez de silenciarlas", () => {
    const m = calcularCarga([...plan, aula({ classroom_id: "z", sesiones_dia_hora: "" })], {
      duracionMin: 30,
    });
    expect(m.sinHorario).toBe(1);
  });

  it("sin datos no inventa un pico", () => {
    expect(calcularCarga([], { duracionMin: 30 }).pico).toBeNull();
  });
});

describe("leerHora", () => {
  it("lee la hora agendada y descarta lo que no lo es", () => {
    expect(leerHora("08:30")).toBe(510);
    // «8:05 am» daba 485 de chiripa —el mismo regex leía «8:00pm» como las
    // 08:00, doce horas de error medidas el 2026-09-02—. El AM/PM lo parsea
    // el motor y la vista consume sus ventanas; el texto con sufijo se anula
    // en vez de truncarse. Contrato en horaDelMotor.contract.test.ts.
    expect(leerHora("8:05 am")).toBeNull();
    expect(leerHora("")).toBeNull();
    expect(leerHora("mañana")).toBeNull();
    expect(leerHora("99:00")).toBeNull();
  });
});

describe("porPabellon", () => {
  it("agrupa por la letra del salon y separa los espacios con nombre", () => {
    const r = porPabellon([
      aula({ classroom_id: "a", sesiones_dia_hora: "LUN 10:00-12:00", venue: "A501" }),
      aula({ classroom_id: "b", sesiones_dia_hora: "LUN 10:00-12:00", venue: "A502" }),
      aula({ classroom_id: "c", sesiones_dia_hora: "LUN 10:00-12:00", venue: "LFIA" }),
      aula({ classroom_id: "d", sesiones_dia_hora: "LUN 10:00-12:00", venue: "" }),
    ]);
    expect(r[0]).toEqual({ pabellon: "A", aulas: 2 });
    expect(r.find((x) => x.pabellon === "Espacios con nombre")?.aulas).toBe(1);
    expect(r.find((x) => x.pabellon === "Sin salón")?.aulas).toBe(1);
  });
});

describe("sesionesDelPlan", () => {
  it("devuelve una fila por sesion, no por aula", () => {
    expect(
      sesionesDelPlan([aula({ classroom_id: "a", sesiones_dia_hora: "LUN 10:00-12:00 · MAR 10:00-12:00" })]),
    ).toHaveLength(2);
  });
});

describe("libro de Excel", () => {
  const plan = [aula({ classroom_id: "a", sesiones_dia_hora: "LUN 10:00-13:00", venue: "A501" })];

  it("lleva la malla con color y el detalle por sesion", () => {
    const html = libroDeCargaDeCampo(plan, { duracionMin: 30 });
    expect(html).toContain("Carga de campo");
    expect(html).toContain("Detalle por sesión");
    expect(html).toContain("A501");
    expect(html).toMatch(/background:#[0-9a-f]{6}/i);
  });

  it("escapa el contenido en vez de romper la tabla", () => {
    const html = libroDeCargaDeCampo(
      [aula({ classroom_id: "a", sesiones_dia_hora: "LUN 10:00-12:00", course_name: "A <b>&</b> B" })],
      { duracionMin: 30 },
    );
    expect(html).toContain("A &lt;b&gt;&amp;&lt;/b&gt; B");
  });
});

describe("comoHora", () => {
  it("formatea con dos digitos", () => {
    expect(comoHora(7 * 60)).toBe("07:00");
    expect(comoHora(13 * 60 + 30)).toBe("13:30");
  });
});

describe("leerFecha y diaDeFecha", () => {
  it("acepta solo la fecha ISO y descarta lo demas", () => {
    expect(leerFecha("2026-09-14")).toBe("2026-09-14");
    expect(leerFecha(" 2026-09-14 ")).toBe("2026-09-14");
    expect(leerFecha("14/09/2026")).toBe("");
    expect(leerFecha(null)).toBe("");
  });

  it("una fecha imposible no se corre al dia siguiente: no hay dia", () => {
    // Sin la comprobacion, `2026-09-31` se convertia en el 1 de octubre —jueves—
    // y `bloqueDeFecha` elegia el bloque del jueves para un curso que no se
    // dicta ese dia, pintando la ventana firme en la franja equivocada.
    expect(diaDeFecha("2026-09-31")).toBe(-1);
    expect(diaDeFecha("2026-02-30")).toBe(-1);
  });

  it("la fila de una fecha imposible cae al bloque preliminar, no a uno ajeno", () => {
    const cal = calcularCarga(
      [aula({
        classroom_id: "a", sesiones_dia_hora: "MAR 08:00-10:00 · JUE 15:00-17:00",
        scheduled_time: "08:00", scheduled_moment: "final", scheduled_date: "2026-09-31",
      })],
      { duracionMin: 30, eje: "calendario" },
    );
    // Cae en el bloque del MARTES —la primera sesion— y no en el del jueves,
    // que es al que la fecha corrida habria apuntado.
    expect(cal.firmes[0][cal.franjas.indexOf(9 * 60 + 30)]).toBe(1);
    expect(cal.firmes[0][cal.franjas.indexOf(16 * 60 + 30)]).toBe(0);
  });

  it("traduce la fecha al dia de la semana de la malla", () => {
    expect(diaDeFecha("2026-09-14")).toBe(0); // lunes
    expect(diaDeFecha("2026-09-15")).toBe(1); // martes
    expect(diaDeFecha("2026-09-17")).toBe(3); // jueves
    expect(diaDeFecha("2026-09-20")).toBe(-1); // domingo: la malla semanal no lo tiene
    expect(diaDeFecha("")).toBe(-1);
  });
});

describe("eje calendario", () => {
  // Las dos estan agendadas un LUNES a la misma hora, pero en semanas distintas:
  // el 14 y el 21. Sobre el patron semanal caen en la misma celda.
  const dosSemanas = [
    aula({
      classroom_id: "a", sesiones_dia_hora: "LUN 10:00-12:00",
      scheduled_time: "10:00", scheduled_date: "2026-09-14",
    }),
    aula({
      classroom_id: "b", sesiones_dia_hora: "LUN 10:00-12:00",
      scheduled_time: "10:00", scheduled_date: "2026-09-21",
    }),
  ];

  it("es la razon de ser del eje: dos semanas distintas dejan de sumar un pico que no ocurre", () => {
    const semana = calcularCarga(dosSemanas, { duracionMin: 30 });
    const js = semana.franjas.indexOf(10 * 60);
    // El patron las apila: es correcto como PATRON y enganoso como operativo.
    expect(semana.firmes[0][js]).toBe(2);

    const cal = calcularCarga(dosSemanas, { duracionMin: 30, eje: "calendario" });
    expect(cal.filas.map((f) => f.fecha)).toEqual(["2026-09-14", "2026-09-21"]);
    const j = cal.franjas.indexOf(10 * 60);
    expect(cal.firmes[0][j]).toBe(1);
    expect(cal.firmes[1][j]).toBe(1);
    expect(cal.pico!.firmes).toBe(1);
    expect(cal.fechas).toBe(2);
  });

  it("las filas se rotulan con la fecha, no con el dia suelto", () => {
    const cal = calcularCarga(dosSemanas, { duracionMin: 30, eje: "calendario" });
    expect(cal.filas[0].etiqueta).toBe("Lunes 14/09");
    expect(cal.eje).toBe("calendario");
  });

  it("lo que falta agendar va a su carril y NO se reparte por cada fecha", () => {
    // Repartir una sin agendar por las dos fechas que coinciden en dia de semana
    // multiplicaria una visita por el numero de semanas: el mismo error que este
    // eje corrige, al reves.
    const cal = calcularCarga(
      [...dosSemanas, aula({ classroom_id: "c", sesiones_dia_hora: "LUN 10:00-12:00" })],
      { duracionMin: 30, eje: "calendario" },
    );
    expect(cal.filas).toHaveLength(3);
    expect(cal.filas[2].porAgendar).toBe(true);
    const j = cal.franjas.indexOf(11 * 60);
    expect(cal.plausibles[0][j]).toBe(0);
    expect(cal.plausibles[1][j]).toBe(0);
    expect(cal.plausibles[2][j]).toBe(1);
  });

  it("en el carril sigue ocupando la clase entera: no gana un momento por cambiar de eje", () => {
    const cal = calcularCarga(
      [aula({ classroom_id: "c", sesiones_dia_hora: "LUN 10:00-13:00" })],
      { duracionMin: 30, eje: "calendario" },
    );
    for (const h of [10, 11, 12]) {
      expect(cal.plausibles[0][cal.franjas.indexOf(h * 60)]).toBe(1);
    }
  });

  it("una agendada SIN fecha no se cuela como plausible: se cuenta y se declara", () => {
    // Tiene hora acordada, asi que llamarla «por agendar» seria mentir; y no
    // tiene fecha, asi que no cabe en el calendario. Queda fuera de la malla
    // con su propio contador para que la vista pueda decirlo.
    const cal = calcularCarga(
      [aula({ classroom_id: "a", sesiones_dia_hora: "LUN 10:00-12:00", scheduled_time: "10:00" })],
      { duracionMin: 30, eje: "calendario" },
    );
    expect(cal.agendadas).toBe(1);
    expect(cal.agendadasSinFecha).toBe(1);
    expect(cal.fechas).toBe(0);
    expect(cal.filas).toHaveLength(0);
    expect(cal.pico).toBeNull();
  });

  it("manda el bloque del dia agendado, no la primera sesion del curso", () => {
    // Curso de martes Y jueves, agendado un jueves con el momento «final»: la
    // ventana es el final de la clase del JUEVES (16:30), no la del martes.
    const dosDias = [
      aula({
        classroom_id: "a", sesiones_dia_hora: "MAR 08:00-10:00 · JUE 15:00-17:00",
        scheduled_time: "15:00", scheduled_moment: "final", scheduled_date: "2026-09-17",
      }),
    ];
    const cal = calcularCarga(dosDias, { duracionMin: 30, eje: "calendario" });
    expect(cal.firmes[0][cal.franjas.indexOf(16 * 60 + 30)]).toBe(1);
    expect(cal.firmes[0][cal.franjas.indexOf(9 * 60 + 30)]).toBe(0);

    // El patron semanal no cambia: sigue contando la primera sesion, que es la
    // que se ofrece al agendar.
    const semana = calcularCarga(dosDias, { duracionMin: 30 });
    expect(semana.firmes[1][semana.franjas.indexOf(9 * 60 + 30)]).toBe(1);
  });

  it("una fecha en domingo tiene fila propia aunque la malla semanal no tenga domingo", () => {
    const cal = calcularCarga(
      [aula({
        classroom_id: "a", sesiones_dia_hora: "LUN 10:00-12:00",
        scheduled_time: "11:00", scheduled_date: "2026-09-20",
      })],
      { duracionMin: 30, eje: "calendario" },
    );
    expect(cal.filas).toHaveLength(1);
    expect(cal.filas[0].dia).toBe(-1);
    expect(cal.firmes[0][cal.franjas.indexOf(11 * 60)]).toBe(1);
  });

  it("el pico del calendario son las FECHAS: el carril no compite con un dia concreto", () => {
    // Tres lunes sin agendar de tres semanas distintas caen todos en la fila
    // «lunes» del carril, que asi acumula 3 mientras cada fecha confirmada
    // tiene 1. Si el carril entrara al pico, ganaria siempre y el titular
    // diria «0 confirmados» con el operativo confirmado.
    const plan = [
      aula({ classroom_id: "a", sesiones_dia_hora: "LUN 10:00-12:00", scheduled_time: "10:00", scheduled_date: "2026-09-14" }),
      aula({ classroom_id: "b", sesiones_dia_hora: "LUN 10:00-12:00", scheduled_time: "10:00", scheduled_date: "2026-09-21" }),
      aula({ classroom_id: "c", sesiones_dia_hora: "LUN 10:00-12:00" }),
      aula({ classroom_id: "d", sesiones_dia_hora: "LUN 10:00-12:00" }),
      aula({ classroom_id: "e", sesiones_dia_hora: "LUN 10:00-12:00" }),
    ];
    const cal = calcularCarga(plan, { duracionMin: 30, eje: "calendario" });
    expect(cal.pico!.fila.porAgendar).toBeFalsy();
    expect(cal.pico!.firmes).toBe(1);
    expect(cal.pico!.fila.fecha).toBe("2026-09-14");
    // El carril no se pierde: se mide aparte, con su propio denominador.
    expect(cal.picoPorAgendar!.plausibles).toBe(3);
    expect(cal.picoPorAgendar!.fila.porAgendar).toBe(true);
  });

  it("sin ninguna fecha, el pico no se inventa desde el carril", () => {
    const cal = calcularCarga(
      [aula({ classroom_id: "c", sesiones_dia_hora: "LUN 10:00-12:00" })],
      { duracionMin: 30, eje: "calendario" },
    );
    expect(cal.pico).toBeNull();
    expect(cal.picoPorAgendar!.plausibles).toBe(1);
  });

  it("en el eje semanal el pico no cambia y no hay pico de carril", () => {
    const semana = calcularCarga(
      [aula({ classroom_id: "a", sesiones_dia_hora: "LUN 10:00-12:00", scheduled_time: "10:00", scheduled_date: "2026-09-14" })],
      { duracionMin: 30 },
    );
    expect(semana.pico!.firmes).toBe(1);
    expect(semana.picoPorAgendar).toBeNull();
  });

  it("el eje semanal conserva sus seis filas", () => {
    const semana = calcularCarga(dosSemanas, { duracionMin: 30 });
    expect(semana.eje).toBe("semana");
    expect(semana.filas.map((f) => f.etiqueta)).toEqual([
      "lunes", "martes", "miércoles", "jueves", "viernes", "sábado",
    ]);
  });
});

describe("ejeSugerido", () => {
  it("abre en patron semanal mientras casi nada esta agendado", () => {
    expect(ejeSugerido([])).toBe("semana");
    expect(ejeSugerido([aula({ classroom_id: "a", sesiones_dia_hora: "LUN 10:00-12:00" })])).toBe("semana");
    expect(
      ejeSugerido([
        aula({ classroom_id: "a", sesiones_dia_hora: "LUN 10:00-12:00", scheduled_time: "10:00", scheduled_date: "2026-09-14" }),
        aula({ classroom_id: "b", sesiones_dia_hora: "LUN 10:00-12:00" }),
        aula({ classroom_id: "c", sesiones_dia_hora: "LUN 10:00-12:00" }),
      ]),
    ).toBe("semana");
  });

  it("se inclina al calendario cuando ya hay tantas confirmadas como pendientes", () => {
    expect(
      ejeSugerido([
        aula({ classroom_id: "a", sesiones_dia_hora: "LUN 10:00-12:00", scheduled_time: "10:00", scheduled_date: "2026-09-14" }),
        aula({ classroom_id: "b", sesiones_dia_hora: "LUN 10:00-12:00" }),
      ]),
    ).toBe("calendario");
  });

  it("una hora sin fecha no inclina la vista: el calendario no podria colocarla", () => {
    expect(
      ejeSugerido([
        aula({ classroom_id: "a", sesiones_dia_hora: "LUN 10:00-12:00", scheduled_time: "10:00" }),
        aula({ classroom_id: "b", sesiones_dia_hora: "LUN 10:00-12:00", scheduled_time: "10:00" }),
      ]),
    ).toBe("semana");
  });
});

describe("libro de Excel por fecha", () => {
  it("sale con el eje que se le pide y lo dice en la cabecera", () => {
    const html = libroDeCargaDeCampo(
      [aula({
        classroom_id: "a", sesiones_dia_hora: "LUN 10:00-12:00",
        scheduled_time: "10:00", scheduled_date: "2026-09-14",
      })],
      { duracionMin: 30, eje: "calendario" },
    );
    expect(html).toContain("Calendario:");
    expect(html).toContain("Lunes 14/09");
    expect(html).toContain(">Fecha<");
  });

  it("rotula el carril de las que faltan agendar", () => {
    const html = libroDeCargaDeCampo(
      [
        aula({
          classroom_id: "a", sesiones_dia_hora: "LUN 10:00-12:00",
          scheduled_time: "10:00", scheduled_date: "2026-09-14",
        }),
        aula({ classroom_id: "b", sesiones_dia_hora: "MAR 10:00-12:00" }),
      ],
      { duracionMin: 30, eje: "calendario" },
    );
    expect(html).toContain("Por agendar");
  });
});

describe("hayHorarioDeCurso y el conteo del panel no se separan", () => {
  /**
   * El panel decide su rama vacía con `hayHorarioDeCurso()` y quien lo envuelve
   * decide con la misma llamada si le da el alto de la pantalla —sin malla, un
   * aviso de 60 px recibía un marco de ~1.000 con 940 de vacío—. El pie del
   * panel, en cambio, sigue necesitando el conteo: `titulares − sinHorario`.
   *
   * Son dos expresiones del mismo número. Este test las ata.
   */
  const titular = (p: Record<string, unknown>) => ({ sample_role: "titular", ...p }) as never;

  const casos: Array<[string, unknown[]]> = [
    ["sin ninguna fila", []],
    ["todas sin horario", [titular({ operational_code: "CH 1" }), titular({ operational_code: "CH 2" })]],
    ["mezcla", [
      titular({ operational_code: "CH 1", scheduled_date: "2026-09-01", scheduled_time: "08:00" }),
      titular({ operational_code: "CH 2" }),
    ]],
    ["todas con horario", [
      titular({ operational_code: "CH 1", scheduled_date: "2026-09-01", scheduled_time: "08:00" }),
    ]],
  ];

  for (const [nombre, plan] of casos) {
    it(`coinciden ${nombre}`, () => {
      const filas = plan as never[];
      const malla = calcularCarga(filas, { duracionMin: 60, eje: "calendario" });
      const titulares = filas.filter((f) => !(f as { sample_role?: string }).sample_role
        || (f as { sample_role?: string }).sample_role === "titular").length;
      expect(hayHorarioDeCurso(filas)).toBe(titulares - malla.sinHorario > 0);
    });
  }
});
