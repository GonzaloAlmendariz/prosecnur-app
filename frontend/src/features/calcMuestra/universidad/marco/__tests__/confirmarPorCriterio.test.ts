import { describe, expect, it } from "vitest";

import type { CriteriosSeleccionMarco } from "../../../../../api/client";
import {
  copiarVariableCriterio,
  reconciliarBorradorCriterios,
  type TipoBorradorCriterio,
} from "../../criterios/borradorCriterios";

/**
 * G9 · La confirmación es por criterio.
 *
 * Gonzalo: «yo hago un cambio en el criterio, lo tengo que confirmar, y esa
 * confirmación es lo que permite que el criterio siguiente y los que vienen se
 * actualicen». Estas pruebas fijan la propiedad que lo hace posible:
 * **confirmar uno no puede tocar a los demás**.
 */
// `tipos` es un Map, no un objeto. Mi primer fixture lo pasó como objeto
// literal con un `as never`: `tipos.get` quedaba undefined, el reconciliador
// caía al tipo por defecto y no copiaba nada. Se veía como «la confirmación no
// aplica» — un `as never` que silencia el tipo silencia también el aviso.
const tipos = new Map<string, "flat">([["modality", "flat"], ["session_type", "flat"]]);

const confirmada: CriteriosSeleccionMarco = {
  byVariable: {
    modality: { mode: "include", categories: ["presencial"] },
    session_type: { mode: "include", categories: ["teorico"] },
  },
};

const borrador: CriteriosSeleccionMarco = {
  byVariable: {
    modality: { mode: "include", categories: ["presencial", "virtual"] },
    session_type: { mode: "include", categories: ["teorico", "laboratorio"] },
  },
};

describe("confirmar un solo criterio", () => {
  it("aplica el borrador de ESE criterio y deja el otro como estaba", () => {
    const next = reconciliarBorradorCriterios(confirmada, borrador, new Set(["modality"]), tipos);
    expect(next.byVariable?.modality?.categories).toEqual(["presencial", "virtual"]);
    // El que no se confirmó conserva su valor confirmado, no el del borrador:
    // si se colara, confirmar un criterio publicaría cambios que nadie aprobó.
    expect(next.byVariable?.session_type?.categories).toEqual(["teorico"]);
  });

  it("confirmar los dos por separado llega al mismo sitio que confirmarlos juntos", () => {
    const juntos = reconciliarBorradorCriterios(
      confirmada, borrador, new Set(["modality", "session_type"]), tipos,
    );
    const uno = reconciliarBorradorCriterios(confirmada, borrador, new Set(["modality"]), tipos);
    const dos = reconciliarBorradorCriterios(uno, borrador, new Set(["session_type"]), tipos);
    expect(dos.byVariable?.modality?.categories).toEqual(juntos.byVariable?.modality?.categories);
    expect(dos.byVariable?.session_type?.categories).toEqual(juntos.byVariable?.session_type?.categories);
  });

  it("confirmar un criterio sin cambios no altera nada", () => {
    const next = reconciliarBorradorCriterios(confirmada, confirmada, new Set(["modality"]), tipos);
    expect(next.byVariable?.modality?.categories).toEqual(["presencial"]);
  });
});

describe("descartar un solo criterio", () => {
  /*
   * G39 · Gonzalo: «si aprieto descartar, ¿no debería volver al valor original
   * ya confirmado o por defecto?». No volvía.
   *
   * Descartar restauraba a mano `byVariable[id]`, y **varios criterios no viven
   * ahí**: el rango de niveles escribe en `courseLevelRanges`, el mínimo por
   * facultad en `minEligible`, las exclusiones en `manualExcludedClassrooms`.
   * Para todos ésos, «Descartar» apagaba el aviso y dejaba el cambio puesto: el
   * usuario cree que revirtió y el borrador sigue sucio.
   *
   * Y este bloque de pruebas no lo cazó porque **replicaba la implementación**:
   * definía su propio `descartarUno` copiando las mismas cuatro líneas de la
   * página. Un test que reimplementa lo que prueba sólo comprueba que sé
   * copiar — y hereda el defecto sin enterarse. Ahora llama al helper real, el
   * mismo que usa confirmar en el sentido contrario.
   */
  const descartarUno = (
    borradorActual: CriteriosSeleccionMarco,
    confirmadaActual: CriteriosSeleccionMarco,
    id: string,
    tipo: TipoBorradorCriterio = "flat",
  ) => copiarVariableCriterio(borradorActual, confirmadaActual, id, tipo);

  it("devuelve ese criterio a lo confirmado y conserva el resto del borrador", () => {
    const next = descartarUno(borrador, confirmada, "modality");
    expect(next.byVariable?.modality?.categories).toEqual(["presencial"]);
    expect(next.byVariable?.session_type?.categories).toEqual(["teorico", "laboratorio"]);
  });

  it("devuelve también un rango de niveles, que no vive en byVariable", () => {
    const conf = { byVariable: {}, courseLevelRanges: { ingenieria: [[1, 5]] } } as CriteriosSeleccionMarco;
    const bor = { byVariable: {}, courseLevelRanges: { ingenieria: [[3, 4]] } } as CriteriosSeleccionMarco;
    const next = descartarUno(bor, conf, "course_level", "range");
    expect(next.courseLevelRanges?.ingenieria).toEqual([[1, 5]]);
  });

  it("devuelve también el mínimo por facultad", () => {
    const conf = { byVariable: {}, minEligible: { value: 15, byFaculty: { ingenieria: 20 } } } as unknown as CriteriosSeleccionMarco;
    const bor = { byVariable: {}, minEligible: { value: 15, byFaculty: { ingenieria: 8 } } } as unknown as CriteriosSeleccionMarco;
    const next = descartarUno(bor, conf, "elegibles_por_aula", "minEligible");
    expect(next.minEligible?.byFaculty?.ingenieria).toBe(20);
  });

  it("devuelve también las exclusiones manuales", () => {
    const conf = { byVariable: {}, manualExcludedClassrooms: ["CH-1"] } as CriteriosSeleccionMarco;
    const bor = { byVariable: {}, manualExcludedClassrooms: ["CH-1", "CH-2", "CH-3"] } as CriteriosSeleccionMarco;
    const next = descartarUno(bor, conf, "manual_excluded", "manualExcluded");
    expect(next.manualExcludedClassrooms).toEqual(["CH-1"]);
  });

  it("sin valor confirmado, descartar deja el criterio sin restricción", () => {
    // «Volver al valor por defecto» cuando nunca hubo uno confirmado: la rama
    // desaparece del borrador en vez de quedarse con el último editado.
    const conf = { byVariable: {} } as CriteriosSeleccionMarco;
    const bor = { byVariable: { modality: { mode: "include", categories: ["virtual"] } } } as CriteriosSeleccionMarco;
    const next = descartarUno(bor, conf, "modality");
    expect(next.byVariable?.modality).toBeUndefined();
  });
});
