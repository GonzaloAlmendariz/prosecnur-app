import type { Pregunta, Seccion } from "../../../../api/client";
import { RepeatBadge } from "../../../../components/RepeatBadge";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { TODAS_LAS_SECCIONES, apareceSeccion } from "./formularioModel";

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
  const porSeccion = new Map<string, number>();
  for (const p of preguntas) porSeccion.set(p.seccion, (porSeccion.get(p.seccion) ?? 0) + 1);
  const filas = [
    { name: TODAS_LAS_SECCIONES, label: "Todas las secciones", n: preguntas.length, aparece: null as string | null, repite: false },
    ...secciones.map((s) => ({ name: s.name, label: s.label || s.name, n: porSeccion.get(s.name) ?? 0, aparece: apareceSeccion(s, preguntas), repite: s.is_repeat })),
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
            title={s.name === TODAS_LAS_SECCIONES ? undefined : `${s.label} (${s.name})`}
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
