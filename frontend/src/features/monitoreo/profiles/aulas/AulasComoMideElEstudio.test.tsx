import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  AulasComoMideElEstudio,
  type ComoMideElEstudio,
  type DimensionDeclarable,
} from "./AulasComoMideElEstudio";

/**
 * Las tres declaraciones que gobiernan lo que el tablero significa. Existían en
 * el motor y sólo se podían poner por API, así que el estudio en marcha no
 * podía tocar su propia definición.
 *
 * Lo que estas pruebas sujetan no es cómo se ve, sino lo que la superficie
 * PROMETE: que no ofrezca una opción que dejaría el avance en cero, que no
 * cambie el eje de un click, y que no invente opciones cuando el motor no las
 * publica.
 */

const CATALOGO: DimensionDeclarable[] = [
  {
    clave: "facultad", etiqueta: "Facultad", etiqueta_plural: "Facultades",
    columna: "faculty", atribucion: "aula", fuente_valor: "plan", requiere_padron: false,
  },
  {
    clave: "carrera", etiqueta: "Carrera", etiqueta_plural: "Carreras",
    columna: "program", atribucion: "aula", fuente_valor: "plan", requiere_padron: false,
  },
  {
    clave: "nivel", etiqueta: "Nivel", etiqueta_plural: "Niveles",
    columna: "level", atribucion: "persona", fuente_valor: "padron", requiere_padron: true,
  },
];

const VALORES: ComoMideElEstudio = {
  eje: "nivel",
  ejeMotivo: "Las metas del estudio se prometieron por nivel curricular.",
  agrupacion: "carrera",
  inicioCampo: "2026-09-22",
};

const texto = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

function pinta(sobre: Partial<Parameters<typeof AulasComoMideElEstudio>[0]> = {}) {
  return renderToStaticMarkup(
    <AulasComoMideElEstudio
      valores={VALORES}
      dimensiones={CATALOGO}
      padron={{ personas: 1354 }}
      fueraDelOperativo={19}
      onGuardar={() => {}}
      {...sobre}
    />,
  );
}

describe("cómo mide este estudio", () => {
  it("enseña las tres declaraciones vigentes, con el motivo del eje", () => {
    const t = texto(pinta());
    expect(t).toContain("Contra qué se mide la cuota");
    expect(t).toContain("Cómo se agrupa el resumen de Avance");
    expect(t).toContain("Desde cuándo esto es campo");
    // El motivo viaja con el eje: quien lo eligió dijo por qué.
    expect(t).toContain("por nivel curricular");
  });

  /**
   * **El caso que da nombre a la superficie.** Un eje que se resuelve por
   * persona sin padrón cargado manda TODAS las respuestas a «sin nivel» y deja
   * el avance en cero con el aviso culpando al padrón. Ofrecerlo sin decirlo
   * es el fallo mudo que este perfil ya sufrió.
   */
  it("un eje que necesita padrón sin padrón NO se ofrece, y dice por qué", () => {
    const html = pinta({ valores: { ...VALORES, eje: "facultad" }, padron: { personas: 0 } });
    // El chip existe —se ve que la dimensión está— y no se puede pulsar.
    expect(html).toContain("sin padrón");
    expect(html).toMatch(/Nivel[\s\S]{0,200}?disabled|disabled[\s\S]{0,200}?Nivel/);
    // **Visible, no sólo en el `title`**: quien no pasa el ratón por encima no
    // se entera de por qué, y es justo la dimensión que ese estudio querría.
    expect(texto(html)).toContain("no hay padrón cargado");
    expect(texto(html)).toContain("cárgalo en esta misma sección");
  });

  it("con padrón cargado ese mismo eje sí se ofrece", () => {
    const html = pinta({ valores: { ...VALORES, eje: "facultad" }, padron: { personas: 1354 } });
    expect(texto(html)).not.toContain("no hay padrón cargado");
  });

  /**
   * Cambiar el eje re-teclea el numerador de todos los grupos. Un click no
   * puede hacer eso: el primero propone y el segundo confirma, y entre los dos
   * la pantalla dice qué implica.
   */
  it("el eje no se cambia de un click: primero dice qué implica", () => {
    const html = pinta();
    // Sin interacción no hay caja de confirmación en el markup inicial.
    expect(texto(html)).not.toContain("Cambiar el eje");
  });

  it("sólo ofrece agrupar por lo que vive en la fila del plan", () => {
    // El resumen cuenta cursos-horario: por una dimensión que se resuelve por
    // persona publicaría el valor MODAL bajo un rótulo que promete el de cada
    // quien. El motor lo degrada; aquí ni se ofrece.
    const html = pinta();
    const bloque = html.slice(html.indexOf("Cómo se agrupa"));
    const soloAgrupacion = bloque.slice(0, bloque.indexOf("Desde cuándo"));
    expect(soloAgrupacion).toContain("Facultad");
    expect(soloAgrupacion).toContain("Carrera");
    expect(soloAgrupacion).not.toContain("Nivel");
  });

  it("sin catálogo no inventa opciones: lo declara", () => {
    const t = texto(pinta({ dimensiones: [] }));
    expect(t).toContain("todavía no publica las dimensiones disponibles");
  });

  it("la fecha dice qué hace, y su ausencia también", () => {
    expect(texto(pinta())).toContain("19 respuestas fuera del operativo");
    const sinFecha = texto(pinta({ valores: { ...VALORES, inicioCampo: "" } }));
    expect(sinFecha).toContain("Sin fecha no se descarta nada");
  });

  it("sin permiso de guardar se enseña y no se toca", () => {
    const html = pinta({ onGuardar: null });
    // Los tres controles quedan inertes; el panel sigue diciendo lo declarado.
    expect(texto(html)).toContain("Contra qué se mide la cuota");
    expect(html.match(/disabled/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
  });
});
