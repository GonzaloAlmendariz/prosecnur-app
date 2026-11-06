import { describe, expect, it } from "vitest";
import { estudioUsaTelefono } from "./estudioUsaTelefono";

describe("estudioUsaTelefono", () => {
  it("un estudio sólo de correo no usa teléfono", () => {
    expect(estudioUsaTelefono({ sources: [{ role: "respuestas", dimensions: { canal: "Correo (Mailchimp)" } }, { role: "universo" }], config: { monitoreo_profile: { units: [{ actor: "Profesores", phone: { enabled: false } }] } } })).toBe(false);
  });
  it("un público con teléfono, una fuente telefónica o un barrido sí", () => {
    expect(estudioUsaTelefono({ sources: [], config: { monitoreo_profile: { units: [{ phone: { enabled: true } }] } } })).toBe(true);
    expect(estudioUsaTelefono({ sources: [{ role: "respuestas", dimensions: { canal: "Teléfono" } }] })).toBe(true);
    expect(estudioUsaTelefono({ sources: [{ role: "barrido" }] })).toBe(true);
  });
  it("sin públicos ni fuentes, o sin estado, responde que sí (como antes)", () => {
    expect(estudioUsaTelefono(null)).toBe(true);
    expect(estudioUsaTelefono({ sources: [], config: {} })).toBe(true);
  });
});
