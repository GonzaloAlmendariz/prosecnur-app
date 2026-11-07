import { describe, expect, it } from "vitest";
import { fasesVisibles, type FaseVisible } from "./warmupFasesVisibles";

const f = (id: string, status: FaseVisible["status"], label = id): FaseVisible => ({ id, label, status });
const suite = f("suite", "pending", "Listo para trabajar");

describe("fasesVisibles (checklist pulido UI, ítem 6)", () => {
  it("lo terminado se resume en una fila de clave estable; lo activo va debajo y la final al cierre", () => {
    const out = fasesVisibles([f("a", "ready", "Monitoreo"), f("b", "ready", "Editor"), f("c", "ready", "Gráficos"), f("d", "running", "Datos"), suite]);
    expect(out.map((x) => x.id)).toEqual(["listas", "d", "suite"]);
    expect(out[0]).toMatchObject({ label: "Monitoreo, Editor y 1 más", status: "ready", detail: "3 listas" });
  });

  it("al avanzar cambia el estado de las filas, no qué fila ocupa cada sitio", () => {
    const antes = fasesVisibles([f("a", "ready"), f("d", "running"), f("e", "pending"), suite]).map((x) => x.id);
    const despues = fasesVisibles([f("a", "ready"), f("d", "ready"), f("e", "running"), suite]).map((x) => x.id);
    expect(antes).toEqual(["listas", "d", "e", "suite"]);
    expect(despues).toEqual(["listas", "e", "suite"]);
  });

  it("lo que corre va antes que lo que espera, y lo que no cabe se cuenta", () => {
    const out = fasesVisibles([f("p1", "pending"), f("r1", "running"), f("p2", "pending"), f("p3", "pending"), f("p4", "pending"), suite], 3);
    expect(out.map((x) => x.id)).toEqual(["r1", "p1", "p2", "en-espera", "suite"]);
    expect(out[3].label).toBe("2 fases más en espera");
  });

  it("un problema no se esconde dentro del resumen", () => {
    const out = fasesVisibles([f("a", "ready"), f("b", "timeout", "Monitoreo territorial"), suite]);
    expect(out[0]).toMatchObject({ id: "listas", status: "timeout", label: "Monitoreo territorial" });
  });

  it("sólo omitidas: no dice «listas»", () => {
    expect(fasesVisibles([f("a", "skipped", "Validación"), suite])[0]).toMatchObject({ status: "skipped", detail: "No aplica" });
  });
});
