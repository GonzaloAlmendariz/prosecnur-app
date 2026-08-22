// Qué defiende este archivo: que Monitoreo deje de preguntar el modo IGNORANDO
// lo que el proyecto ya declara, y que la sugerencia siga siendo una sugerencia.
//
// Los tres asertos que valen son los que distinguen «sugerir» de «imponer»:
// que las cuatro tarjetas sigan siendo botones habilitados, que sin señal no
// haya marca, y que con dos señales fuertes tampoco.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { sugerirModoDeMonitoreo } from "./core/sugerenciaDeModo";
import { MonitoreoModeChoice } from "./MonitoreoModeChoice";

describe("sugerirModoDeMonitoreo", () => {
  it("con una selección de aulas sugiere cursos-horario y dice cuántos", () => {
    const s = sugerirModoDeMonitoreo({ calc: { mode: "aulas", aulas_titulares: 190 } });
    expect(s?.family).toBe("aulas_universitarias");
    // La cifra es el motivo: sin ella la marca es una corazonada.
    expect(s?.motivo).toContain("190");
  });

  it("sin señal no sugiere nada", () => {
    expect(sugerirModoDeMonitoreo({ calc: { mode: "general", aulas_titulares: 0 } })).toBeNull();
    expect(sugerirModoDeMonitoreo(null)).toBeNull();
    expect(sugerirModoDeMonitoreo({})).toBeNull();
  });

  it("un modo 'aulas' sin titulares sorteados todavía no es una señal", () => {
    // El módulo abierto no basta: la señal es que HAYA sorteo.
    expect(sugerirModoDeMonitoreo({ calc: { mode: "aulas", aulas_titulares: 0 } })).toBeNull();
  });

  it("con aulas Y territorio no desempata: ahí la elección es del analista", () => {
    expect(
      sugerirModoDeMonitoreo({
        calc: { mode: "aulas", aulas_titulares: 190 },
        hojas: { districts_count: 4 },
      }),
    ).toBeNull();
  });

  it("con distritos declarados sugiere territorial", () => {
    const s = sugerirModoDeMonitoreo({ hojas: { districts_count: 1 } });
    expect(s?.family).toBe("territorial");
    expect(s?.motivo).toContain("1 distrito");
  });
});

describe("MonitoreoModeChoice con sugerencia", () => {
  const render = (sugerencia: Parameters<typeof MonitoreoModeChoice>[0]["sugerencia"]) =>
    renderToStaticMarkup(<MonitoreoModeChoice sugerencia={sugerencia} onChoose={() => {}} />);

  it("marca la tarjeta sugerida y pone el motivo con su cifra en el lead", () => {
    const html = render({
      family: "aulas_universitarias",
      motivo: "Tu cálculo de muestra ya tiene 190 cursos-horario sorteados.",
    });
    expect(html).toContain("mon-mode-choice__option--sugerida");
    expect(html).toContain("Sugerido");
    expect(html).toContain("190 cursos-horario sorteados");
  });

  it("sugerir no es elegir: las cuatro tarjetas siguen siendo botones habilitados", () => {
    const html = render({ family: "aulas_universitarias", motivo: "…" });
    expect(html).not.toContain("disabled");
    // Una sola marcada, no varias.
    expect(html.split("mon-mode-choice__option--sugerida").length - 1).toBe(1);
  });

  it("sin sugerencia la pantalla queda exactamente como estaba", () => {
    const html = render(null);
    expect(html).not.toContain("mon-mode-choice__option--sugerida");
    expect(html).not.toContain("Sugerido");
    expect(html).toContain("Elige el modo que corresponde al diseño del estudio");
  });

  it("una sugerencia de un modo que no está en pantalla se ignora", () => {
    // `digital_general` existe en el backend y no tiene tarjeta activa: marcar
    // algo invisible dejaría el lead prometiendo una tarjeta que no está.
    const html = render({ family: "digital_general", motivo: "no debería verse" });
    expect(html).not.toContain("mon-mode-choice__option--sugerida");
    expect(html).not.toContain("no debería verse");
  });
});
