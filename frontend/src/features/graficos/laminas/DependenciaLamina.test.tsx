// «Rótulo junto a la barra» (F5, Gonzalo 2026-10-14: «es un rótulo personalizado, es un switcher que da a un campo abierto»).
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Slide } from "../../../api/graficos";
import { DependenciaLamina } from "./DependenciaLamina";

vi.mock("../useVariables", async (orig) => ({ ...(await orig<typeof import("../useVariables")>()), useVariables: () => ({ variables: [] }) }));

const lamina = (dependencia: Record<string, unknown>, inferior = "p_barras_apiladas"): Slide => ({
  id: "s1", tipo: "p_slide_2_graficos_vertical",
  payload: {
    superior: { graficador: "p_barras_agrupadas", args: { var: "e$trabaja" } },
    inferior: { graficador: inferior, args: { var: "e$relacion" } },
    meta: { dependencia },
  },
} as unknown as Slide);
const pintar = (s: Slide) => renderToStaticMarkup(<DependenciaLamina slide={s} />);

describe("DependenciaLamina · rótulo junto a la barra", () => {
  it("apagado, sólo el interruptor; encendido, el campo abierto con lo escrito", () => {
    const apagado = pintar(lamina({ de: "superior", habilita: ["Sí"] }));
    expect(apagado).toContain("Rótulo junto a la barra");
    expect(apagado).toMatch(/role="switch"[^>]*aria-checked="false"/);
    expect(apagado).not.toContain('placeholder="Participaron"');
    const encendido = pintar(lamina({ de: "superior", habilita: ["Sí"], rotulo: "Trabajan" }));
    expect(encendido).toMatch(/role="switch"[^>]*aria-checked="true"/);
    expect(encendido).toMatch(/value="Trabajan"[^>]*placeholder="Participaron"|placeholder="Participaron"[^>]*value="Trabajan"/);
    expect(pintar(lamina({ de: "superior", habilita: ["Sí"], rotulo: "" }))).toContain('placeholder="Participaron"');
  });

  it("sólo cuando el dependiente es una escala", () => {
    expect(pintar(lamina({ de: "superior", habilita: ["Sí"] }, "p_barras_agrupadas"))).not.toContain("Rótulo junto a la barra");
  });
});
