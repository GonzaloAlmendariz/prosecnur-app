import { describe, expect, it } from "vitest";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import type { ProyeccionDeFacultad } from "./proyeccionPorAgenda";
import { proyeccionPorAgenda } from "./proyeccionPorAgenda";
import { DIAS_DE_ANTICIPACION, TASA_DE_CAIDA, alertaDeAnticipacion } from "./alertaDeAnticipacion";

// Agosto de 2026: los domingos caen 2, 9, 16, 23 y 30.
// La vara del diseño no la mira esta alerta —cuenta días de agenda, no
// encuestas— así que se siembra neutra y el helper la absorbe: lo que este
// archivo prueba no debe romperse cada vez que la proyección publique un campo.
const dia = (fecha: string) => ({
  fecha, aulas: 1, elegibles: 40, esperadas: 20, acumuladas: 20,
  esperadasPorDiseno: null, acumuladasPorDiseno: null, aulasConDiseno: 0,
});

const facultad = (p: Partial<ProyeccionDeFacultad> & { facultad: string }): ProyeccionDeFacultad => ({
  esperadoPorAula: 20,
  aulasAgendadas: 0,
  dias: [],
  cuotas: [],
  reparto: "observada",
  alcanzaTodo: false,
  corte: "2026-08-10",
  esperadasPorDisenoTotal: null,
  aulasConDiseno: 0,
  ...p,
});

const cuota = (faltanAlCerrarAgenda: number) => ({
  sexo: "Mujer",
  meta: 100,
  observadas: 0,
  faltan: 100,
  esperadasDeLaAgenda: 0,
  alcanza: false,
  fechaDeCruce: null,
  faltanAlCerrarAgenda,
});

describe("cuántas aulas hay que pedir", () => {
  it("las que cubren la brecha, con margen por las que se caerán", () => {
    // 60 encuestas de brecha a 20 por aula son 3 aulas... si todas se aplicaran.
    // En 2025 una de cada cuatro no se aplicó, así que se piden 4.
    const [a] = alertaDeAnticipacion([
      facultad({ facultad: "Derecho", cuotas: [cuota(60)] }),
    ]);
    expect(a.aulasNecesarias).toBe(3);
    expect(a.aulasAPedir).toBe(Math.ceil(3 / (1 - TASA_DE_CAIDA)));
    // Con rendimiento observado las dos son cifra, no «no se sabe».
    expect(a.aulasNecesarias).not.toBeNull();
    expect(a.aulasAPedir).toBeGreaterThan(a.aulasNecesarias as number);
  });

  it("suma la brecha de los dos sexos", () => {
    const [a] = alertaDeAnticipacion([
      facultad({ facultad: "Derecho", cuotas: [cuota(40), { ...cuota(20), sexo: "Hombre" }] }),
    ]);
    expect(a.faltan).toBe(60);
  });

  it("sin brecha no pide nada", () => {
    const [a] = alertaDeAnticipacion([
      facultad({ facultad: "Derecho", cuotas: [cuota(0)], alcanzaTodo: true }),
    ]);
    expect(a.urgencia).toBe("sin brecha");
    expect(a.aulasAPedir).toBe(0);
  });

  it("sin rendimiento conocido no inventa un número de aulas", () => {
    // Dividir por cero daría Infinity y la pantalla pediría infinitas aulas.
    //
    // Este test afirmaba `0`, que frena el Infinity sustituyendo un número
    // inventado por otro **peor**: Infinity grita y se investiga, 0 se lee como
    // «no hace falta ninguna» justo de la facultad a la que más le falta. Con
    // el nombre del test prometiendo lo contrario, pasaba en verde mientras la
    // pantalla decía «hay que pedir 0 en total» sobre 15 facultades con brecha.
    const [a] = alertaDeAnticipacion([
      facultad({ facultad: "Nueva", esperadoPorAula: 0, cuotas: [cuota(50)] }),
    ]);
    expect(a.aulasNecesarias).toBeNull();
    expect(a.aulasAPedir).toBeNull();
    // Lo que SÍ se sabe se sigue diciendo: la brecha no depende del rendimiento.
    expect(a.faltan).toBe(50);
  });
});

describe("hasta qué día se puede esperar", () => {
  it("con agenda larga hay margen, y dice la fecha exacta", () => {
    // Del 10 al 24 hay 12 días de campo (se saltan los domingos 16 y 23), que
    // son más que los 7 de anticipación.
    const [a] = alertaDeAnticipacion([
      facultad({ facultad: "Derecho", cuotas: [cuota(60)], dias: [dia("2026-08-11"), dia("2026-08-24")] }),
    ]);
    expect(a.diasDeAgenda).toBe(12);
    expect(a.urgencia).toBe("hay margen");
    // Siete días de campo antes del 24 es el 15, no el 17: por el medio hay dos
    // domingos y contarlos daría dos días de más de tranquilidad.
    expect(a.pedirAntesDe).toBe("2026-08-15");
  });

  it("cuando queda menos agenda que la anticipación, es ahora", () => {
    const [a] = alertaDeAnticipacion([
      facultad({ facultad: "Derecho", cuotas: [cuota(60)], dias: [dia("2026-08-11"), dia("2026-08-15")] }),
    ]);
    expect(a.diasDeAgenda).toBe(5);
    expect(a.urgencia).toBe("pedir ahora");
    // No hay fecha que ofrecer: la fecha era ayer.
    expect(a.pedirAntesDe).toBeNull();
  });

  it("sin nada agendado por delante, la facultad ya está parada", () => {
    // Es un estado distinto de «pedir ahora» y antes se confundían: aquí hay
    // días de campo perdiéndose ya, no margen corto.
    const [a] = alertaDeAnticipacion([
      facultad({ facultad: "Derecho", cuotas: [cuota(60)], dias: [] }),
    ]);
    expect(a.urgencia).toBe("sin agenda");
    expect(a.diasDeAgenda).toBe(0);
  });

  it("el ancla es el corte del campo, no el reloj de la máquina", () => {
    // La MISMA agenda, con dos cortes distintos, da dos urgencias distintas. Si
    // se usara `Date.now()`, las dos filas darían lo mismo —«sin agenda»— en
    // cuanto el estudio quedara en el pasado.
    const conDias = { cuotas: [cuota(60)], dias: [dia("2026-08-11"), dia("2026-08-24")] };
    const [pronto] = alertaDeAnticipacion([facultad({ facultad: "A", corte: "2026-08-10", ...conDias })]);
    const [tarde] = alertaDeAnticipacion([facultad({ facultad: "A", corte: "2026-08-20", ...conDias })]);
    expect(pronto.urgencia).toBe("hay margen");
    expect(tarde.urgencia).toBe("pedir ahora");
  });

  it("sin ningún parte, el ancla es el primer día agendado", () => {
    // El campo no ha empezado. Anclar en el primer día agendado es el hecho más
    // temprano que hay; inventar un «hoy» sería peor.
    const [a] = alertaDeAnticipacion([
      facultad({ facultad: "Derecho", corte: "", cuotas: [cuota(60)], dias: [dia("2026-08-10"), dia("2026-08-24")] }),
    ]);
    expect(a.diasDeAgenda).toBe(12);
    expect(a.urgencia).toBe("hay margen");
  });
});

describe("si el banco de esa facultad tiene las aulas que se piden", () => {
  const conBrecha = () => facultad({
    facultad: "Derecho", cuotas: [cuota(60)], dias: [dia("2026-08-11"), dia("2026-08-24")],
  });
  // 60 de brecha a 20 por aula son 3, y con la tasa de caída se piden 4.
  const banco = (disponibles: number | undefined, faculty = "Derecho") =>
    [{ faculty, extras: 99, disponibles, elegibles: 0, mujeres: 0, hombres: 0 }];

  it("alcanza cuando quedan al menos las que se piden", () => {
    const [a] = alertaDeAnticipacion([conBrecha()], banco(4));
    expect(a.aulasAPedir).toBe(4);
    expect(a.reservaDisponible).toBe(4);
    expect(a.reservaAlcanza).toBe(true);
  });

  it("no alcanza cuando quedan menos, aunque el banco sea grande", () => {
    // `extras` es 99: lo que decide es cuántas quedan SIN USAR, no cuántas
    // llegó a haber. Un banco de 99 del que se gastaron 96 no da para 4.
    const [a] = alertaDeAnticipacion([conBrecha()], banco(3));
    expect(a.reservaAlcanza).toBe(false);
  });

  it("no saber cuántas quedan no es saber que no queda ninguna", () => {
    // Un payload sin `disponibles` deja la casilla en «no se sabe». Pintarla
    // como cero acusaría a la facultad de una escasez que nadie midió, y esta
    // lista manda a gente a trabajar: tiene que poder defenderse.
    const [sinCampo] = alertaDeAnticipacion([conBrecha()], banco(undefined));
    expect(sinCampo.reservaDisponible).toBeNull();
    expect(sinCampo.reservaAlcanza).toBeNull();

    const [sinBanco] = alertaDeAnticipacion([conBrecha()], []);
    expect(sinBanco.reservaDisponible).toBeNull();
    expect(sinBanco.reservaAlcanza).toBeNull();
  });

  it("el banco de otra facultad no cuenta como propio", () => {
    // El banco viene repartido por estrato justamente para que no se mezcle: si
    // se leyera el total, Derecho con 207 taparía a Arquitectura con 12.
    const [a] = alertaDeAnticipacion([conBrecha()], banco(50, "Arquitectura"));
    expect(a.reservaDisponible).toBeNull();
  });

  it("sin nada que pedir no se juzga el banco", () => {
    const [a] = alertaDeAnticipacion(
      [facultad({ facultad: "Derecho", cuotas: [cuota(0)], alcanzaTodo: true })],
      banco(0),
    );
    expect(a.aulasAPedir).toBe(0);
    expect(a.reservaAlcanza).toBeNull();
  });
});

describe("el orden es el de salir a llamar", () => {
  it("primero las paradas, después las urgentes, y dentro las que más piden", () => {
    const largo = [dia("2026-08-11"), dia("2026-08-24")];
    const corto = [dia("2026-08-11"), dia("2026-08-14")];
    const res = alertaDeAnticipacion([
      facultad({ facultad: "ConMargen", cuotas: [cuota(200)], dias: largo }),
      facultad({ facultad: "Tranquila", cuotas: [cuota(0)], alcanzaTodo: true }),
      facultad({ facultad: "Poca", cuotas: [cuota(20)], dias: corto }),
      facultad({ facultad: "Parada", cuotas: [cuota(20)], dias: [] }),
      facultad({ facultad: "Mucha", cuotas: [cuota(200)], dias: corto }),
    ]);
    expect(res.map((r) => r.facultad))
      .toEqual(["Parada", "Mucha", "Poca", "ConMargen", "Tranquila"]);
  });

  it("entre las que tienen margen manda la fecha, no el tamaño del pedido", () => {
    // La que vence antes va primero AUNQUE pida menos aulas: en ese grupo la
    // pregunta es a cuál se le acaba el plazo, no cuál es más grande.
    const res = alertaDeAnticipacion([
      facultad({ facultad: "Grande", cuotas: [cuota(400)], dias: [dia("2026-08-11"), dia("2026-08-28")] }),
      facultad({ facultad: "Urgente", cuotas: [cuota(40)], dias: [dia("2026-08-11"), dia("2026-08-21")] }),
    ]);
    expect(res.map((r) => r.facultad)).toEqual(["Urgente", "Grande"]);
    expect(res[1].aulasAPedir).not.toBeNull();
    expect(res[0].aulasAPedir).toBeLessThan(res[1].aulasAPedir as number);
  });
});

describe("los tres momentos se alcanzan desde el payload, no sólo a mano", () => {
  // ESTE es el aserto que faltaba. La versión anterior decidía la urgencia con
  // los días que quedaban para cerrar el estudio, un dato que el perfil de aulas
  // NO publica: nunca se le pasaba, así que en producción toda facultad con
  // brecha salía «pedir ahora» y «hay margen» no se pintó jamás. Los tests la
  // daban por cubierta porque le entregaban a mano el número que la pantalla no
  // tenía de dónde sacar. Aquí se recorre la cadena entera —filas del payload,
  // proyección, alerta— para que el estado sólo pueda estar verde si es
  // alcanzable de verdad.
  const parte = (f: Partial<MonitoreoRow>) => f as MonitoreoRow;
  const aula = (f: Partial<MonitoreoRow>) => f as MonitoreoRow;
  const fila = (f: Partial<MonitoreoRow>) => f as MonitoreoRow;

  const historia = Array.from({ length: 10 }, (_, i) => parte({
    operational_code: `CH ${i}`,
    faculty: "Derecho",
    applied_at: "2026-08-10",
    effective_surveys: 20,
  }));
  // Brecha que la agenda no puede cerrar: 400 de meta con 2 aulas por delante.
  const cuotas = [
    fila({ faculty: "Derecho", sex: "Mujer", target: 400, observed: 10 }),
    fila({ faculty: "Derecho", sex: "Hombre", target: 400, observed: 10 }),
  ];

  const desdeElPayload = (agenda: MonitoreoRow[]) =>
    alertaDeAnticipacion(proyeccionPorAgenda(agenda, historia, cuotas))[0];

  it("con agenda larga sale «hay margen» con su fecha", () => {
    const a = desdeElPayload([
      aula({ operational_code: "CH 90", faculty: "Derecho", scheduled_date: "2026-08-11" }),
      aula({ operational_code: "CH 91", faculty: "Derecho", scheduled_date: "2026-08-24" }),
    ]);
    expect(a.urgencia).toBe("hay margen");
    expect(a.pedirAntesDe).toBe("2026-08-15");
  });

  it("con agenda corta sale «pedir ahora»", () => {
    const a = desdeElPayload([
      aula({ operational_code: "CH 90", faculty: "Derecho", scheduled_date: "2026-08-13" }),
    ]);
    expect(a.urgencia).toBe("pedir ahora");
  });

  it("sin agenda por delante sale «sin agenda»", () => {
    const a = desdeElPayload([]);
    expect(a.urgencia).toBe("sin agenda");
  });
});

describe("las constantes vienen del operativo de 2025 y están declaradas", () => {
  it("7 días de anticipación y 12.4 % de caída", () => {
    // Si alguien las cambia, que sea a sabiendas: la mediana de llamada a
    // aplicación de los titulares, y las 21 caídas reales de 170 —titular sin
    // aplicar cubierto por reemplazo—. El 40/170 anterior no lo reproducía
    // ninguna definición del libro 2025: mezclaba caídas con refuerzos
    // (checklist-tres-fuentes-monitoreo-2026-08-27.md §A7).
    expect(DIAS_DE_ANTICIPACION).toBe(7);
    expect(TASA_DE_CAIDA).toBeCloseTo(21 / 170, 2);
  });
});

describe("lo que falta, y DE QUÉ", () => {
  // La lista decía «pide 12 aulas en Gestión» y esa facultad está corta de 52
  // mujeres y 24 hombres: dos tercios de lo que falta es de un lado. Doce aulas
  // cualesquiera no cierran la celda que falla, y el banco existe justamente
  // para elegir por composición.
  const conCuotas = (mujeres: number, hombres: number) => facultad({
    facultad: "Gestion",
    dias: [dia("2026-08-11"), dia("2026-08-24")],
    cuotas: [
      { ...cuota(mujeres), sexo: "Mujer" },
      { ...cuota(hombres), sexo: "Hombre" },
    ],
  });

  it("desglosa la brecha por sexo y la ordena por tamaño", () => {
    const [a] = alertaDeAnticipacion([conCuotas(52, 24)]);
    expect(a.faltan).toBe(76);
    expect(a.faltanPorSexo).toEqual([
      { sexo: "Mujer", faltan: 52 },
      { sexo: "Hombre", faltan: 24 },
    ]);
  });

  it("el desglose suma exactamente lo que falta", () => {
    // Si no sumara, la lista diría una cosa en la cifra y otra en su detalle.
    const [a] = alertaDeAnticipacion([conCuotas(30, 17)]);
    expect(a.faltanPorSexo.reduce((n, x) => n + x.faltan, 0)).toBe(a.faltan);
  });

  it("un sexo que ya cerró no aparece en el desglose", () => {
    // «0 hombres» no es una instrucción: es ruido en una columna estrecha.
    const [a] = alertaDeAnticipacion([conCuotas(40, 0)]);
    expect(a.faltanPorSexo).toEqual([{ sexo: "Mujer", faltan: 40 }]);
  });

  it("sin brecha no hay desglose", () => {
    const [a] = alertaDeAnticipacion([conCuotas(0, 0)]);
    expect(a.faltanPorSexo).toEqual([]);
  });
});

/**
 * **Una facultad con brecha y sin rendimiento observado no necesita «0» aulas.**
 *
 * Medido en pantalla el 2026-08-25, con el plan de 400 recién importado y aún
 * sin un solo parte de campo: la lectura decía «15 facultades necesitan aulas
 * nuevas · hay que pedir 0 en total» encima de una tabla cuya columna FALTAN
 * traía 983 en Artes Escénicas y 1.340 en Ciencias e Ingeniería.
 *
 * La causa es `esperadoPorAula = 0` antes del primer parte: sin rendimiento no
 * hay entre qué dividir, y ese hueco se estaba resolviendo como cero. Es el
 * mismo error que este archivo ya evita para `reservaDisponible`, donde no saber
 * cuántas quedan no se pinta como que no queda ninguna.
 */
describe("lo que no se puede dimensionar no vale cero", () => {
  it("con brecha y sin rendimiento observado devuelve null, no 0", () => {
    const [a] = alertaDeAnticipacion([
      facultad({ facultad: "Artes Escénicas", cuotas: [cuota(983)], esperadoPorAula: 0 }),
    ]);
    expect(a.aulasNecesarias).toBeNull();
    expect(a.aulasAPedir).toBeNull();
  });

  it("sin brecha sí es cero, porque eso sí se sabe", () => {
    const [a] = alertaDeAnticipacion([
      facultad({ facultad: "Cerrada", cuotas: [cuota(0)], esperadoPorAula: 0 }),
    ]);
    expect(a.aulasNecesarias).toBe(0);
    expect(a.aulasAPedir).toBe(0);
  });

  it("no declara que el banco alcanza cuando no sabe cuánto hay que pedir", () => {
    const [a] = alertaDeAnticipacion(
      [facultad({ facultad: "Derecho", cuotas: [cuota(400)], esperadoPorAula: 0 })],
      [{ faculty: "Derecho", disponibles: 274, extras: 274, elegibles: 274, mujeres: 140, hombres: 134 }],
    );
    expect(a.reservaAlcanza).toBeNull();
  });
});
