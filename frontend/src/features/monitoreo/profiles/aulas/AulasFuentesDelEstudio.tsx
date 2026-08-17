import { CheckCircle2, ExternalLink, Link2Off, CircleOff } from "../../../../vendor/lucide-react";
import type { MonitoreoSource } from "../../../../api/monitoreo";
import { enlaceDeFuente, nombreDeFuente, servicioDeFuente } from "../../fuentes/enlacesDeFuente";
import { textoDeActualizacion } from "../../fuentes/vocabulario";

/**
 * De dónde salen las respuestas de este estudio.
 *
 * Lo que había en Fuentes era una tabla de cuatro filas campo/valor —corrida,
 * marco, anónimas, generado— con dos celdas en blanco. Tres de esas cuatro ya
 * se leen mejor dos dedos más arriba: la corrida y el marco son tarjetas de
 * «Operación del plan» y el sello de generación es el «Corte» de la banda. La
 * tabla repetía, en la forma más pobre posible, lo que la sección ya decía.
 *
 * Y mientras tanto **la sección no listaba sus fuentes**: qué formulario se está
 * leyendo, en qué servicio vive y cuándo se leyó por última vez sólo aparecía
 * en el `title` de un botón. Es justo lo que Fuentes promete (C5), y lo que
 * acreditación y territorial ya muestran con estos mismos helpers.
 */

/** Qué aporta cada fuente al estudio, con el vocabulario del módulo. */
const PAPEL: Record<string, string> = {
  respuestas: "Respuestas de campo",
  universo: "Universo",
  barrido: "Barrido",
};

function Fuente({ source }: { source: MonitoreoSource }) {
  const enlace = enlaceDeFuente(source);
  const activa = source.enabled !== false;
  const papel = PAPEL[String(source.role ?? "")] ?? "Respuestas de campo";
  return (
    <article className={`aulas-fuente${activa ? "" : " es-apagada"}`}>
      <i aria-hidden="true">
        {activa ? <CheckCircle2 size={15} /> : <CircleOff size={15} />}
      </i>
      <div>
        {/* El nombre humano manda; el servicio y el papel van debajo. El
            identificador no sube al título: es el último recurso del helper. */}
        <p className="aulas-fuente-titulo">
          {nombreDeFuente(source)}
          <span>{activa ? "activa" : "apagada"}</span>
        </p>
        <p className="aulas-fuente-servicio">
          {servicioDeFuente(source)} · {papel}
        </p>
        <p className="aulas-fuente-sync">
          {enlace.estado === "enlace" ? (
            <a href={enlace.href} target="_blank" rel="noreferrer" title={enlace.titulo}>
              <ExternalLink size={12} aria-hidden="true" />
              {enlace.texto}
            </a>
          ) : (
            // El motivo por el que no hay enlace es un dato, no un hueco: sin él
            // la fila parecería incompleta sin decir de quién es la falta.
            <span className="aulas-fuente-sin-enlace">
              <Link2Off size={12} aria-hidden="true" />
              {enlace.mensaje}
            </span>
          )}
          <em>{textoDeActualizacion(source.last_sync_at)}</em>
        </p>
      </div>
    </article>
  );
}

export function AulasFuentesDelEstudio({ fuentes, anonimas }: {
  fuentes: ReadonlyArray<MonitoreoSource>;
  /** `anonymous_responses` del tablero: cómo se atribuye lo que llega. */
  anonimas: boolean;
}) {
  if (!fuentes.length) {
    return (
      <p className="mon-profile-muted">
        Este estudio todavía no tiene fuentes conectadas. Añade el formulario de
        aplicación en aulas para que el tablero lea las respuestas.
      </p>
    );
  }

  return (
    <div className="aulas-fuentes">
      <div className="aulas-fuentes-lista">
        {fuentes.map((source) => <Fuente key={source.id} source={source} />)}
      </div>
      {anonimas ? (
        // No es glosa de relleno: sale de `anonymous_responses` y es la regla
        // con la que se atribuye cada respuesta a un curso-horario. Quien mira
        // Fuentes necesita saberlo antes de leer cualquier conteo.
        <p className="aulas-fuentes-regla">
          Las respuestas llegan anónimas: el tablero las agrega por curso-horario,
          origen y enlace.
        </p>
      ) : null}
    </div>
  );
}
