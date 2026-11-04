// Mata (C1): una sección que no dice qué hace ni en qué estado está, y el interruptor sin nombre accesible.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TarjetasDiferenciasVista } from "./TarjetasDiferencias";

const nada = () => undefined;

describe("TarjetasDiferenciasVista", () => {
  it("declara su estado y explica qué hace en cada uno", () => {
    const on = renderToStaticMarkup(<TarjetasDiferenciasVista activas onAlternar={nada} onAbrirRegla={nada} />);
    expect(on).toContain('data-estado="tarjetas_encendidas"');
    expect(on).toContain("Cada grupo frente al resto");
    expect(on).toContain("Hasta 6 tarjetas");
    const off = renderToStaticMarkup(<TarjetasDiferenciasVista activas={false} onAlternar={nada} onAbrirRegla={nada} />);
    expect(off).toContain('data-estado="tarjetas_apagadas"');
    expect(off).toContain("Tarjetas de diferencias junto al total");
    expect(off).toContain("Regla del estudio");
  });
});
