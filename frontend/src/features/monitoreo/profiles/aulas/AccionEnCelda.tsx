import type { CSSProperties } from "react";

/**
 * «Qué toca», con su urgencia a la vista (régimen 2026-09-02: el énfasis es
 * el control de horarios y el despliegue — y la columna que DICE la acción
 * del día iba en texto plano entre pills de colores).
 *
 * El color dice la familia de la acción, no repite la etiqueta:
 * - rojo de marca = levantar el teléfono HOY (llamar / volver a llamar);
 * - ámbar = decisión pendiente que envejece (cerrar fecha, confirmar si se
 *   aplicó);
 * - verde = ya está (aplicado);
 * - tenue = nada que hacer aquí (esperar, reserva, reemplazado, rechazado).
 *
 * La lista es cerrada pero NO traga: una acción que el mapa no reconozca se
 * pinta como texto plano, igual que EstadoEnCelda con un estado nuevo. Usa el
 * MISMO chip (`aulas-estado-chip`) para que las dos columnas de la tabla
 * hablen la misma geometría.
 */
const TONO_DE_ACCION = new Map<string, string>([
  ["Llamar al docente", "var(--pulso-module-monitoring)"],
  ["Volver a llamar", "var(--pulso-module-monitoring)"],
  ["Cerrar fecha", "var(--pulso-warn-fg)"],
  ["Confirmar si se aplicó", "var(--pulso-warn-fg)"],
  ["Aplicado", "var(--pulso-success-fg)"],
  ["Esperar al día", "var(--pulso-text-faint)"],
  ["En reserva", "var(--pulso-text-faint)"],
  ["Reemplazado", "var(--pulso-text-faint)"],
  ["Rechazado", "var(--pulso-text-faint)"],
]);

/** La columna de la acción; el carril de celdas de la tabla la reconoce. */
export const COLUMNA_DE_ACCION = "que_toca";

export function AccionEnCelda({ valor }: { valor: string }) {
  const tono = TONO_DE_ACCION.get(valor.trim());
  if (!tono) return <>{valor}</>;
  return (
    <span className="aulas-estado-chip" style={{ "--aulas-estado": tono } as CSSProperties}>
      {valor}
    </span>
  );
}
