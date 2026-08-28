import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AulasUmbralDeDuracion, UMBRAL_DE_DURACION_POR_DEFECTO } from "./AulasUmbralDeDuracion";

/**
 * Gonzalo: «el umbral es menos de 5 minutos, configurable a 8 u otros números,
 * pero lo ideal es definirlos al principio».
 */
describe("el umbral de duración se declara, y entra con su defecto puesto", () => {
  it("sin declarar propone 5, no un campo vacío", () => {
    // Un campo vacío obliga a inventar un número; el 5 es la decisión declarada
    // y se ofrece hecha.
    const html = renderToStaticMarkup(
      <AulasUmbralDeDuracion declarado={false} minutos={null} onDeclarar={() => {}} />,
    );
    expect(UMBRAL_DE_DURACION_POR_DEFECTO).toBe(5);
    expect(html).toContain('value="5"');
    expect(html).toContain("Marcar como sospechosas las de menos de");
  });

  it("declarado, ofrece cambiarlo y trae el vigente", () => {
    const html = renderToStaticMarkup(
      <AulasUmbralDeDuracion declarado minutos={8} onDeclarar={() => {}} />,
    );
    expect(html).toContain('value="8"');
    expect(html).toContain("Cambiar el umbral");
  });

  it("la leyenda es opcional: sólo donde no hay otra frase que ya lo diga", () => {
    // En Validación la frase la pone el panel de tiempos; en Fuentes no hay
    // ninguna, y sin ella el control aparecería sin decir de qué habla.
    const conLeyenda = renderToStaticMarkup(
      <AulasUmbralDeDuracion declarado={false} minutos={null} onDeclarar={() => {}}
        leyenda="Cuánto tiene que durar una respuesta para contar." />,
    );
    const sinLeyenda = renderToStaticMarkup(
      <AulasUmbralDeDuracion declarado={false} minutos={null} onDeclarar={() => {}} />,
    );
    expect(conLeyenda).toContain("Cuánto tiene que durar");
    expect(sinLeyenda).not.toContain("Cuánto tiene que durar");
  });
});
