import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { acotarUmbral, ControlUmbral } from "../ControlUmbral";

/**
 * F120 · Gonzalo: «el criterio de umbral y el de proporción no son criterios
 * que se puedan establecer únicamente con switcher; al activar el switcher,
 * justo abajo hay un pequeño espacio vacío, y allí puede ir algún tipo de
 * nivelador».
 */
const render = (over: Partial<Parameters<typeof ControlUmbral>[0]> = {}) =>
  renderToStaticMarkup(
    <ControlUmbral valor={20} min={0} max={100} etiqueta="Mínimo de alumnos" onCambio={() => {}} {...over} />,
  );

describe("ControlUmbral", () => {
  it("ofrece los dos controles sobre el mismo valor", () => {
    // El deslizador sirve para BUSCAR —recorrerlo con el gráfico al lado enseña
    // qué recorta cada posición— y el campo para FIJAR: un mínimo de 20 se
    // escribe. Quitar cualquiera deja media tarea sin herramienta.
    const html = render();
    expect(html).toContain('type="range"');
    expect(html).toContain('type="number"');
    expect((html.match(/value="20"/g) ?? []).length).toBe(2);
  });

  it("ambos comparten rango: ninguno admite lo que el otro rechaza", () => {
    const html = render({ min: 5, max: 60 });
    expect((html.match(/min="5"/g) ?? []).length).toBe(2);
    expect((html.match(/max="60"/g) ?? []).length).toBe(2);
  });

  it("una proporción lleva su sufijo, un conteo no", () => {
    expect(render({ sufijo: "%" })).toContain("<em aria-hidden=\"true\">%</em>");
    expect(render()).not.toContain("<em aria-hidden=\"true\">");
  });

  it("declara el rango en sus extremos", () => {
    const html = render({ min: 0, max: 60 });
    const nota = /<p class="cmv2-umbral-rango-nota"[^>]*>([\s\S]*?)<\/p>/.exec(html)?.[1] ?? "";
    expect(nota).toContain(">0<");
    expect(nota).toContain(">60<");
  });

  it("publica la consecuencia sólo cuando el motor la trae", () => {
    // Una línea más sólo se justifica si dice qué pasa al dejar el valor aquí.
    expect(render({ descripcion: "deja fuera 36 de 45" })).toContain("deja fuera 36 de 45");
    expect(render()).not.toContain("cmv2-umbral-efecto");
  });

  it("el deslizador tiene nombre propio para quien no lo ve", () => {
    // Dos controles del mismo valor: sin distinguirlos, un lector de pantalla
    // anuncia dos veces lo mismo y no se sabe en cuál se está.
    expect(render()).toContain('aria-label="Mínimo de alumnos — deslizador"');
    expect(render()).toContain("<label");
  });

  it("acota lo que sale del control a su rango", () => {
    // Un umbral fuera de escala se dibuja fuera del gráfico, y ese es el caso
    // que menos se ve (F117). Se comprueba LA función del componente: la
    // primera versión de este test reimplementaba el acotado aquí dentro, así
    // que habría pasado aunque el control no acotara nada.
    expect(acotarUmbral(999, 0, 50)).toBe(50);
    expect(acotarUmbral(-4, 0, 50)).toBe(0);
    expect(acotarUmbral(31, 0, 50)).toBe(31);
  });

  it("deshabilitado marca los dos controles, no sólo uno", () => {
    const html = render({ deshabilitado: true });
    expect((html.match(/disabled=""/g) ?? []).length).toBe(2);
  });
});
