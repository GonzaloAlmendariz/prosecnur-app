import { describe, expect, it } from "vitest";

import type { CriteriosSeleccionMarco } from "../../../../../api/client";
import { reconciliarBorradorCriterios } from "../../criterios/borradorCriterios";

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
  /**
   * Réplica de `descartarCriterio`: restaura SU rama del borrador desde la
   * selección confirmada. Descartar un criterio no puede llevarse por delante
   * los cambios que hay en los otros — que es lo que hacía el descarte global.
   */
  function descartarUno(
    borradorActual: CriteriosSeleccionMarco,
    confirmadaActual: CriteriosSeleccionMarco,
    id: string,
  ): CriteriosSeleccionMarco {
    return {
      ...borradorActual,
      byVariable: {
        ...borradorActual.byVariable,
        [id]: confirmadaActual.byVariable?.[id],
      },
    };
  }

  it("devuelve ese criterio a lo confirmado y conserva el resto del borrador", () => {
    const next = descartarUno(borrador, confirmada, "modality");
    expect(next.byVariable?.modality?.categories).toEqual(["presencial"]);
    expect(next.byVariable?.session_type?.categories).toEqual(["teorico", "laboratorio"]);
  });
});
