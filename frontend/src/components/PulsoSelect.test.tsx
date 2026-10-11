import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PulsoField } from "./PulsoField";
import { MODULE_ACCENT_VARS, PulsoSelect, moduleAccentStyle } from "./PulsoSelect";

const OPCIONES = [
  { value: "__todas", label: "Todas las secciones (3)" },
  { value: "general", label: "General (26)" },
  { value: "proteccion", label: "Protección (12)" },
];

// El repo no tiene DOM de pruebas (jsdom/happy-dom): abrir el menú y elegir
// por teclado lo garantiza Radix y se verifica en el runner visual. Aquí se
// fija el contrato que sí es estático: disparador accesible, valor visible,
// conexión con PulsoField y la herencia del acento en el portal.
describe("PulsoSelect", () => {
  it("el disparador es un combobox de Radix con el valor elegido", () => {
    const html = renderToStaticMarkup(
      <PulsoSelect value="general" onValueChange={() => {}} options={OPCIONES} ariaLabel="Sección" size="sm" />,
    );
    expect(html).toContain('role="combobox"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-label="Sección"');
    expect(html).toContain("pulso-select-trigger pulso-select-trigger--sm");
    expect(html).toContain("General (26)");
  });

  it("dentro de un PulsoField toma el id del label, el hint y el error", () => {
    const html = renderToStaticMarkup(
      <PulsoField id="sec" label="Sección" error="Elige una sección">
        <PulsoSelect value={undefined} placeholder="Elegir…" onValueChange={() => {}} options={OPCIONES} />
      </PulsoField>,
    );
    expect(html).toContain('for="sec"');
    expect(html).toContain('id="sec"');
    expect(html).toContain('aria-describedby="sec-message"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain("Elegir…");
  });

  it("el portal hereda el acento del módulo que ve el disparador", () => {
    const computed: Record<string, string> = {
      "--module-accent": " #155e63",
      "--module-accent-soft": "rgba(21, 94, 99, 0.12)",
      "--module-accent-border": "",
    };
    expect(moduleAccentStyle((name) => computed[name] ?? "")).toEqual({
      "--module-accent": "#155e63",
      "--module-accent-soft": "rgba(21, 94, 99, 0.12)",
    });
    expect(MODULE_ACCENT_VARS).toEqual(["--module-accent", "--module-accent-soft", "--module-accent-border"]);
  });
});
