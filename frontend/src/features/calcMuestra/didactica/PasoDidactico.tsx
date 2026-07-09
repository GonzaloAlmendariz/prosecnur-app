/**
 * Piezas didácticas base del recorrido "Muestra de aulas". Se inyectan DENTRO
 * de la pestaña activa de cada sección (la navegación vive en el rail del
 * módulo y en las pestañas — aquí no se duplica jerarquía):
 *   - ContextoLlano: qué hacemos aquí y por qué, en 1-2 frases.
 *   - BadgeMotor: procedencia explícita de cada cifra.
 *   - TerminoGlosario: términos técnicos explicados inline.
 *   - RespaldoMetodologico: "para saber más" plegable con citas del corpus.
 */
import type { ReactNode } from "react";
import { BookOpenText, CheckCircle2, ChevronDown, CircleAlert, Compass, Loader2 } from "lucide-react";
import { TerminoChip } from "../universidad/ui/TerminoChip";
import { BADGE_COPY, pasoMeta, type PasoId } from "./didacticaCopy";
import { FUENTES, RESPALDOS } from "./referencia/corpus";

/** Franja compacta de contexto en lenguaje llano de la sección activa. */
export function ContextoLlano({ paso }: { paso: PasoId }) {
  const meta = pasoMeta(paso);
  return (
    <div className="cmv2-did-context" role="note">
      <span className="cmv2-did-context-icon" aria-hidden="true">
        <Compass size={12} />
      </span>
      <p>{meta.llano}</p>
    </div>
  );
}

/** Cita metodológica plegable ("para saber más") del paso, desde el corpus. */
export function RespaldoMetodologico({ paso }: { paso: PasoId }) {
  const meta = pasoMeta(paso);
  const respaldo = RESPALDOS.find((r) => r.pasoId === meta.respaldoId);
  if (!respaldo) return null;
  const fuentes = FUENTES.filter((f) => respaldo.fuenteIds.includes(f.id));
  return (
    <details className="cmv2-did-respaldo">
      <summary>
        <BookOpenText size={14} aria-hidden="true" />
        {respaldo.titulo}
        <ChevronDown size={14} className="cmv2-did-respaldo-chevron" aria-hidden="true" />
      </summary>
      <div className="cmv2-did-respaldo-body">
        {respaldo.parrafos.map((parrafo, i) => (
          <p key={i}>{parrafo}</p>
        ))}
        {fuentes.length > 0 && (
          <ul className="cmv2-did-fuentes">
            {fuentes.map((f) => (
              <li key={f.id} title={f.descripcion}>
                {f.titulo}
                {f.secciones ? ` · ${f.secciones}` : ""}
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

/**
 * Procedencia de una cifra. Regla del recorrido: ningún número se muestra como
 * definitivo sin el badge "motor R"; mientras el motor responde, la UI enseña
 * la vista previa etiquetada.
 */
export function BadgeMotor({ estado }: { estado: "validado" | "preview" | "error" }) {
  return (
    // key={estado}: remonta el badge al cambiar de estado para que el pop de
    // "validado" se dispare justo cuando el motor confirma la cifra.
    <span key={estado} className="cmv2-did-badge" data-estado={estado}>
      {estado === "validado" && <CheckCircle2 aria-hidden="true" />}
      {estado === "preview" && <Loader2 aria-hidden="true" className="cmv2-spin" />}
      {estado === "error" && <CircleAlert aria-hidden="true" />}
      {BADGE_COPY[estado]}
    </span>
  );
}

/**
 * Término del glosario inline: subrayado punteado + popover portalizado con la
 * explicación llana y la definición técnica (delegado en TerminoChip para que
 * todo el desk comparta un solo comportamiento de glosario).
 */
export function TerminoGlosario({ termino, children }: { termino: string; children?: ReactNode }) {
  return (
    <TerminoChip termino={termino} triggerClassName="cmv2-did-term">
      {children}
    </TerminoChip>
  );
}
