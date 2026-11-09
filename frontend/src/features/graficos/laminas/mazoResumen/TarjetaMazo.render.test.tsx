// Tarjeta del mazo pintada: los públicos que lee, el nombre de la lámina, ningún título ni antetítulo sugerido, la regla con
// el texto del motor cuando llega y en palabras mientras tanto, el aviso de Aperturas en vez de la regla, la casilla de
// la esquina (botón role="checkbox", nunca type="checkbox") y Editar.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ConteoEnVivo } from "../reglaPreguntas/useConteoRegla";
import type { PropuestaMazo } from "./modeloMazo";

const estado = vi.hoisted(() => ({ actual: null as ConteoEnVivo | null, activo: [] as boolean[] }));
vi.mock("../reglaPreguntas/useConteoRegla", () => ({
  useConteoRegla: (_g: string, _a: unknown, _s: string, activo: boolean) => {
    estado.activo.push(activo);
    return estado.actual;
  },
}));

import { TarjetaMazo } from "./TarjetaMazo";

const CONTRASTE: PropuestaMazo = {
  id: "contraste", clase: "contraste", tarjeta: "p_slide_1_grafico:contraste", tipo: "p_slide_1_grafico",
  nombre: "Contraste de públicos", claseTarjeta: "grafico", publicos: ["docentes", "estudiantes"],
  graficador: "p_dumbbell", slot: "grafico", args: { estilo: "resumen", regla: { tipo: "mayor_diferencia", n: 13 } },
  reglaEnPalabras: "Las 13 de mayor diferencia, de docentes y estudiantes", falta: null,
};

const SIN_CONTEO: ConteoEnVivo = { conteo: null, cargando: true, error: null, codigo: null };

const pintar = (p: PropuestaMazo, extra: { elegida?: boolean; editando?: boolean; conteo?: ConteoEnVivo } = {}) => {
  estado.actual = extra.conteo ?? SIN_CONTEO;
  estado.activo = [];
  return renderToStaticMarkup(
    <TarjetaMazo numero={3} propuesta={p} elegida={extra.elegida ?? false} editando={extra.editando ?? false} scope="active"
      idLateral="lat" onAlternar={() => undefined} onEditar={() => undefined} />,
  );
};

describe("TarjetaMazo", () => {
  it("los públicos que lee, tipo con su clase y la regla en palabras mientras cuenta; sin título sugerido", () => {
    const html = pintar(CONTRASTE);
    expect(html).toContain("Docentes y estudiantes");
    expect(html).toContain("Contraste de públicos");
    expect(html).not.toContain("Lámina de resumen");   // M5: repetida en todas, no distinguía nada
    expect(html).not.toContain("Título por escribir");
    expect(html).not.toContain(">Quitar<");
    expect(html).not.toContain("Volver a incluir");
    expect(html).toContain("Las 13 de mayor diferencia, de docentes y estudiantes");
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain(">Editar<");
    expect(html).not.toContain('type="checkbox"');
    expect(estado.activo[0]).toBe(true);
  });

  it("Q2-2: los públicos van arriba y el nombre de la lámina debajo, en la misma columna", () => {
    const html = pintar(CONTRASTE);
    expect(html).toMatch(/class="pulso-f6-mazo-cabeza-texto"><span class="pulso-f6-mazo-lee">Docentes y estudiantes<\/span><span class="pulso-f6-mazo-tipo"/);
  });

  it("la casilla de la esquina: botón role=checkbox con el nombre de la lámina, sin elegir de partida", () => {
    const html = pintar(CONTRASTE);
    expect(html).toMatch(/<button type="button" role="checkbox" aria-checked="false" aria-label="Contraste de públicos, Docentes y estudiantes"/);
    expect(html).toContain('data-elegida="false"');
    const elegida = pintar(CONTRASTE, { elegida: true });
    expect(elegida).toContain('aria-checked="true"');
    expect(elegida).toContain("is-elegida");
  });

  it("con el conteo del motor, su texto tal cual", () => {
    const html = pintar(CONTRASTE, {
      conteo: {
        cargando: false, error: null, codigo: null,
        // Sólo los campos que la tarjeta lee: el contrato del conteo crece en otra rama (tope de filas) y no es de aquí.
        conteo: { total: 47, seleccionadas: ["a"], candidatas: [], texto_regla: "Se muestran las 13 de mayor diferencia, de 47 preguntas comunes.", avisos: [] } as unknown as NonNullable<ConteoEnVivo["conteo"]>,
      },
    });
    expect(html).toContain("Se muestran las 13 de mayor diferencia, de 47 preguntas comunes.");
  });

  it("sin elegir igual pide el conteo y ofrece Editar: es lo que el analista mira para decidir", () => {
    const html = pintar(CONTRASTE, { elegida: false });
    expect(html).toContain(">Editar<");
    expect(estado.activo[0]).toBe(true);
  });

  it("aperturas dice lo que le falta en lugar de la regla y no se edita aquí", () => {
    const html = pintar({ ...CONTRASTE, id: "aperturas", clase: "aperturas", falta: "Falta elegir la pregunta que divide" });
    expect(html).toContain("Falta elegir la pregunta que divide");
    expect(html).not.toContain(">Editar<");
    expect(estado.activo[0]).toBe(false);
  });

  it("editando: la tarjeta queda marcada, «Editar» controla el lateral y la regla NO se despliega en la tarjeta", () => {
    const html = pintar(CONTRASTE, { editando: true });
    // M1: sin insignia que ocupe ancho en la cabeza; la marca es la clase (banda sobre el borde).
    expect(html).not.toContain(">Editando<");
    expect(html).toMatch(/class="[^"]*pulso-f6-mazo-tarjeta[^"]*is-editando/);
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('aria-controls="lat"');
    expect(html).not.toContain("Regla de preguntas");
    expect(estado.activo[0]).toBe(false);
    expect(pintar(CONTRASTE)).not.toContain("aria-controls");
  });

  it("M4: tres Fortalezas y alertas se nombran distinto por su público", () => {
    const fortalezas = (base: string) => pintar({ ...CONTRASTE, id: `fortalezas:${base}`, clase: "fortalezas", nombre: "Fortalezas y alertas", publicos: [base] });
    const nombres = ["docentes", "estudiantes", "administrativos"].map((b) => fortalezas(b).match(/<section[^>]*aria-label="([^"]+)"/)?.[1]);
    expect(nombres).toEqual(["Fortalezas y alertas, Docentes", "Fortalezas y alertas, Estudiantes", "Fortalezas y alertas, Administrativos"]);
    expect(fortalezas("docentes")).toContain('aria-label="Editar Fortalezas y alertas, Docentes"');
  });

  it("la cobertura no tiene regla: la dice en palabras y no ofrece Editar", () => {
    const html = pintar({
      ...CONTRASTE, id: "cobertura", clase: "cobertura", graficador: "p_cobertura", nombre: "Cobertura y participación",
      args: { bases: ["docentes"] }, reglaEnPalabras: "Casos, padrón, cobertura y meta de docentes",
    });
    expect(html).toContain("Casos, padrón, cobertura y meta de docentes");
    expect(html).not.toContain(">Editar<");
    expect(estado.activo[0]).toBe(false);
  });
});
