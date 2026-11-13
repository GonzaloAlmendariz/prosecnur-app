/**
 * "Duplicar" una regla propia: abre el panel con una regla nueva ya llenada
 * con lo de la original, para cambiar solo lo que difiere (una pregunta de
 * diez pares parecidos). Viaja por la misma vía que una sugerida que se usa
 * (`semillaInicial`), pero no se guarda como sugerida: la marca de origen se
 * descarta al abrir el borrador.
 */
import type { ReglaCustom, ReglaSemilla } from "../types";

/** El origen con que la copia llega al panel; `borradorInicial` lo reconoce y no la trata como sugerida. */
export const ORIGEN_COPIA = "copia";

function clonar<T>(valor: T): T {
  return JSON.parse(JSON.stringify(valor)) as T;
}

export function copiaParaDuplicar(regla: ReglaCustom): ReglaSemilla {
  const { id: _id, created_at: _creada, origen: _origen, semilla: _semilla, ...resto } = regla;
  return {
    ...clonar(resto),
    activa: true,
    // Sin nombre, la copia se nombra sola con sus preguntas cuando cambien.
    nombre: "",
    // Un detalle igual al nombre no lo escribió nadie: la copia no lo arrastra.
    mensaje: regla.mensaje === regla.nombre ? "" : regla.mensaje,
    semilla: { origen: ORIGEN_COPIA, porque: `Copia de ${regla.nombre}` },
  };
}
