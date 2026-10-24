import { describe, expect, it } from "vitest";
import { desdeKobo, desdeSurveyMonkey, detalleDelCatalogo, ordenarYBuscar } from "./modeloDeCatalogo";

const KOBO = desdeKobo([
  { uid: "aOld111", name: "Piloto RMS", date_modified: "2026-08-01T10:00:00Z", deployment_active: false },
  { uid: "aRms2026", name: "RMS 2026 · Telefónico", date_modified: "2026-10-20T10:00:00Z", deployment_active: true, submission_count: 412, last_submission_time: "2026-10-23T18:00:00Z" },
  { uid: "aSinFecha", name: "Formulario sin fecha", date_modified: null, deployment_active: true },
]);

describe("catálogo de encuestas", () => {
  it("ordena de la más reciente a la más antigua, sin fecha al final", () => {
    expect(ordenarYBuscar(KOBO, "").map((item) => item.id)).toEqual(["aRms2026", "aOld111", "aSinFecha"]);
  });

  it("busca por nombre (sin tildes ni mayúsculas) o por código", () => {
    expect(ordenarYBuscar(KOBO, "telefonico").map((item) => item.id)).toEqual(["aRms2026"]);
    expect(ordenarYBuscar(KOBO, "aold").map((item) => item.id)).toEqual(["aOld111"]);
  });

  it("dice código, envíos, fecha y estado sólo con lo que la API trae", () => {
    const [rms, viejo] = ordenarYBuscar(KOBO, "");
    expect(detalleDelCatalogo(rms)).toBe("aRms2026 · 412 envíos · último envío 23/10/2026 · Desplegado");
    // Sin `submission_count` no se inventa una cifra.
    expect(detalleDelCatalogo(viejo)).toBe("aOld111 · modificada 01/08/2026 · Inactivo");
  });

  it("SurveyMonkey trae fecha de modificación y respuestas", () => {
    const [encuesta] = desdeSurveyMonkey([{ id: "123", title: "Acreditación 2026", date_modified: "2026-10-01T00:00:00", response_count: 88 }]);
    expect(detalleDelCatalogo(encuesta)).toBe("123 · 88 envíos · modificada 01/10/2026");
  });
});
