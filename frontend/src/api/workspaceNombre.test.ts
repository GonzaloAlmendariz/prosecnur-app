import { describe, expect, test } from "vitest";

import { nombreVisibleDelProyecto, type ProjectStatus } from "./workspace";

const base: ProjectStatus = { has_project: true, path: "/x/Padron 2026.pulso", name: "Padron 2026", dirty: false, last_saved_at: null };

describe("nombre del proyecto en el chip (ADR 0124)", () => {
  test("con nombre declarado en la Ficha, el chip lo dice", () => {
    expect(nombreVisibleDelProyecto({ ...base, nombre_estudio: "Percepción del servicio" })).toBe("Percepción del servicio");
  });

  test("sin declarar, o con un backend viejo, el chip dice el nombre del archivo", () => {
    expect(nombreVisibleDelProyecto({ ...base, nombre_estudio: "Padron 2026" })).toBe("Padron 2026");
    expect(nombreVisibleDelProyecto(base)).toBe("Padron 2026");
    expect(nombreVisibleDelProyecto({ ...base, nombre_estudio: null })).toBe("Padron 2026");
    expect(nombreVisibleDelProyecto({ ...base, nombre_estudio: "NA" })).toBe("Padron 2026");
    expect(nombreVisibleDelProyecto({ ...base, nombre_estudio: "  " })).toBe("Padron 2026");
  });
});
