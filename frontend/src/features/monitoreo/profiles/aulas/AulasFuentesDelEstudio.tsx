import { CheckCircle2, ExternalLink, Link2Off, CircleOff } from "../../../../vendor/lucide-react";
import type { MonitoreoSource } from "../../../../api/monitoreo";
import { enlaceDeFuente, nombreDeFuente, servicioDeFuente } from "../../fuentes/enlacesDeFuente";
import { textoDeActualizacion, textoDeImportacion } from "../../fuentes/vocabulario";

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

export type ReciboDelLibro = {
  importado_en: string;
  hojas: Array<{ hoja: string; vino: boolean }>;
  hojas_ausentes: number;
  control_sin_nombre: number;
  resumen?: { unidades?: number; titulares?: number; partes_de_campo?: number; filas_de_control?: number };
};

/**
 * El libro del operativo, que es la OTRA fuente de este estudio.
 *
 * Las respuestas llegan de Kobo; el plan, el parte de campo y el control de
 * calidad llegan del Excel que el equipo llena. Fuentes listaba sólo lo primero.
 *
 * Qué hojas trajo el libro se decía en un aviso al importar y desaparecía al
 * recargar: el dato vivía en la sesión y no lo leía nadie. Un estudio se opera
 * durante semanas, y quien lo abre el martes tiene que poder saber de dónde
 * salen las cifras que está mirando sin haber estado el lunes.
 */
function LibroDelOperativo({ recibo }: { recibo: ReciboDelLibro }) {
  const cuando = textoDeImportacion(recibo.importado_en);
  return (
    <article className="aulas-fuente aulas-fuente-libro">
      <i aria-hidden="true">
        {recibo.hojas_ausentes ? <CircleOff size={15} /> : <CheckCircle2 size={15} />}
      </i>
      <div>
        <p className="aulas-fuente-titulo">
          Libro del operativo
          {/* La conformidad se declara UNA vez y con su denominador; repetir
              «leída» en cada hoja era tres veces la misma palabra. Lo que sí se
              marca hoja por hoja es la que falta, que es lo que cambia algo. */}
          <span>{recibo.hojas.length - recibo.hojas_ausentes} de {recibo.hojas.length} hojas</span>
        </p>
        {/* Se nombran las tres, vinieran o no: saber cuál falta es el dato, y
            un renglón de servicio encima repetiría los mismos tres nombres. */}
        <ul className="aulas-libro-hojas">
          {recibo.hojas.map((h) => (
            <li key={h.hoja} className={h.vino ? "es-vino" : "es-falta"}>
              {h.hoja}
              {h.vino ? null : <span>no vino</span>}
            </li>
          ))}
        </ul>
        <p className="aulas-fuente-sync">
          <em>{cuando}</em>
          {recibo.control_sin_nombre ? (
            // Ya hay un control en Validación que lo avisa; aquí va el número
            // porque es una propiedad del libro, no del estudio.
            <em> · {recibo.control_sin_nombre} columnas sin nombre en la hoja</em>
          ) : null}
        </p>
      </div>
    </article>
  );
}

export function AulasFuentesDelEstudio({ fuentes, anonimas, libro }: {
  fuentes: ReadonlyArray<MonitoreoSource>;
  /** `anonymous_responses` del tablero: cómo se atribuye lo que llega. */
  anonimas: boolean;
  /** El recibo de la importación, o `null` si nunca se importó un libro. */
  libro?: ReciboDelLibro | null;
}) {
  if (!fuentes.length && !libro) {
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
        {/* Después de las fuentes de respuestas: primero de dónde llega lo que
            se cuenta, y luego de dónde llega con qué se compara. */}
        {libro ? <LibroDelOperativo recibo={libro} /> : null}
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
