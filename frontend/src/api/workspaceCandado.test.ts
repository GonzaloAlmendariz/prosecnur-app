import { describe, expect, it } from "vitest";

import { motivoGuardadoBloqueado, type ProjectStatus } from "./workspace";

const base: ProjectStatus = { has_project: true, path: "/x.pulso", name: "x", dirty: false, last_saved_at: null };

describe("candado de guardado en project_status (ADR 0122 §7)", () => {
  it("un backend viejo o un proyecto libre no bloquean", () => {
    expect(motivoGuardadoBloqueado(base)).toBeNull();
    expect(motivoGuardadoBloqueado({ ...base, guardado: { guardado_bloqueado: false, guardado_bloqueado_motivo: "NA" } })).toBeNull();
  });

  it("con el candado devuelve el motivo del backend, el mismo texto del 409", () => {
    const motivo = "Este proyecto se guardó con una versión más nueva de la app. Puedes revisarlo, pero para guardarlo o publicarlo actualiza la app.";
    expect(motivoGuardadoBloqueado({ ...base, guardado: { guardado_bloqueado: true, guardado_bloqueado_motivo: motivo } })).toBe(motivo);
  });

  it("si el motivo no llega, igual dice por qué no se puede guardar", () => {
    expect(motivoGuardadoBloqueado({ ...base, guardado: { guardado_bloqueado: true, guardado_bloqueado_motivo: null } })).toMatch(/actualiza la app/);
  });
});
