import { describe, expect, it } from "vitest";

import type { BitacoraEstado } from "../../../api/bitacora";
import { resumenVivo } from "./resumenVivo";

const ESTADO = {
  plan: {
    tasks: [
      {
        id: "t1",
        activity: "Campo",
        status: "active",
        responsible: "Equipo A",
        start_date: "2026-03-03",
        end_date: "2026-03-20",
        fase: "campo",
      },
      {
        id: "t2",
        activity: "Informe final",
        status: "planned",
        responsible: "",
        start_date: "2026-04-15",
        end_date: "2026-04-15",
        fase: "entregables",
      },
    ],
  },
  bitacora: [
    {
      id: "e1",
      title: "Se cerró el piloto",
      body: "Doce encuestas, sin incidencias.",
      tone: "exito",
      module_id: "monitoreo",
      occurred_at: "2026-03-10T09:00:00Z",
    },
  ],
} as unknown as BitacoraEstado;

describe("resumenVivo", () => {
  it("resuelve un hito con su estado en castellano y su rango de fechas", () => {
    const r = resumenVivo(ESTADO, { target_type: "tarea", target_id: "t1" });
    expect(r.existe).toBe(true);
    expect(r.titulo).toBe("Campo");
    expect(r.estado).toBe("En curso");
    expect(r.fecha).toBe("2026-03-03 → 2026-03-20");
  });

  it("una fase recién sembrada declara que no tiene fechas en vez de dejar el hueco", () => {
    const sinFechas = { ...ESTADO, plan: { tasks: [{ id: "t3", activity: "Diseño", status: "planned", start_date: "", end_date: "" }] } } as unknown as BitacoraEstado;
    expect(resumenVivo(sinFechas, { target_type: "tarea", target_id: "t3" }).fecha).toBe("Sin fechas");
  });

  it("un entregable de un solo día no se muestra como rango de ida y vuelta", () => {
    // «2026-04-15 → 2026-04-15» es ruido: la flecha promete una duración que
    // no existe.
    expect(resumenVivo(ESTADO, { target_type: "tarea", target_id: "t2" }).fecha).toBe("2026-04-15");
  });

  it("resuelve una entrada de bitácora con su tono y su día", () => {
    const r = resumenVivo(ESTADO, { target_type: "entrada", target_id: "e1" });
    expect(r.existe).toBe(true);
    expect(r.titulo).toBe("Se cerró el piloto");
    expect(r.estado).toBe("exito");
    expect(r.fecha).toBe("2026-03-10");
  });

  it.each([
    ["tarea", "fantasma"],
    ["entrada", "fantasma"],
  ] as const)("un destino %s inexistente se declara ausente y conserva su id", (tipo, id) => {
    // El id se conserva para que el nodo huérfano pueda decir a qué apuntaba;
    // sin eso el usuario no sabe qué perdió.
    const r = resumenVivo(ESTADO, { target_type: tipo, target_id: id });
    expect(r.existe).toBe(false);
    expect(r.id).toBe("fantasma");
  });

  it("una pieza de la app no se resuelve acá: el catálogo de módulos vive en el frontend", () => {
    // Devolver `existe: false` sería mentira, pero devolver un título exigiría
    // una segunda copia de `lib/modules.ts`. El nodo usa `identidadDeDestino`.
    const r = resumenVivo(ESTADO, { target_type: "modulo", target_id: "procesamiento/validacion" });
    expect(r.titulo).toBe("");
    expect(r.id).toBe("procesamiento/validacion");
  });

  it("sin referencia no falla: un nodo de texto pasa por el mismo render", () => {
    expect(resumenVivo(ESTADO, null).existe).toBe(false);
  });
});
