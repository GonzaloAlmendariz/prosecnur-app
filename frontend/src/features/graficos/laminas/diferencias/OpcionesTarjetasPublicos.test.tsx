// Mata (ADR 0138): el selector «Entre grupos / Entre públicos» en un gráfico donde no aplica, cruces y casos nombrados
// (que el motor ignora entre públicos) pintados en ese modo, y el tope sin su valor por defecto.
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { OpcionesTarjetas } from "./OpcionesTarjetas";
import { TarjetasDiferenciasVista } from "./TarjetasDiferencias";
import type { ModosAdmitidos, ValorTarjetas } from "./modeloTarjetas";

const nada = () => undefined;

vi.mock("../useCategoriasGrafico", () => ({
  useCategoriasGrafico: () => ({ fase: "lista", reintentar: () => undefined, datos: { categorias: [] } }),
}));

const pintar = (valor: ValorTarjetas, modos?: ModosAdmitidos) => renderToStaticMarkup(
  <MemoryRouter><OpcionesTarjetas valor={valor} ranura={null} scope="active" baseActiva="docentes" onCambio={nada} modos={modos} onModo={nada} /></MemoryRouter>,
);

describe("OpcionesTarjetas: entre grupos o entre públicos", () => {
  it("sin «Entre públicos» admitido no hay selector de modo (barras de una base)", () => {
    const html = pintar(true);
    expect(html).not.toContain('data-qa="tarjetas-modo"');
    expect(html).not.toContain("Entre públicos");
    expect(html).toContain('data-qa="tarjetas-cruces"');
  });

  it("donde aplica, el selector ofrece los dos modos y «Entre grupos» queda deshabilitada", () => {
    const html = pintar({ activo: true, entre_publicos: true }, { grupos: false, publicos: true });
    expect(html).toContain('data-qa="tarjetas-modo"');
    expect(html).toMatch(/aria-label="Comparar"[^>]*role="radiogroup"/);
    expect(html).toMatch(/disabled=""[^>]*>(?:<span[^>]*>)?Entre grupos</);
    expect(html).toMatch(/aria-checked="true"[^>]*>(?:<span[^>]*>)?Entre públicos</);
  });

  it("entre públicos muestra el tope como deslizable (4 por defecto) y no los cruces ni los casos", () => {
    const html = pintar({ activo: true, entre_publicos: true }, { grupos: false, publicos: true });
    expect(html).toContain('data-qa="tarjetas-max-publicos"');
    expect(html).toContain("Máximo de tarjetas");
    expect(html).toMatch(/value="4"/);
    expect(html).not.toContain('data-qa="tarjetas-cruces"');
    expect(html).not.toContain("Cómo se nombran los casos");
    const tres = pintar({ activo: true, entre_publicos: true, max: 3 }, { grupos: false, publicos: true });
    expect(tres).toMatch(/value="3"/);
  });

  it("una opción vieja entre grupos en un gráfico que sólo compara públicos lo dice y no pinta los cruces", () => {
    const html = pintar(true, { grupos: false, publicos: true });
    expect(html).toContain('data-qa="tarjetas-modo-aviso"');
    expect(html).toContain("elige &quot;Entre públicos&quot;");
    expect(html).not.toContain('data-qa="tarjetas-cruces"');
  });
});

describe("TarjetasDiferenciasVista entre públicos", () => {
  it("declara su modo, oculta «Todos los grupos» y pinta el resultado sólo encendida", () => {
    const on = renderToStaticMarkup(
      <TarjetasDiferenciasVista activas modo="publicos" onAlternar={nada} onAbrirRegla={nada} onAlternarTodas={nada} resultado={<span>resultado</span>} />,
    );
    expect(on).toContain('data-estado="tarjetas_publicos"');
    expect(on).toContain('data-modo="publicos"');
    expect(on).toContain("Tarjetas de diferencias entre públicos");
    expect(on).not.toContain("Mostrar todos los grupos");
    expect(on).toContain("<span>resultado</span>");
    const off = renderToStaticMarkup(
      <TarjetasDiferenciasVista activas={false} modo="publicos" onAlternar={nada} onAbrirRegla={nada} resultado={<span>resultado</span>} />,
    );
    expect(off).toContain('data-estado="tarjetas_apagadas"');
    expect(off).toContain("Sólo temas con equivalencia declarada.");
    expect(off).not.toContain("<span>resultado</span>");
  });
});
