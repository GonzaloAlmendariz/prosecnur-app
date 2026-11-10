/**
 * El estudio del nombre de un archivo armado en el front sale de la Ficha y del
 * `.pulso` en el momento de entregar, y una lectura que falla no detiene la
 * entrega (ADR 0133 §3).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const plan = vi.fn();
const proyecto = vi.fn();
vi.mock("../../api/planner", () => ({ apiPlannerEstado: () => plan() }));
vi.mock("../../api/workspace", () => ({ apiProjectStatus: () => proyecto() }));

const { estudioDelProyecto, nombreConEstudio } = await import("./nombreConEstudio");
const { fechaDelNombre } = await import("./archivoLocal");

beforeEach(() => {
  plan.mockReset();
  proyecto.mockReset();
});

describe("nombreConEstudio", () => {
  it("usa el código declarado en la Ficha", async () => {
    plan.mockResolvedValue({ planner: { estudio: { codigo: "acnur_acg" } } });
    proyecto.mockResolvedValue({ path: "/Users/ana/otro.pulso" });
    expect(await nombreConEstudio("Plantilla de analítica", "json"))
      .toBe(`acnur_acg_Plantilla_de_analitica_${fechaDelNombre()}.json`);
  });

  it("sin código cae al nombre del .pulso, y sin lecturas a Prosecnur", async () => {
    plan.mockResolvedValue({ planner: { estudio: { codigo: "" } } });
    proyecto.mockResolvedValue({ path: "C:\\Estudios\\Perfil CCSS.pulso" });
    expect(await estudioDelProyecto()).toBe("Perfil_CCSS");
    plan.mockRejectedValue(new Error("sin red"));
    proyecto.mockRejectedValue(new Error("sin red"));
    expect(await estudioDelProyecto()).toBe("Prosecnur");
  });

  it("una respuesta de la Ficha sin planner ni estudio no detiene el nombre", async () => {
    proyecto.mockResolvedValue({ path: "/Users/ana/Perfil.pulso" });
    plan.mockResolvedValue({});
    expect(await estudioDelProyecto()).toBe("Perfil");
    plan.mockResolvedValue({ planner: {} });
    expect(await estudioDelProyecto()).toBe("Perfil");
  });
});
