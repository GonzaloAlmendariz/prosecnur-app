import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { MetaCuotaInput, metaConfirmada } from "./MetaCuotaInput";

// Escribir una meta de dos cifras era imposible: el input estaba atado al
// estado del servidor y cada tecla persistía la config y recalculaba universo,
// brecha, tasa y reserva. Para llegar a «80» había que guardar un «8», y borrar
// el campo lo devolvía a «0» en el mismo golpe de tecla.

describe("metaConfirmada", () => {
  it("el campo vacío no es una meta de cero", () => {
    // Era el corazón del defecto: `Number("") || 0` guardaba 0 al borrar.
    expect(metaConfirmada("", 80)).toBeNull();
    expect(metaConfirmada("   ", 80)).toBeNull();
  });

  it("guarda el número tecleado", () => {
    expect(metaConfirmada("80", 0)).toBe(80);
    expect(metaConfirmada(" 20 ", 0)).toBe(20);
  });

  it("cero es una meta legítima cuando se escribe de verdad", () => {
    expect(metaConfirmada("0", 20)).toBe(0);
  });

  it("no persiste cuando el valor no cambió", () => {
    // Sin esto, salir del campo sin tocarlo dispara un guardado y un recálculo.
    expect(metaConfirmada("80", 80)).toBeNull();
    expect(metaConfirmada("80.0", 80)).toBeNull();
  });

  it("descarta lo que no es una meta", () => {
    expect(metaConfirmada("-5", 20)).toBeNull();
    expect(metaConfirmada("abc", 20)).toBeNull();
  });

  it("redondea el decimal en vez de rechazarlo", () => {
    // Una meta es un conteo de entrevistas; 79.6 es un pegado, no un rechazo.
    expect(metaConfirmada("79.6", 0)).toBe(80);
  });
});

describe("MetaCuotaInput", () => {
  it("muestra la meta guardada y no dispara nada al renderizar", () => {
    const onCommit = vi.fn();
    const html = renderToStaticMarkup(
      <MetaCuotaInput value={80} onCommit={onCommit} ariaLabel="Meta de Homologación Laboral" />,
    );

    expect(html).toContain('value="80"');
    expect(html).toContain('aria-label="Meta de Homologación Laboral"');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("una cuota sin meta arranca en cero, no vacía", () => {
    const html = renderToStaticMarkup(<MetaCuotaInput value={null} onCommit={vi.fn()} />);
    expect(html).toContain('value="0"');
  });
});
