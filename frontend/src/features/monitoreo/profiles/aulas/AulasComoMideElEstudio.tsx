import { useState } from "react";

import { fmt } from "./kpisDeAulas";
import { Check } from "../../../../vendor/lucide-react";

import "./aulasComoMide.css";

/**
 * **Las tres decisiones que gobiernan lo que el tablero significa.**
 *
 * Contra qué se mide la cuota, por qué dimensión se resume el operativo y desde
 * cuándo lo recogido es campo. Las tres existían en el motor y **sólo se podían
 * poner por API**, así que cambiar cualquiera de ellas exigía a alguien que
 * supiera escribir un `POST` — y el estudio ya en marcha no podía tocar su
 * propia definición. Una capacidad sin superficie es media capacidad.
 *
 * Van en Fuentes por lo mismo que el criterio de efectiva: es la sección que
 * promete decir de dónde salen las respuestas, y **de qué se cuentan** es parte
 * de eso.
 *
 * Tres decisiones de forma, cada una con su porqué:
 *
 * - **Las opciones salen del catálogo del motor** (`ejes_declarables`), no de
 *   una lista escrita aquí. Añadir una cuarta dimensión es una entrada en
 *   `monitoreo_aulas_eje.R` y esta pantalla la hereda; copiarla obligaría a
 *   acordarse de dos sitios.
 * - **El eje de cuotas se confirma, no se conmuta.** Cambiarlo re-teclea el
 *   numerador de todos los grupos, así que pide un segundo gesto y dice lo que
 *   implica antes de pedirlo. Las otras dos se guardan al elegir: una agrupa
 *   una tabla y la otra mueve una frontera de fechas.
 * - **Un eje que necesita padrón y no lo tiene se ofrece DESHABILITADO, con la
 *   razón.** Elegirlo a ciegas manda todas las respuestas a «sin nivel» y deja
 *   el avance en cero con el aviso culpando al padrón; es exactamente el fallo
 *   mudo que este perfil ya sufrió.
 */

export type DimensionDeclarable = {
  clave: string;
  etiqueta: string;
  etiqueta_plural: string;
  columna: string;
  atribucion: string;
  fuente_valor: string;
  requiere_padron: boolean;
};

export type ComoMideElEstudio = {
  /** El eje de cuotas vigente. Vacío = `facultad`, el de siempre. */
  eje: string;
  /** Por qué se eligió, tal como lo declaró quien lo eligió. */
  ejeMotivo: string;
  /** La dimensión por la que agrupa el resumen operativo. */
  agrupacion: string;
  /** El día que arrancó el campo, ISO. Vacío = no se descarta nada por fecha. */
  inicioCampo: string;
};

/** Cuántas personas tiene el padrón cargado, para saber si el eje por persona es viable. */
export type ReciboDelPadron = { personas: number; sinNivel?: number };

const DEFECTO = "facultad";

export function AulasComoMideElEstudio({
  valores, dimensiones, padron, fueraDelOperativo = null, guardando = false, onGuardar = null,
}: {
  valores: ComoMideElEstudio;
  /** El catálogo del motor. Vacío: no se ofrece nada, no se inventan opciones. */
  dimensiones: ReadonlyArray<DimensionDeclarable>;
  padron: ReciboDelPadron;
  /**
   * Cuántas respuestas están hoy fuera del operativo, para que la fecha diga
   * qué hace en vez de sólo aceptarse. `null` mientras no haya tablero.
   */
  fueraDelOperativo?: number | null;
  guardando?: boolean;
  /** `null` = sólo lectura: se enseña lo declarado y no se toca. */
  onGuardar?: ((cambio: Partial<ComoMideElEstudio>) => void) | null;
}) {
  const [ejePropuesto, setEjePropuesto] = useState<string | null>(null);

  const ejeActual = valores.eje || DEFECTO;
  const agrupacionActual = valores.agrupacion || DEFECTO;
  const hayPadron = padron.personas > 0;
  // Sólo puede agrupar el resumen lo que vive en la fila del PLAN: este bloque
  // cuenta cursos-horario, y por nivel publicaría el nivel modal de cada uno
  // que promete el de cada quien. El motor lo degrada; aquí ni se ofrece.
  const agrupables = dimensiones.filter((d) => d.atribucion === "aula");

  const etiquetaDe = (clave: string) =>
    dimensiones.find((d) => d.clave === clave)?.etiqueta ?? clave;

  const bloqueada = (d: DimensionDeclarable) => d.requiere_padron && !hayPadron;

  return (
    <div className="aulas-como-mide">
      <div className="aulas-como-mide-campo">
        <span className="aulas-como-mide-rotulo">Contra qué se mide la cuota</span>
        <p className="aulas-como-mide-nota">
          Decide de qué es cada grupo del avance. Con una dimensión que se
          resuelve por persona, el valor de cada respuesta sale de su código
          cruzado contra el padrón, no del curso-horario donde se recogió.
        </p>
        <div className="aulas-como-mide-chips">
          {dimensiones.length === 0 ? (
            <em className="aulas-como-mide-vacio">
              El motor todavía no publica las dimensiones disponibles.
            </em>
          ) : dimensiones.map((d) => {
            const puesta = d.clave === ejeActual;
            const veto = bloqueada(d);
            return (
              <button
                key={d.clave}
                type="button"
                className="aulas-sexo-chip aulas-como-mide-chip"
                aria-pressed={puesta}
                disabled={!onGuardar || guardando || veto || puesta}
                onClick={() => setEjePropuesto(d.clave)}
                title={veto
                  ? `«${d.etiqueta}» se resuelve por el código del alumno y no hay padrón cargado: todas las respuestas quedarían sin valor.`
                  : puesta ? "Es el eje vigente" : `Medir la cuota por ${d.etiqueta.toLocaleLowerCase("es")}`}
              >
                {puesta ? <Check size={13} aria-hidden="true" /> : null}
                {d.etiqueta}
                {veto ? <em> · sin padrón</em> : null}
              </button>
            );
          })}
        </div>
        {/* **La razón, visible y no sólo en el `title`.** El chip apagado con un
            «· sin padrón» dice QUÉ pasa; quien no pase el ratón por encima no se
            entera de por qué ni de qué hacer, y es justo la dimensión que ese
            estudio querría elegir. Un tooltip no es una explicación. */}
        {dimensiones.some((d) => bloqueada(d)) ? (
          <p className="aulas-como-mide-nota">
            {dimensiones.filter((d) => bloqueada(d)).map((d) => d.etiqueta).join(", ")}
            {dimensiones.filter((d) => bloqueada(d)).length === 1 ? " se resuelve" : " se resuelven"}
            {" "}por el código del alumno y no hay padrón cargado: cárgalo en esta
            misma sección y quedará disponible.
          </p>
        ) : null}
        {valores.ejeMotivo ? (
          <p className="aulas-como-mide-motivo">{valores.ejeMotivo}</p>
        ) : null}
        {/* **El segundo gesto.** Cambiar el eje re-teclea el numerador de todas
            los grupos, y la frase dice qué implica ANTES de confirmarlo: con un
            eje por persona, una respuesta sin código no cae en ninguno. */}
        {ejePropuesto && ejePropuesto !== ejeActual ? (
          <div className="aulas-como-mide-confirmar" role="group">
            <span>
              Pasar a <strong>{etiquetaDe(ejePropuesto)}</strong> recalcula todos los
              grupos del avance
              {dimensiones.find((d) => d.clave === ejePropuesto)?.requiere_padron
                ? `, y las respuestas cuya persona no resuelva contra el padrón (${fmt(padron.personas)} cargadas) dejarán de contar.`
                : ` con el valor que trae la fila del plan.`}
            </span>
            <button type="button" className="pulso-button pulso-button--sm pulso-button--primary" disabled={guardando}
              onClick={() => { onGuardar?.({ eje: ejePropuesto }); setEjePropuesto(null); }}>
              Cambiar el eje
            </button>
            <button type="button" className="pulso-button pulso-button--sm pulso-button--secondary" disabled={guardando}
              onClick={() => setEjePropuesto(null)}>
              Dejarlo como está
            </button>
          </div>
        ) : null}
      </div>

      <div className="aulas-como-mide-campo">
        <span className="aulas-como-mide-rotulo">Cómo se agrupa el resumen de Avance</span>
        <p className="aulas-como-mide-nota">
          No es la cuota: es la tabla que cuenta cursos-horario planificados y
          aplicados. Un estudio que vive dentro de una facultad la deja en una
          sola fila, y por carrera dice dónde está el trabajo.
        </p>
        <div className="aulas-como-mide-chips">
          {agrupables.map((d) => (
            <button
              key={d.clave}
              type="button"
              className="aulas-sexo-chip aulas-como-mide-chip"
              aria-pressed={d.clave === agrupacionActual}
              disabled={!onGuardar || guardando || d.clave === agrupacionActual}
              onClick={() => onGuardar?.({ agrupacion: d.clave })}
              title={`Agrupar el resumen por ${d.etiqueta.toLocaleLowerCase("es")}`}
            >
              {d.clave === agrupacionActual ? <Check size={13} aria-hidden="true" /> : null}
              {d.etiqueta}
            </button>
          ))}
        </div>
      </div>

      <div className="aulas-como-mide-campo">
        <span className="aulas-como-mide-rotulo">Desde cuándo esto es campo</span>
        <p className="aulas-como-mide-nota">
          Lo recogido antes de esa fecha es ensayo —capacitación, pruebas del
          enlace— y sale por «Fuera del operativo». Hace falta porque los
          descartes de arriba casan valores del colector, y una prueba abierta
          con el enlace del formulario no trae ninguno.
        </p>
        <div className="aulas-como-mide-fecha">
          <input
            type="date"
            value={valores.inicioCampo}
            disabled={!onGuardar || guardando}
            aria-label="Día en que arrancó la recolección"
            onChange={(e) => onGuardar?.({ inicioCampo: e.target.value })}
          />
          {valores.inicioCampo ? (
            <button type="button" className="pulso-button pulso-button--sm pulso-button--secondary" disabled={guardando}
              onClick={() => onGuardar?.({ inicioCampo: "" })}>
              Quitar la fecha
            </button>
          ) : null}
        </div>
        <p className="aulas-como-mide-nota">
          {valores.inicioCampo
            ? (fueraDelOperativo != null && fueraDelOperativo > 0
              ? `Hoy hay ${fmt(fueraDelOperativo)} respuestas fuera del operativo, entre las anteriores a esa fecha y los colectores descartados.`
              : "Ninguna respuesta queda fuera por esta fecha.")
            : "Sin fecha no se descarta nada por cuándo se recogió."}
        </p>
      </div>
    </div>
  );
}
