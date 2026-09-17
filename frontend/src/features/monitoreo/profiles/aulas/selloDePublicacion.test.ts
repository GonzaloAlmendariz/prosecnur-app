import { describe, expect, it } from "vitest";
import { estadoDelSheets } from "./selloDePublicacion";

describe("si el Sheets del operativo está al día", () => {
  it("sin sello, lo dice: nadie ha publicado desde esta sesión", () => {
    const e = estadoDelSheets(null, "2026-09-17T15:40:35Z");
    expect(e.estado).toBe("sin_publicar");
    expect(e.texto).toContain("puede ser de otro día");
  });

  it("mismo corte en la hoja y en la app = al día", () => {
    // Aunque el reloj de la publicación sea de hace rato: si no ha entrado
    // nada nuevo, la hoja no tiene nada que decir y está al día.
    const e = estadoDelSheets(
      { publicado_en: "2026-09-17T15:45:00Z", synced_at: "2026-09-17T15:40:35Z" },
      "2026-09-17T15:40:35Z",
    );
    expect(e.estado).toBe("al_dia");
    expect(e.texto).toContain("Sheets al día");
  });

  it("cortes distintos = atrasado, y dice POR CUÁNTO", () => {
    // Decir sólo «desactualizado» obliga a adivinar; por un minuto nadie corre
    // a publicar y por dos horas sí. Es el caso de Derecho del 17/09: la hoja
    // con 17 aulas y la app con 19.
    const e = estadoDelSheets(
      { publicado_en: "2026-09-17T14:20:00Z", synced_at: "2026-09-17T14:15:00Z" },
      "2026-09-17T15:40:35Z",
    );
    expect(e.estado).toBe("atrasado");
    expect(e.texto).toContain("se publicó con el corte de las");
    expect(e.texto).toContain("Vuelve a traer respuestas");
  });

  it("sin corte en la app no se acusa de atraso a la hoja", () => {
    // Un estudio que todavía no sincronizó no puede declarar vieja una
    // publicación: no hay con qué compararla.
    const e = estadoDelSheets(
      { publicado_en: "2026-09-17T14:20:00Z", synced_at: "2026-09-17T14:15:00Z" }, "");
    expect(e.estado).toBe("al_dia");
  });
});
