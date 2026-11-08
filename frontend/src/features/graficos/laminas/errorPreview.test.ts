// R9-2: el motivo de la última vista previa que falló se recuerda por lámina y se olvida al dibujarse bien.
import { describe, expect, it } from "vitest";
import { useLaminasUi } from "./laminasStore";

describe("R9-2: errores de vista previa por lámina", () => {
  it("se registra el motivo y se borra con null", () => {
    const { registrarErrorPreview } = useLaminasUi.getState();
    registrarErrorPreview("a", "environments cannot be coerced to other types");
    expect(useLaminasUi.getState().erroresPreview).toEqual({ a: "environments cannot be coerced to other types" });
    const antes = useLaminasUi.getState().erroresPreview;
    registrarErrorPreview("a", "environments cannot be coerced to other types");
    expect(useLaminasUi.getState().erroresPreview).toBe(antes);
    registrarErrorPreview("a", null);
    expect(useLaminasUi.getState().erroresPreview).toEqual({});
  });
});
