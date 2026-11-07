// Tarjeta del mazo pintada: antetítulo, tipo con su clase, «Título por escribir» (nunca un título sugerido), la regla
// con el texto del motor cuando llega y en palabras mientras tanto, el aviso de Aperturas en vez de la regla, y
// Quitar/Volver a incluir y Editar (que despliega la Regla de preguntas en la misma tarjeta).
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
  nombre: "Contraste de públicos", claseTarjeta: "resumen", antetitulo: "Docentes y estudiantes",
  graficador: "p_dumbbell", slot: "grafico", args: { estilo: "resumen", regla: { tipo: "mayor_diferencia", n: 13 } },
  reglaEnPalabras: "Las 13 de mayor diferencia, de docentes y estudiantes", falta: null,
};

const SIN_CONTEO: ConteoEnVivo = { conteo: null, cargando: true, error: null, codigo: null };

const pintar = (p: PropuestaMazo, extra: { incluida?: boolean; editando?: boolean; conteo?: ConteoEnVivo } = {}) => {
  estado.actual = extra.conteo ?? SIN_CONTEO;
  estado.activo = [];
  return renderToStaticMarkup(
    <TarjetaMazo numero={3} propuesta={p} incluida={extra.incluida ?? true} editando={extra.editando ?? false} scope="active"
      onAlternar={() => undefined} onEditar={() => undefined} onRegla={() => undefined} />,
  );
};

describe("TarjetaMazo", () => {
  it("antetítulo, tipo con su clase, título por escribir y la regla en palabras mientras cuenta", () => {
    const html = pintar(CONTRASTE);
    expect(html).toContain("Docentes y estudiantes");
    expect(html).toContain("Contraste de públicos");
    expect(html).toContain("Lámina de resumen");
    expect(html).toContain("Título por escribir");
    expect(html).toContain("Las 13 de mayor diferencia, de docentes y estudiantes");
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain(">Quitar<");
    expect(html).toContain(">Editar<");
    expect(html).not.toContain('type="checkbox"');
    expect(estado.activo[0]).toBe(true);
  });

  it("Q2-2: el antetítulo va arriba y el tipo con su clase debajo, en la misma columna", () => {
    const html = pintar(CONTRASTE);
    expect(html).toMatch(/class="pulso-f6-mazo-cabeza-texto"><span class="pulso-f6-mazo-antetitulo">Docentes y estudiantes<\/span><span class="pulso-f6-mazo-tipo"/);
  });

  it("con el conteo del motor, su texto tal cual", () => {
    const html = pintar(CONTRASTE, {
      conteo: {
        cargando: false, error: null, codigo: null,
        conteo: { total: 47, seleccionadas: ["a"], candidatas: [], texto_regla: "Se muestran las 13 de mayor diferencia, de 47 preguntas comunes.", avisos: [] },
      },
    });
    expect(html).toContain("Se muestran las 13 de mayor diferencia, de 47 preguntas comunes.");
  });

  it("quitada: «Volver a incluir», sin Editar y sin pedir el conteo", () => {
    const html = pintar(CONTRASTE, { incluida: false });
    expect(html).toContain("Volver a incluir");
    expect(html).not.toContain(">Editar<");
    expect(html).toContain('data-incluida="false"');
    expect(estado.activo[0]).toBe(false);
  });

  it("aperturas dice lo que le falta en lugar de la regla y no se edita aquí", () => {
    const html = pintar({ ...CONTRASTE, id: "aperturas", clase: "aperturas", falta: "Falta elegir la pregunta que divide" });
    expect(html).toContain("Falta elegir la pregunta que divide");
    expect(html).not.toContain(">Editar<");
    expect(estado.activo[0]).toBe(false);
  });

  it("editando: la Regla de preguntas en la misma tarjeta y la tarjeta no pide su propio conteo", () => {
    const html = pintar(CONTRASTE, { editando: true });
    expect(html).toContain("Regla de preguntas");
    expect(html).toContain('aria-expanded="true"');
    expect(estado.activo[0]).toBe(false);
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
