import { describe, expect, it } from "vitest";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import type { ProyeccionDeFacultad } from "./proyeccionPorAgenda";
import { proyeccionPorAgenda } from "./proyeccionPorAgenda";
import { DIAS_DE_ANTICIPACION, TASA_DE_CAIDA, alertaDeAnticipacion } from "./alertaDeAnticipacion";

// Agosto de 2026: los domingos caen 2, 9, 16, 23 y 30.
const dia = (fecha: string) => ({ fecha, aulas: 1, elegibles: 40, esperadas: 20, acumuladas: 20 });

const facultad = (p: Partial<ProyeccionDeFacultad> & { facultad: string }): ProyeccionDeFacultad => ({
  esperadoPorAula: 20,
  aulasAgendadas: 0,
  dias: [],
  cuotas: [],
  reparto: "observada",
  alcanzaTodo: false,
  corte: "2026-08-10",
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
    expect(a.aulasAPedir).toBeGreaterThan(a.aulasNecesarias);
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
    const [a] = alertaDeAnticipacion([
      facultad({ facultad: "Nueva", esperadoPorAula: 0, cuotas: [cuota(50)] }),
    ]);
    expect(a.aulasNecesarias).toBe(0);
    expect(a.aulasAPedir).toBe(0);
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
    expect(res[0].aulasAPedir).toBeLessThan(res[1].aulasAPedir);
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
  it("7 días de anticipación y 23.5 % de caída", () => {
    // Si alguien las cambia, que sea a sabiendas: son la mediana de llamada a
    // aplicación de los titulares y los 40 reemplazos de 170.
    expect(DIAS_DE_ANTICIPACION).toBe(7);
    expect(TASA_DE_CAIDA).toBeCloseTo(40 / 170, 2);
  });
});
