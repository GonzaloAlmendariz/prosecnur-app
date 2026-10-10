import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { IconoTipo, tieneIcono, type IconoTipoProps } from "./IconoTipo";

const pintar = (props: IconoTipoProps): string => renderToStaticMarkup(<IconoTipo {...props} />);
const grupoAcento = (m: string): string => m.match(/<g class="pulso-icono-tipo__acento">(.*?)<\/g>/)?.[1] ?? "";

describe("IconoTipo · accesibilidad", () => {
  it("sin título es decorativo", () => {
    const m = pintar({ clase: "lamina", tipo: "p_slide_2_graficos" });
    expect(m).toContain('aria-hidden="true"');
    expect(m).not.toContain("role=");
    expect(m).not.toContain("<title");
    expect(m).toContain('focusable="false"');
  });

  it("con título es una imagen con nombre accesible", () => {
    const m = pintar({ clase: "grafico", tipo: "p_dumbbell", titulo: "Brecha entre dos bases" });
    expect(m).toContain('role="img"');
    expect(m).not.toContain("aria-hidden");
    const id = m.match(/aria-labelledby="([^"]+)"/)?.[1];
    expect(id).toBeTruthy();
    expect(m).toContain(`<title id="${id}">Brecha entre dos bases</title>`);
  });
});

describe("IconoTipo · caja fija", () => {
  it.each([16, 20, 24] as const)("%i px con viewBox 24", (size) => {
    const m = pintar({ clase: "lamina", tipo: "p_slide_portada", size });
    expect(m).toContain(`width="${size}"`);
    expect(m).toContain(`height="${size}"`);
    expect(m).toContain('viewBox="0 0 24 24"');
  });

  it("20 px por defecto y conserva la clase del contexto", () => {
    const m = pintar({ clase: "grafico", tipo: "p_pie", className: "fila-icono" });
    expect(m).toContain('width="20"');
    expect(m).toContain('class="pulso-icono-tipo fila-icono"');
  });
});

describe("IconoTipo · ranura activa", () => {
  it("pinta la ranura con el acento y saca el marco del acento", () => {
    const reposo = pintar({ clase: "lamina", tipo: "p_slide_4_graficos" });
    expect(grupoAcento(reposo)).toMatch(/^<rect[^>]*fill="none"/);
    const activa = pintar({ clase: "lamina", tipo: "p_slide_4_graficos", ranuraActiva: 2 });
    expect(activa).toContain('data-ranura-activa="2"');
    expect(grupoAcento(activa)).toMatch(/^<rect[^>]*fill="currentColor"/);
    expect(grupoAcento(activa)).not.toContain("fill-opacity");
  });

  it("en una lámina de población el punto cede el acento a la ranura", () => {
    const reposo = pintar({ clase: "lamina", tipo: "p_slide_6_graficos_poblacion" });
    expect(grupoAcento(reposo)).toMatch(/^<circle/);
    const activa = pintar({ clase: "lamina", tipo: "p_slide_6_graficos_poblacion", ranuraActiva: 5 });
    expect(grupoAcento(activa)).toMatch(/^<rect/);
  });

  it("una ranura fuera de rango no cambia el dibujo", () => {
    const quitarDato = (m: string) => m.replace(/ data-ranura-activa="\d+"/, "");
    expect(quitarDato(pintar({ clase: "lamina", tipo: "p_slide_2_graficos", ranuraActiva: 9 })))
      .toBe(pintar({ clase: "lamina", tipo: "p_slide_2_graficos" }));
  });
});

describe("IconoTipo · tipo desconocido", () => {
  it("dibuja el marco con ranura punteada, nunca lucide", () => {
    expect(tieneIcono("grafico", "p_grafico_futuro")).toBe(false);
    const m = pintar({ clase: "grafico", tipo: "p_grafico_futuro" });
    expect(m).toContain('data-icono-desconocido="true"');
    expect(m).toContain("stroke-dasharray");
    expect(m).not.toContain("lucide");
  });

  it("los alias y el preset dicotómica tienen ícono", () => {
    expect(tieneIcono("lamina", "p_slide_3_graficos_poblacion")).toBe(true);
    expect(tieneIcono("grafico", "p_barras_apiladas")).toBe(true);
    expect(tieneIcono("grafico", "dicotomica")).toBe(true);
    expect(tieneIcono("grafico", "p_dim_foda")).toBe(false);
  });
});
