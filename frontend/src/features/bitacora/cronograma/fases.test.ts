import { describe, expect, it } from "vitest";

import type { PlanTrabajoTask } from "../../../api/planTrabajo";
import type { BitacoraFaseVista } from "../../../api/bitacora";
import {
  agruparCronograma,
  bucketDe,
  duracionEnDias,
  estaVencida,
  etiquetaRango,
  fasesSolapadas,
  finLocalDe,
  rangoDelEstudio,
} from "./fases";

function tarea(patch: Partial<PlanTrabajoTask> = {}): PlanTrabajoTask {
  return {
    id: "t1", sheet: "", row: 0, phase: "", activity: "Actividad",
    responsible: "", product: "", status: "planned", kind: "activity",
    start_date: "", end_date: "", start_day_index: 0, end_day_index: 0,
    duration_days: 1, grid_start_col: 0, grid_end_col: 0,
    sync_targets: [], notes: "",
    ...patch,
  };
}

// Fecha de referencia fija: 15 de marzo de 2026, 10:00 hora local. Todos los
// casos se leen contra ella.
const AHORA = new Date(2026, 2, 15, 10, 0, 0);

describe("finLocalDe", () => {
  it("un evento de todo el día termina a la medianoche SIGUIENTE", () => {
    // Sin esto, una entrega marcada para hoy aparecería vencida desde las 00:01.
    const fin = finLocalDe({ start_date: "2026-03-15", end_date: "2026-03-15", end_time: "" });
    expect(fin).toEqual(new Date(2026, 2, 16));
  });

  it("con hora de fin usa esa hora exacta", () => {
    const fin = finLocalDe({ start_date: "2026-03-15", end_date: "2026-03-15", end_time: "14:30" });
    expect(fin).toEqual(new Date(2026, 2, 15, 14, 30));
  });

  it("sin fecha de fin cae en la de inicio", () => {
    expect(finLocalDe({ start_date: "2026-03-10", end_date: "", end_time: "" }))
      .toEqual(new Date(2026, 2, 11));
  });

  it("sin ninguna fecha devuelve null en vez de inventar una", () => {
    expect(finLocalDe({ start_date: "", end_date: "", end_time: "" })).toBeNull();
  });
});

describe("estaVencida", () => {
  it("una tarea cuyo fin ya pasó está vencida", () => {
    expect(estaVencida(tarea({ start_date: "2026-03-01", end_date: "2026-03-10" }), AHORA)).toBe(true);
  });

  it("una tarea que termina hoy NO está vencida a media mañana", () => {
    expect(estaVencida(tarea({ start_date: "2026-03-15", end_date: "2026-03-15" }), AHORA)).toBe(false);
  });

  it("una tarea cumplida no vence aunque su fecha haya pasado", () => {
    const t = tarea({ start_date: "2026-03-01", end_date: "2026-03-10", status: "done" });
    expect(estaVencida(t, AHORA)).toBe(false);
  });

  it("una tarea archivada no vence: dejó de estar en juego", () => {
    const t = tarea({ start_date: "2026-03-01", end_date: "2026-03-10", archived_at: "2026-03-11T09:00:00Z" });
    expect(estaVencida(t, AHORA)).toBe(false);
  });

  it("una tarea sin fecha no puede vencer", () => {
    expect(estaVencida(tarea(), AHORA)).toBe(false);
  });

  it("la hora de fin decide dentro del mismo día", () => {
    const temprano = tarea({ start_date: "2026-03-15", end_date: "2026-03-15", end_time: "09:00" });
    const tarde = tarea({ start_date: "2026-03-15", end_date: "2026-03-15", end_time: "18:00" });
    expect(estaVencida(temprano, AHORA)).toBe(true);
    expect(estaVencida(tarde, AHORA)).toBe(false);
  });
});

describe("bucketDe", () => {
  it.each([
    ["2026-03-01", "2026-03-10", "vencido"],
    ["2026-03-15", "2026-03-15", "hoy"],
    ["2026-03-10", "2026-03-20", "hoy"],
    ["2026-03-17", "2026-03-18", "semana"],
    ["2026-03-21", "2026-03-21", "semana"],
    ["2026-04-10", "2026-04-12", "adelante"],
    ["", "", "sin-fecha"],
  ])("inicio=%s fin=%s => %s", (start, end, esperado) => {
    expect(bucketDe(tarea({ start_date: start, end_date: end }), AHORA)).toBe(esperado);
  });

  it("una tarea en curso que empezó antes cae en hoy, no en vencidos", () => {
    // Empezó el 10 y termina el 20: está pasando ahora mismo.
    expect(bucketDe(tarea({ start_date: "2026-03-10", end_date: "2026-03-20" }), AHORA)).toBe("hoy");
  });

  it("«esta semana» son los próximos siete días, no la semana calendario", () => {
    // El 15/03/2026 es domingo. Con semana calendario, el lunes 16 quedaría en
    // «más adelante» y la vista sería inútil.
    expect(bucketDe(tarea({ start_date: "2026-03-16", end_date: "2026-03-16" }), AHORA)).toBe("semana");
  });
});

describe("agruparCronograma", () => {
  it("ordena los grupos vencidos → hoy → semana → adelante → sin fecha", () => {
    const grupos = agruparCronograma(
      [
        tarea({ id: "d", start_date: "2026-04-10", end_date: "2026-04-10" }),
        tarea({ id: "a", start_date: "2026-03-01", end_date: "2026-03-10" }),
        tarea({ id: "e" }),
        tarea({ id: "b", start_date: "2026-03-15", end_date: "2026-03-15" }),
        tarea({ id: "c", start_date: "2026-03-18", end_date: "2026-03-18" }),
      ],
      AHORA,
    );
    expect(grupos.map((g) => g.bucket)).toEqual(["vencido", "hoy", "semana", "adelante", "sin-fecha"]);
  });

  it("omite los buckets vacíos en vez de mostrarlos en cero", () => {
    const grupos = agruparCronograma([tarea({ start_date: "2026-03-15", end_date: "2026-03-15" })], AHORA);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].bucket).toBe("hoy");
  });

  it("dentro del bucket ordena por fecha y desempata por prioridad", () => {
    const grupos = agruparCronograma(
      [
        tarea({ id: "media", start_date: "2026-03-18", end_date: "2026-03-18", priority_rank: 2 }),
        tarea({ id: "critica", start_date: "2026-03-18", end_date: "2026-03-18", priority_rank: 0 }),
        tarea({ id: "temprana", start_date: "2026-03-17", end_date: "2026-03-17", priority_rank: 3 }),
      ],
      AHORA,
    );
    expect(grupos[0].tareas.map((t) => t.id)).toEqual(["temprana", "critica", "media"]);
  });

  it("una lista vacía da cero grupos, no cinco vacíos", () => {
    expect(agruparCronograma([], AHORA)).toEqual([]);
  });
});

describe("duracionEnDias", () => {
  it.each([
    ["2026-03-01", "2026-03-01", 1],
    ["2026-03-01", "2026-03-20", 20],
    ["", "2026-03-20", 0],
    ["2026-03-01", "", 0],
  ])("%s → %s = %i días", (inicio, fin, esperado) => {
    expect(duracionEnDias(inicio, fin)).toBe(esperado);
  });
});

describe("etiquetaRango", () => {
  it("un solo día no se escribe como rango", () => {
    expect(etiquetaRango("2026-03-15", "2026-03-15")).toBe("15 mar");
  });

  it("dentro del mismo mes no repite el mes", () => {
    expect(etiquetaRango("2026-03-03", "2026-03-20")).toBe("3–20 mar");
  });

  it("cruzando meses nombra ambos", () => {
    expect(etiquetaRango("2026-03-25", "2026-04-05")).toBe("25 mar – 5 abr");
  });

  it("sin fechas lo dice, no queda en blanco", () => {
    expect(etiquetaRango("", "")).toBe("Sin fechas");
  });
});

function fase(patch: Partial<BitacoraFaseVista>): BitacoraFaseVista {
  return {
    id: "campo", label: "Campo", modulos: [], task_count: 0,
    declarada: true, start_date: "", end_date: "",
    evidence_state: "planned_only", task_ids: [],
    ...patch,
  } as BitacoraFaseVista;
}

describe("fasesSolapadas", () => {
  it("detecta dos fases que se pisan", () => {
    const out = fasesSolapadas([
      fase({ id: "campo", start_date: "2026-03-01", end_date: "2026-03-20" }),
      fase({ id: "procesamiento", start_date: "2026-03-15", end_date: "2026-03-30" }),
    ]);
    expect(out.sort()).toEqual(["campo", "procesamiento"]);
  });

  it("fases consecutivas sin superposición no se reportan", () => {
    const out = fasesSolapadas([
      fase({ id: "campo", start_date: "2026-03-01", end_date: "2026-03-20" }),
      fase({ id: "procesamiento", start_date: "2026-03-21", end_date: "2026-03-30" }),
    ]);
    expect(out).toEqual([]);
  });

  it("las fases sin fechas no cuentan como solapadas", () => {
    const out = fasesSolapadas([fase({ id: "campo" }), fase({ id: "muestra" })]);
    expect(out).toEqual([]);
  });
});

describe("rangoDelEstudio", () => {
  it("va de la primera fecha a la última entre todas las fases", () => {
    expect(
      rangoDelEstudio([
        fase({ id: "campo", start_date: "2026-03-01", end_date: "2026-03-20" }),
        fase({ id: "procesamiento", start_date: "2026-03-21", end_date: "2026-03-30" }),
      ]),
    ).toEqual({ inicio: "2026-03-01", fin: "2026-03-30" });
  });

  it("sin fases con fechas devuelve vacío", () => {
    expect(rangoDelEstudio([fase({ id: "campo" })])).toEqual({ inicio: "", fin: "" });
  });
});
