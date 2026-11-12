/**
 * "Qué quieres revisar" (prototipo `panelRegla('tipo')`): los tipos de regla
 * propia en tres columnas, cada uno con su ícono, su nombre y un caso de
 * ejemplo, y debajo las sugeridas al mirar la base.
 *
 * - "Combinación fuera de catálogo" se ve deshabilitada con su causa (D-V2).
 * - Los tipos que ya no se crean (obligatoria, valores extremos, fuera de
 *   lista) solo aparecen si la regla que se edita es de ese tipo (D-F11).
 * - "Usar" en una sugerida abre la regla armada con ella.
 */
import { useId } from "react";
import { EstadoVacio } from "../../../../components/EstadoVacio";
import { Panel } from "../../../../components/Panel";
import { PulsoButton } from "../../../../components/PulsoButton";
import {
  Activity,
  ArrowRight,
  Asterisk,
  Calendar,
  CheckCircle2,
  Copy,
  GitCompare,
  Hash,
  Layers,
  List,
  ListChecks,
  ListOrdered,
  Sigma,
  Split,
  X,
  type LucideIcon,
} from "../../../../vendor/lucide-react";
import { formatoConteo } from "../../../../lib/formatoNumero";
import type { ReglaSemilla } from "../../types";
import { GRUPOS_DE_TIPOS, TIPO_PENDIENTE_CATALOGO, tiposDelGrupo } from "../tiposDeRegla";
import type { TipoReglaPropia } from "../tiposDelMotor";

/**
 * El texto de una sugerida viene del motor con comillas angulares y raya; se
 * muestra con la tipografía de la casa (comillas rectas, coma en vez de raya).
 */
export function textoDeLaCasa(texto: string): string {
  return texto.replace(/[\u00ab\u00bb]/g, '"').replace(/\s*[\u2013\u2014]\s*/g, ", ");
}

export const ICONO_DE_TIPO: Readonly<Record<TipoReglaPropia, LucideIcon>> = {
  rango_num: Hash,
  rango_fecha: Calendar,
  no_nulo: Asterisk,
  outliers_iqr: Activity,
  outliers_z: Sigma,
  fuera_catalogo: List,
  coherencia_2v: GitCompare,
  duplicados: Copy,
  condiciones: Split,
  select_multiple_hierarchy: ListChecks,
  select_multiple_exclusive: X,
  select_multiple_cardinality: ListOrdered,
  select_multiple_selection: CheckCircle2,
};

function Tesela({
  icono: Icono,
  rotulo,
  ejemplo,
  elegida = false,
  causa,
  onElegir,
}: {
  icono: LucideIcon;
  rotulo: string;
  ejemplo: string;
  elegida?: boolean;
  /** Sin `onElegir`, la tesela está deshabilitada y dice por qué. */
  causa?: string;
  onElegir?: () => void;
}) {
  const idCausa = useId();
  return (
    <li className="pulso-regla-tesela-celda">
      <Panel
        noPadding
        className="pulso-regla-tesela"
        data-qa-geometry-member=""
        data-elegida={elegida ? "" : undefined}
        data-deshabilitada={onElegir ? undefined : ""}
      >
        <button
          type="button"
          className="pulso-regla-tesela-boton"
          aria-pressed={onElegir ? elegida : undefined}
          aria-disabled={onElegir ? undefined : true}
          aria-describedby={causa ? idCausa : undefined}
          onClick={onElegir}
        >
          <span className="pulso-regla-tesela-icono" aria-hidden="true">
            <Icono size={16} />
          </span>
          <span className="pulso-regla-tesela-texto">
            <strong>{rotulo}</strong>
            <small>{ejemplo}</small>
            {causa ? (
              <em className="pulso-regla-tesela-causa" id={idCausa}>
                {causa}
              </em>
            ) : null}
          </span>
        </button>
      </Panel>
    </li>
  );
}

export function QueRevisar({
  tipoActual,
  tipoDeLaRegla,
  semillas,
  sinEvaluar = null,
  onVerSinEvaluar,
  onElegir,
  onUsarSemilla,
}: {
  /** El tipo que tiene hoy el borrador: su tesela va marcada. */
  tipoActual: TipoReglaPropia | null;
  /** El de la regla que se edita (para mostrar un tipo que ya no se crea). */
  tipoDeLaRegla: TipoReglaPropia | null;
  /** `null` al editar una regla: las sugeridas son para crear. */
  semillas: readonly ReglaSemilla[] | null;
  /** Reglas del formulario que la auditoría no puede evaluar (catálogo M3); `null` si no se sabe. */
  sinEvaluar?: number | null;
  onVerSinEvaluar?: () => void;
  onElegir: (tipo: TipoReglaPropia) => void;
  onUsarSemilla: (semilla: ReglaSemilla) => void;
}) {
  return (
    <div className="pulso-regla-que-revisar">
      <div className="pulso-regla-tipos" data-qa-geometry-group="validacion/regla-tipos" data-qa-geometry-contract="intrinsic">
        {GRUPOS_DE_TIPOS.map((grupo) => {
          const tipos = tiposDelGrupo(grupo.key, tipoDeLaRegla);
          const conPendiente = grupo.key === TIPO_PENDIENTE_CATALOGO.grupo;
          return (
            <section key={grupo.key} className="pulso-regla-tipos-grupo" aria-label={grupo.rotulo} data-qa-geometry-member="">
              <h4 className="pulso-regla-tipos-titulo">{grupo.rotulo}</h4>
              {/* "intrinsic": el ejemplo ocupa una o dos líneas y la tesela deshabilitada
                  suma su causa; el prototipo también tiene teselas de alto distinto. */}
              <ul className="pulso-regla-teselas" data-qa-geometry-group={`validacion/regla-tipos-${grupo.key}`} data-qa-geometry-contract="intrinsic">
                {tipos.map((t) => (
                  <Tesela
                    key={t.key}
                    icono={ICONO_DE_TIPO[t.key]}
                    rotulo={t.rotulo}
                    ejemplo={t.ejemploCorto}
                    elegida={t.key === tipoActual}
                    onElegir={() => onElegir(t.key)}
                  />
                ))}
                {conPendiente ? (
                  <Tesela
                    icono={Layers}
                    rotulo={TIPO_PENDIENTE_CATALOGO.rotulo}
                    ejemplo={TIPO_PENDIENTE_CATALOGO.ejemploCorto}
                    causa={TIPO_PENDIENTE_CATALOGO.causa}
                  />
                ) : null}
              </ul>
            </section>
          );
        })}
      </div>

      {semillas ? (
      <Panel
        noPadding
        className="pulso-regla-caja pulso-regla-sugeridas"
        aria-label="Sugeridas al mirar la base"
        title="Sugeridas al mirar la base"
        actions={<span className="pulso-regla-modo">Llegan armadas, con su conteo</span>}
      >
        {semillas.length || (sinEvaluar ?? 0) > 0 ? (
          <ul className="pulso-regla-sugeridas-lista" data-qa-geometry-group="validacion/regla-sugeridas" data-qa-geometry-contract="intrinsic">
            {semillas.map((s, i) => (
              <li key={`${s.nombre}-${i}`} className="pulso-regla-sugerida" data-qa-geometry-member="">
                <div className="pulso-regla-sugerida-texto">
                  <strong>{textoDeLaCasa(s.nombre)}</strong>
                  <span>{textoDeLaCasa(s.semilla.porque)}</span>
                </div>
                <PulsoButton variant="secondary" size="sm" aria-label={`Usar la sugerida ${s.nombre}`} onClick={() => onUsarSemilla(s)}>
                  <ArrowRight size={13} aria-hidden="true" />
                  Usar
                </PulsoButton>
              </li>
            ))}
            {sinEvaluar && sinEvaluar > 0 ? (
              <li className="pulso-regla-sugerida" data-qa-geometry-member="">
                <div className="pulso-regla-sugerida-texto">
                  <strong>
                    {formatoConteo(sinEvaluar)} {sinEvaluar === 1 ? "regla del formulario sin evaluar" : "reglas del formulario sin evaluar"}
                  </strong>
                  <span>Se pueden rehacer como reglas propias.</span>
                </div>
                {onVerSinEvaluar ? (
                  <PulsoButton variant="secondary" size="sm" aria-label="Ver las reglas del formulario sin evaluar" onClick={onVerSinEvaluar}>
                    <ArrowRight size={13} aria-hidden="true" />
                    Ver
                  </PulsoButton>
                ) : null}
              </li>
            ) : null}
          </ul>
        ) : (
          <EstadoVacio tamano="compacto" icono={<ListChecks size={18} />} titulo="Sin sugerencias para esta base" />
        )}
      </Panel>
      ) : null}
    </div>
  );
}
