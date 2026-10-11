// Tabla del panel «Cómo se emparejaron las preguntas» (ADR 0094, ítem 15).
//
// Una fila por pregunta, agrupada por sección en el orden del instrumento de la
// base: texto completo, la variable en la base, la variable en la fuente y el
// estado como insignia con ícono y texto.

import {
  ArrowRightLeft,
  Ban,
  Check,
  CircleHelp,
  CircleOff,
} from "../../vendor/lucide-react";
import type { EmparejamientoEstadoFila, EmparejamientoFila } from "../../api/cargaFuentes";
import {
  EMPAREJAMIENTO_ESTADOS,
  agruparPorSeccion,
  nombreDifiere,
} from "./fuentesEmparejamientoModel";

type IconoEstado = typeof Check;

export const ICONO_ESTADO: Record<EmparejamientoEstadoFila, IconoEstado> = {
  emparejada: Check,
  otro_nombre: ArrowRightLeft,
  no_entro: Ban,
  sin_respuesta: CircleOff,
  ambigua: CircleHelp,
};

export function EmparejamientoInsignia({ estado }: { estado: EmparejamientoEstadoFila }) {
  const Icono = ICONO_ESTADO[estado];
  return (
    <span className={`pulso-emparejamiento-insignia is-${estado}`}>
      <Icono size={12} aria-hidden="true" />
      <span>{EMPAREJAMIENTO_ESTADOS[estado].insignia}</span>
    </span>
  );
}

function ChipVariable({ nombre, distinto, ausente }: { nombre: string; distinto?: boolean; ausente: string }) {
  if (!nombre) {
    return (
      <span className="pulso-emparejamiento-var is-ausente">
        <span aria-hidden="true">—</span>
        <span className="pulso-sr-only">{ausente}</span>
      </span>
    );
  }
  return <code className={distinto ? "pulso-emparejamiento-var is-distinto" : "pulso-emparejamiento-var"}>{nombre}</code>;
}

function FilaEmparejamiento({ fila, enMatriz }: { fila: EmparejamientoFila; enMatriz: boolean }) {
  const distinto = nombreDifiere(fila);
  return (
    <tr className={`is-${fila.estado}${enMatriz ? " is-en-matriz" : ""}`}>
      <th scope="row" className="pulso-emparejamiento-pregunta" title={fila.etiqueta || undefined}>
        {fila.etiqueta || <span className="pulso-emparejamiento-sin-texto">Sin texto en el instrumento</span>}
      </th>
      <td>
        <ChipVariable nombre={fila.variable_base} ausente="No existe en la base" />
      </td>
      <td>
        <ChipVariable nombre={fila.variable_fuente} distinto={distinto} ausente="No existe en la fuente" />
      </td>
      <td>
        <EmparejamientoInsignia estado={fila.estado} />
      </td>
    </tr>
  );
}

export function FuentesEmparejamientoTabla({
  filas,
  fuenteNombre,
}: {
  filas: readonly EmparejamientoFila[];
  fuenteNombre: string;
}) {
  const grupos = agruparPorSeccion(filas);
  return (
    <table className="pulso-emparejamiento-tabla">
      <colgroup>
        <col className="pulso-emparejamiento-col-pregunta" />
        <col className="pulso-emparejamiento-col-var" />
        <col className="pulso-emparejamiento-col-var" />
        <col className="pulso-emparejamiento-col-estado" />
      </colgroup>
      <thead>
        <tr>
          <th scope="col">Pregunta</th>
          <th scope="col">En la base</th>
          <th scope="col" title={`En ${fuenteNombre}`}>En la fuente</th>
          <th scope="col">Estado</th>
        </tr>
      </thead>
      {grupos.map((grupo) => grupo.bloques.map((bloque, indiceBloque) => (
        // Un `tbody` por bloque: el de una matriz lleva su enunciado como
        // cabecera de grupo de filas, y el lector de pantalla lo asocia a cada
        // fila sin repetirlo en el texto visible.
        <tbody
          key={`${grupo.seccion}|${indiceBloque}`}
          className={bloque.enunciado ? "pulso-emparejamiento-matriz" : undefined}
        >
          {indiceBloque === 0 && (
            <tr className="pulso-emparejamiento-seccion">
              <th scope="colgroup" colSpan={4}>
                <span>{grupo.seccion}</span>
                <small>
                  {grupo.filas.length} {grupo.filas.length === 1 ? "pregunta" : "preguntas"}
                </small>
              </th>
            </tr>
          )}
          {bloque.enunciado && (
            <tr className="pulso-emparejamiento-enunciado">
              <th scope="rowgroup" colSpan={4} title={bloque.enunciado}>
                {bloque.enunciado}
              </th>
            </tr>
          )}
          {bloque.filas.map((fila, index) => (
            <FilaEmparejamiento
              key={`${fila.variable_base}|${fila.variable_fuente}|${index}`}
              fila={fila}
              enMatriz={Boolean(bloque.enunciado)}
            />
          ))}
        </tbody>
      )))}
    </table>
  );
}
