import { describe, expect, it } from "vitest";
import { distanciaAlEje } from "./ejeDeEntrega";

describe("distanciaAlEje", () => {
  it("lleva el borde derecho del contenedor al del botón (H3: a 1440 colgaba del borde de la barra)", () => {
    // Medidas de la captura a 1440: barra hasta x=1417, botón de descarga de x=1007 a 1035.
    expect(distanciaAlEje({ left: 0, right: 1417 }, { left: 1007, right: 1035 })).toBe(382);
    // Codificación, "Matriz para el cliente": la anclada terminaba en 1412 (la barra) y el botón en 1139.
    expect(distanciaAlEje({ left: 260, right: 1412 }, { left: 980, right: 1139 })).toBe(273);
  });

  it("con el botón al borde, el contenedor queda al borde; nunca se corre hacia fuera", () => {
    expect(distanciaAlEje({ left: 0, right: 1000 }, { left: 900, right: 1000 })).toBe(0);
    expect(distanciaAlEje({ left: 0, right: 1000 }, { left: 900, right: 1012.4 })).toBe(0);
    expect(distanciaAlEje({ left: 0, right: 1000.6 }, { left: 800, right: 900 })).toBe(101);
  });

  it("con `inicio` mide el borde izquierdo: el contenedor se abre hacia la derecha desde el botón", () => {
    expect(distanciaAlEje({ left: 100, right: 900 }, { left: 124, right: 220 }, "inicio")).toBe(24);
    expect(distanciaAlEje({ left: 100, right: 900 }, { left: 90, right: 220 }, "inicio")).toBe(0);
  });

  it("con límite, un ancla más angosta que el contenedor no lo deja corrido; la ventana sí lo frena", () => {
    // Analítica a 1024: barra de 620 a 996 (376 px), "Plantilla" hasta 992 y contenedor de 380 px.
    expect(distanciaAlEje({ left: 620, right: 996 }, { left: 897, right: 992 }, "fin", { ancho: 380, ventana: 1024 })).toBe(4);
    // El botón cerca del borde izquierdo de la ventana: el contenedor no sale de ella (14 px de margen).
    expect(distanciaAlEje({ left: 0, right: 500 }, { left: 20, right: 100 }, "fin", { ancho: 380, ventana: 1024 })).toBe(106);
    // Con `inicio`, el tope es el borde derecho de la ventana.
    expect(distanciaAlEje({ left: 0, right: 1024 }, { left: 900, right: 990 }, "inicio", { ancho: 380, ventana: 1024 })).toBe(630);
  });
});
