/**
 * Guardia: ninguna cifra de «aulas» de la UI cuenta el marco COMPLETO.
 *
 * `frameRows` es el aula_frame entero —las incluidas por criterios y las
 * excluidas— y su nombre no lo dice. El 2026-08-21 se confió en él tres veces
 * seguidas: el aviso de duración anunciaba «5.269 cursos-horario» donde se
 * comparan 3.373; el mapa de preparación decía «5.269» justo debajo del rótulo
 * «Una fila por curso-horario SELECCIONABLE»; y el fallback de
 * `selectableFrameCount` sobreestimaba en silencio, del que dependen si la
 * pestaña se cree utilizable y cuántos titulares muestra.
 *
 * Ninguno lo vio el typecheck ni los tests de entonces: los vio la pantalla.
 * De ahí este contrato, que sí puede verlos antes.
 *
 * El modelo cuenta una vez (`frameIncludedCount`) y las superficies lo usan.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const src = (rel: string) => readFileSync(resolve(__dirname, "..", rel), "utf8");

const sinComentarios = (texto: string) =>
  texto.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

describe("las pestañas declaran su geometría", () => {
  // Un `ok=true` del gate visual sobre una pestaña que no declara geometría no
  // dice que esté bien: dice que no se miró. El 2026-08-21, al declarar
  // Coincidencia, el gate pasó de verde a rojo y destapó 14 px de espacio
  // muerto que llevaban ahí desde que las tarjetas pasaron a grid.
  const declara = (rel: string) => {
    const txt = src(rel);
    return txt.includes("data-qa-geometry-group") && txt.includes("data-qa-geometry-contract");
  };

  it("una pestaña que se rinde sin datos declara TAMBIÉN su vacío", () => {
    // Medido: Solidez declaraba sólo la rama con selección, así que en el
    // estado en que un usuario nuevo la encuentra —vacía— el gate no auditaba
    // nada y devolvía verde. Un vacío es superficie y también se mide.
    const solidez = src("AulasSolidezTab.tsx");
    const ramaVacia = solidez.slice(solidez.indexOf("if (!selectionReady)"), solidez.indexOf("selectionReady) {") + 900);
    expect(ramaVacia).toContain("data-qa-geometry-group");
  });

  it("las superficies ya cubiertas no pierden su declaración", () => {
    for (const f of [
      "AulasMetodoTab.tsx",
      "../calculo/CalculoPropuestasTab.tsx",
      "../calculo/CalculoCursosHorarioFacultadTab.tsx",
      "../marco/MarcoPoblacionTab.tsx",
      "../marco/MarcoAulasTab.tsx",
      "../salidas/SalidasCoincidenciaTab.tsx",
      "../calculo/CalculoDisenoTab.tsx",
      "AulasSolidezTab.tsx",
    ]) {
      expect(declara(f), `${f} dejó de declarar su geometría`).toBe(true);
    }
  });
});

describe("un vacío que nombra un bloqueo ofrece la salida", () => {
  // `ClassroomEmptyState` acepta `actionLabel`/`onAction` desde siempre y el
  // 2026-08-21 los cuatro vacíos que la usaban pasaban CERO: una capacidad que
  // no consume nadie. Peor, el de Pase a Monitoreo decía «genera la selección»
  // cuando lo que faltaba antes era comparar los métodos — nombraba el bloqueo
  // equivocado y mandaba al sitio equivocado. La cadena real ya la resuelve
  // `resolveAulasStageNotice`, que sí trae causa y destino.
  it("Pase a Monitoreo resuelve su bloqueo con la cadena del módulo", () => {
    const tab = src("../salidas/SalidasMonitoreoTab.tsx");
    expect(tab).toContain("resolveAulasStageNotice");
    expect(tab).toContain("AulasStageNotice");
    // Sin el navegador el aviso nombra el bloqueo pero no lleva a resolverlo.
    expect(tab).toContain("onNavigate");
  });

  it("el desk le pasa el navegador que ya tiene a mano", () => {
    const desk = src("../UniversidadDesk.tsx");
    expect(desk).toMatch(/<SalidasMonitoreoTab[^>]*onNavigate=/);
  });

  // Tercera superficie de la misma familia: Perfil decía «Corre la selección en
  // Cursos-horario titulares» y no llevaba, con `EmptyState` aceptando `cta`.
  it("Perfil ofrece la salida que su texto nombra", () => {
    const tab = src("AulasPerfilTab.tsx");
    expect(tab).toMatch(/cta=\{onNavigate/);
    expect(src("../UniversidadDesk.tsx")).toMatch(/<AulasPerfilTab[\s\S]{0,220}onNavigate=/);
  });

  it("una barra cuyos contenidos son todos condicionales no reserva altura vacía", () => {
    // Los cuatro contenidos del filtro del explorador son condicionales, así
    // que una base sin columnas categóricas filtrables dejaba 30 px de nada
    // sobre la tabla. No se condiciona el render porque `barraFiltrosRef` cuelga
    // de ese div y el popover vive dentro.
    const css = readFileSync(
      resolve(__dirname, "../../definicion/exploradorBases.css"),
      "utf8",
    );
    expect(css).toMatch(/\.cmv2-expb-filtros:empty\s*\{[^}]*display:\s*none/);
  });

  it("una tarjeta con varios hijos no declara uno solo como su contenido", () => {
    // `data-qa-geometry-content` gobierna DOS cosas: la cardinalidad y el
    // `contentBottom` contra el que el gate mide el vacío. Marcado sólo en
    // `detail`, los otros cuatro hijos de la tarjeta pasaban a contar como
    // espacio muerto: 21,14 px por tarjeta en las 21 de la pestaña, contra
    // 1,04 px reales. Marcarlo en un hijo de varios hermanos es el error.
    // Sin comentarios: el porqué de la retirada SE EXPLICA en el archivo y
    // menciona el atributo, así que un `toContain` crudo se dispara contra su
    // propia explicación. Se busca el atributo puesto en un elemento.
    const card = sinComentarios(src("../definicion/VariableMapCard.tsx"));
    expect(card).not.toMatch(/data-qa-geometry-content/);
  });

  it("la clase del botón vive en la hoja de la primitiva que la emite", () => {
    // Estaba partida entre `validacion-v2.css` (base) y `theme.css` (hover):
    // una feature que no cargara la de Validación tenía la clase sin estilo.
    // `states.css` la importa `States.tsx`, así que viaja con quien la emite.
    const estados = readFileSync(
      resolve(__dirname, "../../../../../components/states.css"),
      "utf8",
    );
    expect(estados).toContain(".pulso-empty-cta {");
    expect(estados).toContain(".pulso-empty-cta:hover {");
    const validacion = readFileSync(
      resolve(__dirname, "../../../../validacion/validacion-v2.css"),
      "utf8",
    );
    expect(validacion).not.toContain(".pulso-empty-cta {");
  });
});

describe("las cifras de aulas cuentan las seleccionables", () => {
  const SUPERFICIES = ["AulasMetodoTab.tsx", "AulasSeleccionTab.tsx"];

  it("ninguna superficie mide el marco con `frameRows.length`", () => {
    for (const f of SUPERFICIES) {
      expect(sinComentarios(src(f)), `${f} cuenta el marco completo`).not.toMatch(
        /frameRows\s*\.\s*length/,
      );
    }
  });

  it("el modelo cuenta las incluidas una sola vez y las publica", () => {
    const modelo = src("classroomLabModel.ts");
    expect(modelo).toContain("frameIncludedRows");
    expect(modelo).toContain("frameIncludedCount");
    // Contar es filtrar por el booleano, no por lo que parezca verdadero:
    // `included` llega del motor y un "true" de texto no es una inclusión.
    expect(modelo).toMatch(/fila\.included === true/);
  });

  it("el fallback de aulas seleccionables no puede caer al marco completo", () => {
    const modelo = sinComentarios(src("classroomLabModel.ts"));
    // La rama sin auditoría publicada debe usar el conteo de incluidas.
    const fallback = modelo.slice(
      modelo.indexOf("const selectableFrameCount"),
      modelo.indexOf("const m1ForDisplay"),
    );
    expect(fallback).toContain("frameIncludedCount");
    expect(fallback).not.toMatch(/frameRows\s*\.\s*length/);
  });
});
