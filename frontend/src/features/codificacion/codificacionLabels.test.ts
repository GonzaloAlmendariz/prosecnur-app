import { describe, expect, test } from "vitest";
import { cleanCodificacionLabel, displayCodificacionValueLabel } from "./codificacionLabels";

describe("codificacion labels", () => {
  test("uses one language for yes/no option labels", () => {
    expect(displayCodificacionValueLabel("Si", "Yes")).toMatchObject({ label: "Sí" });
    expect(displayCodificacionValueLabel("No", "No")).toMatchObject({ label: "No" });
  });

  test("keeps technical codes separate from cleaned human labels", () => {
    expect(displayCodificacionValueLabel("NoTell", "Prefiere no responder Prefers not to answer")).toMatchObject({
      code: "NoTell",
      label: "Prefiere no responder",
    });
  });

  test("removes the second-language tail in bilingual choice labels", () => {
    expect(cleanCodificacionLabel("Buenas referencias de familiares / conocidos Good references from family")).toBe(
      "Buenas referencias de familiares / conocidos",
    );
  });
});
