import type { Pregunta, Seccion } from "../../../../api/client";
import { RepeatBadge } from "../../../../components/RepeatBadge";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { SIN_SECCION, TODAS_LAS_SECCIONES, apareceSeccion, conteoPorSeccion, rotuloDeSeccion, seccionesVisibles } from "./formularioModel";

/**
 * Las secciones del formulario (prototipo "carga-formulario", columna
 * izquierda): nombre, cuántas preguntas tiene y cuándo aparece, en palabras.
 * La primera fila junta todas las secciones, para buscar en el formulario entero.
 */
export function ListaDeSecciones({
  secciones,
  preguntas,
  elegida,
  onElegir,
  idTabla,
}: {
  secciones: readonly Seccion[];
  preguntas: readonly Pregunta[];
  elegida: string;
  onElegir: (seccion: string) => void;
  idTabla: string;
}) {
  // Las cifras cuentan preguntas con la misma definición que la cabecera (sin cálculos ni notas), y la
  // suma de las secciones, "Sin sección" incluida, es la de "Todas las secciones".
  const visibles = seccionesVisibles(secciones, preguntas);
  const conteo = conteoPorSeccion(visibles, preguntas);
  const filas = [
    { name: TODAS_LAS_SECCIONES, label: "Todas las secciones", n: conteo.get(TODAS_LAS_SECCIONES) ?? 0, aparece: null as string | null, repite: false },
    ...visibles.map((s) => ({
      name: s.name,
      label: rotuloDeSeccion(s),
      n: conteo.get(s.name) ?? 0,
      aparece: s.name === SIN_SECCION ? null : apareceSeccion(s, preguntas),
      repite: s.is_repeat,
    })),
  ];
  return (
    <ul
      className="pulso-formulario-secciones"
      aria-label="Secciones del formulario"
      data-qa-geometry-group="carga/formulario-secciones"
      data-qa-geometry-contract="intrinsic"
    >
      {filas.map((s) => (
        <li key={s.name}>
          <button
            type="button"
            className="pulso-formulario-seccion"
            aria-pressed={elegida === s.name}
            aria-controls={idTabla}
            onClick={() => onElegir(s.name)}
            title={s.name === TODAS_LAS_SECCIONES || s.name === SIN_SECCION ? undefined : `${s.label} (${s.name})`}
          >
            <span className="pulso-formulario-seccion-texto">
              <b>{s.label}</b>
              {s.aparece ? <span>{s.aparece}</span> : null}
            </span>
            <span className="pulso-formulario-seccion-n">
              {s.repite ? <RepeatBadge compact /> : null}
              <em>{formatoConteo(s.n)}</em>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
