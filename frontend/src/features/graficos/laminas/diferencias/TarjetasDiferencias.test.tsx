// Mata (C1): una sección que no dice qué hace ni en qué estado está, y el interruptor sin nombre accesible.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TarjetasDiferenciasVista } from "./TarjetasDiferencias";
import { tarjetasConTodas, tarjetasTodas } from "./modeloTarjetas";

const nada = () => undefined;

describe("TarjetasDiferenciasVista", () => {
  it("declara su estado y explica qué hace en cada uno", () => {
    const on = renderToStaticMarkup(<TarjetasDiferenciasVista activas onAlternar={nada} onAbrirRegla={nada} />);
    expect(on).toContain('data-estado="tarjetas_encendidas"');
    expect(on).toContain("Cada grupo frente al resto");
    expect(on).toContain("Hasta 4 tarjetas");
    const off = renderToStaticMarkup(<TarjetasDiferenciasVista activas={false} onAlternar={nada} onAbrirRegla={nada} />);
    expect(off).toContain('data-estado="tarjetas_apagadas"');
    expect(off).toContain("Tarjetas de diferencias junto al total");
    expect(off).toContain("Regla del estudio");
  });

  it("con «Todos los grupos» lo declara en su estado y lo guarda en la opción sin perder el resto", () => {
    const on = renderToStaticMarkup(
      <TarjetasDiferenciasVista activas todas onAlternar={nada} onAbrirRegla={nada} onAlternarTodas={nada} />,
    );
    expect(on).toContain('data-estado="tarjetas_todas"');
    expect(on).toContain("Mostrar todos los grupos aunque no difieran");
    expect(on).toContain("la flecha marca solo las diferencias");
    const meta = { tarjetas_diferencias: { publico: "estudiantes" } };
    const v = tarjetasConTodas(meta, true);
    expect(v).toEqual({ publico: "estudiantes", activo: true, todas: true });
    expect(tarjetasTodas({ tarjetas_diferencias: v })).toBe(true);
    expect(tarjetasConTodas({ tarjetas_diferencias: v }, false)).toEqual({ publico: "estudiantes", activo: true });
    expect(tarjetasTodas({ tarjetas_diferencias: true })).toBe(false);
  });
});
