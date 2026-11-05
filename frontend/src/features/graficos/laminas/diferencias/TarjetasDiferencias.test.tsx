// Mata (C1): una sección que no dice qué hace ni en qué estado está, y el interruptor sin nombre accesible.
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { OpcionesTarjetas } from "./OpcionesTarjetas";
import { TarjetasDiferenciasVista } from "./TarjetasDiferencias";
import { tarjetasConTodas, tarjetasTodas } from "./modeloTarjetas";

const nada = () => undefined;

// Las sugerencias del grupo salen de las categorías del cruce: aquí, sin red.
vi.mock("../useCategoriasGrafico", () => ({
  useCategoriasGrafico: () => ({
    fase: "lista", reintentar: () => undefined,
    datos: { categorias: [{ codigo: "1", etiqueta: "Economía y Finanzas" }, { codigo: "2", etiqueta: "Ciencias e Ingeniería" }] },
  }),
}));

const MAZO = {
  activo: true,
  publico: "estudiantes",
  cruces: ["area", "nivel_curricular"],
  rotulos: { area: "Área", nivel_curricular: "Nivel" },
  cortos: { "Economía y Finanzas": "Econ. y Finanzas" },
};

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

describe("OpcionesTarjetas (U1, U2)", () => {
  const pintar = (valor: Parameters<typeof OpcionesTarjetas>[0]["valor"], ranura: "izquierda" | null = null) => renderToStaticMarkup(
    <MemoryRouter><OpcionesTarjetas valor={valor} ranura={ranura} scope="active" baseActiva="estudiantes" onCambio={nada} /></MemoryRouter>,
  );

  it("muestra los cruces con su nombre, los rótulos cortos, cómo se nombran los casos y el tope", () => {
    const html = pintar(MAZO);
    expect(html).toContain('data-qa="tarjetas-cruces"');
    expect(html).toContain('value="Área"');
    expect(html).toContain('value="Nivel"');
    expect(html).toContain("En este orden. El nombre vacío usa el de la pregunta.");
    expect(html).toContain('data-qa="tarjetas-cortos"');
    expect(html).toContain('value="Economía y Finanzas"');
    expect(html).toContain('value="Econ. y Finanzas"');
    expect(html).toContain('aria-label="Rótulo corto del grupo Economía y Finanzas"');
    // Las sugerencias del grupo son las categorías de los cruces elegidos.
    expect(html).toMatch(/<datalist[^>]*><option value="Economía y Finanzas"/);
    expect(html).toContain("Cómo se nombran los casos");
    expect(html).toContain('value="estudiantes"');
    expect(html).toContain('placeholder="personas encuestadas"');
    expect(html).toContain('role="radiogroup" aria-label="Máximo de tarjetas"');
    expect(html).toContain('aria-checked="true" tabindex="0" class="pulso-f6-seg-op is-activo">4 (por defecto)');
  });

  it("sin cruces elegidos dice que van los del estudio; en una ranura el tope es 1 o 2", () => {
    const html = pintar(true, "izquierda");
    expect(html).toContain("Sin elegir, los cruces del estudio.");
    expect(html).toContain(">2 (por defecto)<");
    expect(html).not.toContain(">3<");
  });

  it("la sección de una ranura dice dónde van las tarjetas y su tope", () => {
    const html = renderToStaticMarkup(
      <TarjetasDiferenciasVista activas enRanura max={2} onAlternar={nada} onAbrirRegla={nada} opciones={<span>opciones</span>} />,
    );
    expect(html).toContain("Tarjetas bajo el gráfico");
    expect(html).toContain("Tarjetas de diferencias debajo de este gráfico");
    expect(html).toContain("Hasta 2 tarjetas");
    expect(html).toContain("<span>opciones</span>");
    const off = renderToStaticMarkup(<TarjetasDiferenciasVista activas={false} onAlternar={nada} onAbrirRegla={nada} opciones={<span>opciones</span>} />);
    expect(off).not.toContain("<span>opciones</span>");
  });
});
