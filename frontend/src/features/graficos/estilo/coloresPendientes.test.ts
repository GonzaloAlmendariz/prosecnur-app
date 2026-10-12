import { describe, expect, it } from "vitest";
import type { Slide } from "../../../api/graficos";
import { coloresPendientes, conColoresCompletados } from "./coloresPendientes";
import { gruposDeRespuestas, type ListaRespuestas } from "./modeloColoresRespuestas";
import { filasDePaletas } from "./modeloPaletasConNombre";

const sn = (ln: string, v: string[]): ListaRespuestas => ({ list_name: ln, choices: [{ name: "1", label: "Sí" }, { name: "2", label: "No" }], variables: v });
const listas = [sn("lst_p9", ["p9"]), sn("lst_p10", ["p10"]), { list_name: "lst_g", choices: [{ name: "1", label: "Hombre" }, { name: "2", label: "Mujer" }], variables: ["p5"] }];
const lamina = (id: string, graficador: string, args: Record<string, unknown>) => ({ id, tipo: "p_slide_1_grafico", payload: { titulo: "", grafico: { graficador, args } } }) as unknown as Slide;
const filasCon = (paletas: Record<string, Record<string, string>>) => filasDePaletas(gruposDeRespuestas(listas, paletas, {}, new Map()), listas, paletas, {});

describe("P8: exportar con colores pendientes", () => {
  const paletas = { lst_p9: { "Sí": "#081F5C", No: "#9DC3E6" }, lst_p10: { "Sí": "#081F5C" } };
  const slides = [
    lamina("a", "p_barras_multiapiladas", { modo: "multilista", bloques: [{ vars: { t: ["p9"] } }, { vars: { t: ["p10"] } }] }),
    lamina("b", "p_barras_categoricas", { var: "p5" }), // un solo color: no pinta por respuesta, no bloquea
    lamina("c", "p_pie", { var: "p5" }),
  ];

  it("lista cada gráfico que pinta por respuesta con colores faltantes, una vez por paleta, con su lámina", () => {
    const p = coloresPendientes(slides, filasCon(paletas), null, "active");
    expect(p.map((x) => [x.numero, x.fila.nombre, x.fila.faltan])).toEqual([[1, "Sí / No", 1], [3, "Hombre / Mujer", 2]]);
  });

  it("completar todo deja sin pendientes y reutiliza el color que ya existía", () => {
    const p = coloresPendientes(slides, filasCon(paletas), null, "active");
    const completas = conColoresCompletados(p, listas, paletas);
    expect(completas.lst_p10).toEqual({ "Sí": "#081F5C", No: "#9DC3E6" });
    expect(coloresPendientes(slides, filasCon(completas), null, "active")).toEqual([]);
  });
});
