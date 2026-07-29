import { describe, expect, it } from "vitest";

import type { BitacoraRecordatorio, PlanTrabajoTask } from "../../../api/planTrabajo";
import {
  agruparVencidos,
  claveDeAviso,
  etiquetaOffset,
  evaluarAvisos,
  instanteDe,
  MAX_OCURRENCIAS,
  ocurrenciasDe,
} from "./motor";

function recordatorio(patch: Partial<BitacoraRecordatorio> = {}): BitacoraRecordatorio {
  return {
    id: "rem1", anchor: "start", offset_minutes: 0, channel: "in_app",
    state: "programado", snoozed_until: "", created_at: "",
    ...patch,
  };
}

function tarea(patch: Partial<PlanTrabajoTask> = {}): PlanTrabajoTask {
  return {
    id: "t1", sheet: "", row: 0, phase: "", activity: "Entrega del informe",
    responsible: "", product: "", status: "planned", kind: "milestone",
    start_date: "2026-03-20", end_date: "2026-03-20",
    start_day_index: 0, end_day_index: 0, duration_days: 1,
    grid_start_col: 0, grid_end_col: 0, sync_targets: [], notes: "",
    reminders: [recordatorio()],
    ...patch,
  };
}

const VACIO = { disparadas: new Set<string>(), pospuestas: new Map<string, Date>() };

describe("instanteDe", () => {
  it("una fecha sin hora es medianoche local", () => {
    expect(instanteDe("2026-03-20", "", 0)).toEqual(new Date(2026, 2, 20, 0, 0));
  });

  it("aplica la hora del día y luego el offset", () => {
    expect(instanteDe("2026-03-20", "09:00", -60)).toEqual(new Date(2026, 2, 20, 8, 0));
  });

  it("un offset de un día antes retrocede el calendario, no 24h de epoch", () => {
    // La diferencia importa cuando el tramo cruza un cambio de horario
    // estacional: sumar milisegundos deja el aviso una hora corrido.
    expect(instanteDe("2026-03-20", "09:00", -1440)).toEqual(new Date(2026, 2, 19, 9, 0));
  });

  it("un offset positivo avisa DESPUÉS del hito", () => {
    expect(instanteDe("2026-03-20", "09:00", 120)).toEqual(new Date(2026, 2, 20, 11, 0));
  });

  it("una fecha inválida no produce instante", () => {
    expect(instanteDe("", "", 0)).toBeNull();
    expect(instanteDe("20/03/2026", "", 0)).toBeNull();
  });
});

describe("ocurrenciasDe", () => {
  it("sin recurrencia hay exactamente una ocurrencia", () => {
    expect(ocurrenciasDe(tarea(), "2026-03-20")).toEqual(["2026-03-20"]);
  });

  it("una regla diaria acotada por count produce esa cantidad", () => {
    const t = tarea({ recurrence: { rule: "daily", interval: 1, until: "", count: 3, exceptions: [], done_instances: [] } });
    expect(ocurrenciasDe(t, "2026-03-20")).toEqual(["2026-03-20", "2026-03-21", "2026-03-22"]);
  });

  it("respeta el intervalo", () => {
    const t = tarea({ recurrence: { rule: "daily", interval: 2, until: "", count: 3, exceptions: [], done_instances: [] } });
    expect(ocurrenciasDe(t, "2026-03-20")).toEqual(["2026-03-20", "2026-03-22", "2026-03-24"]);
  });

  it("una regla semanal salta de siete en siete", () => {
    const t = tarea({ recurrence: { rule: "weekly", interval: 1, until: "", count: 3, exceptions: [], done_instances: [] } });
    expect(ocurrenciasDe(t, "2026-03-02")).toEqual(["2026-03-02", "2026-03-09", "2026-03-16"]);
  });

  it("una regla mensual avanza por calendario", () => {
    const t = tarea({ recurrence: { rule: "monthly", interval: 1, until: "", count: 3, exceptions: [], done_instances: [] } });
    expect(ocurrenciasDe(t, "2026-01-31")).toHaveLength(3);
  });

  it("`until` corta la serie", () => {
    const t = tarea({ recurrence: { rule: "daily", interval: 1, until: "2026-03-22", count: 0, exceptions: [], done_instances: [] } });
    expect(ocurrenciasDe(t, "2026-03-20")).toEqual(["2026-03-20", "2026-03-21", "2026-03-22"]);
  });

  it("las excepciones se saltan sin acortar la serie", () => {
    // `count` describe cuántas veces se repite el hito, no cuántos avisos
    // sobreviven al filtro: por eso la serie sigue llegando al 22.
    const t = tarea({ recurrence: { rule: "daily", interval: 1, until: "", count: 3, exceptions: ["2026-03-21"], done_instances: [] } });
    expect(ocurrenciasDe(t, "2026-03-20")).toEqual(["2026-03-20", "2026-03-22"]);
  });

  it("cumplir una instancia no mata las demás", () => {
    const t = tarea({ recurrence: { rule: "daily", interval: 1, until: "", count: 3, exceptions: [], done_instances: ["2026-03-21"] } });
    const out = ocurrenciasDe(t, "2026-03-20");
    expect(out).toEqual(["2026-03-20", "2026-03-22"]);
    expect(out.length).toBeGreaterThan(0);
  });

  it("una serie sin fin se acota a un año", () => {
    const t = tarea({ recurrence: { rule: "daily", interval: 1, until: "", count: 0, exceptions: [], done_instances: [] } });
    expect(ocurrenciasDe(t, "2026-01-01")).toHaveLength(MAX_OCURRENCIAS);
  });
});

describe("evaluarAvisos", () => {
  const AHORA = new Date(2026, 2, 20, 10, 0);

  it("un recordatorio cuyo instante ya pasó está vencido", () => {
    const t = tarea({ start_date: "2026-03-20", start_time: "09:00" });
    const { vencidos } = evaluarAvisos({ tareas: [t], ahora: AHORA, ...VACIO });
    expect(vencidos).toHaveLength(1);
    expect(vencidos[0].clave).toBe(claveDeAviso("t1", "rem1", "2026-03-20"));
  });

  it("un recordatorio futuro es próximo, no vencido", () => {
    const t = tarea({ start_date: "2026-03-25", start_time: "09:00" });
    const { vencidos, proximos } = evaluarAvisos({ tareas: [t], ahora: AHORA, ...VACIO });
    expect(vencidos).toHaveLength(0);
    expect(proximos).toHaveLength(1);
  });

  it("una clave ya disparada no vuelve a sonar", () => {
    // Es el corazón del disparo único: el libro persistido gana sobre el
    // cálculo, sin importar cuántas veces se reabra la app.
    const t = tarea({ start_date: "2026-03-20", start_time: "09:00" });
    const disparadas = new Set([claveDeAviso("t1", "rem1", "2026-03-20")]);
    const { vencidos } = evaluarAvisos({ tareas: [t], ahora: AHORA, disparadas, pospuestas: new Map() });
    expect(vencidos).toHaveLength(0);
  });

  it("un aviso pospuesto no suena hasta su hora", () => {
    const t = tarea({ start_date: "2026-03-20", start_time: "09:00" });
    const clave = claveDeAviso("t1", "rem1", "2026-03-20");
    const pospuestas = new Map([[clave, new Date(2026, 2, 20, 15, 0)]]);
    const { vencidos, proximos } = evaluarAvisos({ tareas: [t], ahora: AHORA, disparadas: new Set(), pospuestas });
    expect(vencidos).toHaveLength(0);
    expect(proximos).toHaveLength(1);
    expect(proximos[0].cuando).toEqual(new Date(2026, 2, 20, 15, 0));
  });

  it("un aviso pospuesto reaparece pasada su hora", () => {
    const t = tarea({ start_date: "2026-03-20", start_time: "09:00" });
    const clave = claveDeAviso("t1", "rem1", "2026-03-20");
    const pospuestas = new Map([[clave, new Date(2026, 2, 20, 9, 30)]]);
    const { vencidos } = evaluarAvisos({ tareas: [t], ahora: AHORA, disparadas: new Set(), pospuestas });
    expect(vencidos).toHaveLength(1);
  });

  it("una tarea cumplida no avisa", () => {
    const t = tarea({ start_date: "2026-03-20", start_time: "09:00", status: "done" });
    expect(evaluarAvisos({ tareas: [t], ahora: AHORA, ...VACIO }).vencidos).toHaveLength(0);
  });

  it("una tarea archivada no avisa", () => {
    const t = tarea({ start_date: "2026-03-20", start_time: "09:00", archived_at: "2026-03-19T00:00:00Z" });
    expect(evaluarAvisos({ tareas: [t], ahora: AHORA, ...VACIO }).vencidos).toHaveLength(0);
  });

  it("un recordatorio descartado no vuelve", () => {
    const t = tarea({ start_date: "2026-03-20", start_time: "09:00", reminders: [recordatorio({ state: "descartado" })] });
    expect(evaluarAvisos({ tareas: [t], ahora: AHORA, ...VACIO }).vencidos).toHaveLength(0);
  });

  it("un offset que cae en el pasado se dispara una vez, no se descarta", () => {
    // Crear hoy un hito para mañana con aviso de "3 días antes" deja el aviso
    // en el pasado. Debe sonar una vez, no desaparecer en silencio.
    const t = tarea({ start_date: "2026-03-21", start_time: "09:00", reminders: [recordatorio({ offset_minutes: -4320 })] });
    const { vencidos } = evaluarAvisos({ tareas: [t], ahora: AHORA, ...VACIO });
    expect(vencidos).toHaveLength(1);
    expect(vencidos[0].cuando).toEqual(new Date(2026, 2, 18, 9, 0));
  });

  it("el ancla de fin usa la fecha y hora de fin", () => {
    const t = tarea({
      start_date: "2026-03-10", end_date: "2026-03-20", end_time: "18:00",
      reminders: [recordatorio({ anchor: "end", offset_minutes: 0 })],
    });
    const { vencidos, proximos } = evaluarAvisos({ tareas: [t], ahora: AHORA, ...VACIO });
    const todos = [...vencidos, ...proximos];
    expect(todos).toHaveLength(1);
    expect(todos[0].cuando).toEqual(new Date(2026, 2, 20, 18, 0));
  });

  it("una tarea recurrente genera un aviso por instancia, con clave propia", () => {
    const t = tarea({
      start_date: "2026-03-18", start_time: "09:00",
      recurrence: { rule: "daily", interval: 1, until: "", count: 3, exceptions: [], done_instances: [] },
    });
    const { vencidos } = evaluarAvisos({ tareas: [t], ahora: AHORA, ...VACIO });
    expect(vencidos).toHaveLength(3);
    expect(new Set(vencidos.map((a) => a.clave)).size).toBe(3);
  });

  it("disparar una instancia recurrente no silencia las otras", () => {
    const t = tarea({
      start_date: "2026-03-18", start_time: "09:00",
      recurrence: { rule: "daily", interval: 1, until: "", count: 3, exceptions: [], done_instances: [] },
    });
    const disparadas = new Set([claveDeAviso("t1", "rem1", "2026-03-19")]);
    const { vencidos } = evaluarAvisos({ tareas: [t], ahora: AHORA, disparadas, pospuestas: new Map() });
    expect(vencidos.map((a) => a.ocurrencia)).toEqual(["2026-03-18", "2026-03-20"]);
  });

  it("una tarea sin recordatorios no produce nada", () => {
    expect(evaluarAvisos({ tareas: [tarea({ reminders: [] })], ahora: AHORA, ...VACIO }).vencidos).toHaveLength(0);
  });

  it("los vencidos salen ordenados del más viejo al más reciente", () => {
    const tareas = [
      tarea({ id: "b", start_date: "2026-03-19", start_time: "09:00" }),
      tarea({ id: "a", start_date: "2026-03-15", start_time: "09:00" }),
    ];
    const { vencidos } = evaluarAvisos({ tareas, ahora: AHORA, ...VACIO });
    expect(vencidos.map((v) => v.taskId)).toEqual(["a", "b"]);
  });

  it("lo que cae fuera de la ventana no es próximo", () => {
    const t = tarea({ start_date: "2026-06-01", start_time: "09:00" });
    const { proximos } = evaluarAvisos({ tareas: [t], ahora: AHORA, diasProximos: 14, ...VACIO });
    expect(proximos).toHaveLength(0);
  });
});

describe("agruparVencidos", () => {
  const AHORA = new Date(2026, 2, 20, 10, 0);

  function aviso(cuando: Date, id = "x") {
    return {
      clave: id, taskId: id, reminderId: "r", ocurrencia: "2026-03-20",
      cuando, vencimiento: cuando, actividad: "Algo", fase: "campo",
    };
  }

  it("reparte por cercanía y omite los buckets vacíos", () => {
    const grupos = agruparVencidos(
      [
        aviso(new Date(2026, 2, 20, 8, 0), "hoy"),
        aviso(new Date(2026, 2, 19, 8, 0), "ayer"),
        aviso(new Date(2026, 2, 1, 8, 0), "viejo"),
      ],
      AHORA,
    );
    expect(grupos.map((g) => g.bucket)).toEqual(["hoy", "ayer", "antes"]);
    expect(grupos.every((g) => g.avisos.length > 0)).toBe(true);
  });

  it("sin avisos no hay grupos, no cuatro vacíos", () => {
    expect(agruparVencidos([], AHORA)).toEqual([]);
  });

  it("todos los avisos aparecen exactamente una vez", () => {
    const avisos = [
      aviso(new Date(2026, 2, 20, 8, 0), "a"),
      aviso(new Date(2026, 2, 18, 8, 0), "b"),
      aviso(new Date(2026, 1, 1, 8, 0), "c"),
    ];
    const total = agruparVencidos(avisos, AHORA).flatMap((g) => g.avisos);
    expect(total).toHaveLength(3);
    expect(new Set(total.map((a) => a.clave)).size).toBe(3);
  });
});

describe("etiquetaOffset", () => {
  it.each([
    [0, "En el momento"],
    [-60, "1 hora antes"],
    [-1440, "1 día antes"],
    [-2880, "2 días antes"],
    [-120, "2 horas antes"],
    [90, "90 min después"],
  ])("%i => %s", (minutos, esperado) => {
    expect(etiquetaOffset(minutos)).toBe(esperado);
  });
});
