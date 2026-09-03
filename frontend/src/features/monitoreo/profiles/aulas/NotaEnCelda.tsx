import { MessageSquareText } from "../../../../vendor/lucide-react";

import "./notaEnCelda.css";

/**
 * La observación de una fila, plegada en un botón que no ocupa espacio.
 *
 * Dictado de Gonzalo (2026-09-02, B42): «por un lado hay observaciones de la
 * agendación, por otro las de la aplicación de aulas y por otro el control de
 * las respuestas abiertas… sí o sí tiene que hacerse [la distinción]… un
 * pequeño botón como un textbox chiquito, donde si le das clic puedes ver qué
 * se comenta de ese curso-horario, pero que no ocupe demasiado espacio».
 *
 * Cada familia llega por SU columna —`replacement_note` es lo anotado al
 * agendar (el nombre del campo es heredado del libro) y `field_note` lo que
 * reportó el aplicador— así que el peek nace distinguido: el rótulo de la
 * columna y el encabezado de la nota dicen la familia. Las respuestas
 * abiertas de plataforma no pasan por aquí: tienen su pestaña propia.
 *
 * Es un `<details>` y no un popover: la nota se expande EN la fila (la tabla
 * vive en un contenedor con scroll propio que recortaría cualquier burbuja
 * flotante) y se pliega con otro click, sin estado que administrar.
 */

/** Columna de nota → la familia que el encabezado del peek declara. */
export const COLUMNAS_DE_NOTA = new Map<string, string>([
  ["replacement_note", "agendación"],
  ["field_note", "aplicación"],
]);

export function NotaEnCelda({ texto, origen }: { texto: string; origen: string }) {
  const limpio = texto.trim();
  // Sin nota no hay botón: cien iconos muertos no son acceso (el mismo
  // criterio que las celdas vacías de la malla).
  if (!limpio) return null;
  return (
    <details className="aulas-nota-peek">
      <summary
        aria-label={`Ver la observación de ${origen}`}
        title={`Observación de ${origen} — click para leerla`}
      >
        <MessageSquareText size={13} aria-hidden="true" />
      </summary>
      <span className="aulas-nota-texto">
        <strong>{origen}</strong>
        {limpio}
      </span>
    </details>
  );
}
