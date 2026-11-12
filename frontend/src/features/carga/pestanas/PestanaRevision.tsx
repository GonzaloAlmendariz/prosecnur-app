import type {
  CargaReviewPayload,
  CargaReviewSummaryPayload,
  ChoiceCodeMapReview,
} from "../../../api/client";
import { MesaDeRevision } from "./revision/MesaDeRevision";

export type PestanaRevisionProps = {
  ocupado: boolean;
  /** La revisión de la base elegida todavía no llega. */
  leyendo: boolean;
  revision: CargaReviewPayload | null;
  mapeoPendiente: boolean;
  /** La base revisada (con varias bases, la elegida) tiene formulario y respuestas. */
  tieneFormulario: boolean;
  tieneRespuestas: boolean;
  onRevisarMapeo: (mapeo: ChoiceCodeMapReview) => void;
  onLecturaUniverso: (base: string, leida: boolean) => void;
  /** Qué se vuelve a leer al aplicar el filtro de universo: cambia según la variante. */
  onUniversoAplicado: () => void;
  /** Guarda qué columnas fuera del formulario entran a la base (`POST /api/carga/review/reconciliation`). */
  onGuardarColumnas: (incluidas: string[]) => Promise<unknown>;
  varias: boolean;
  /** Varias bases: bases primarias (las hijas de grupo repetido no se revisan), base elegida y avance de todas. */
  basesPrimarias: string[];
  baseElegida: string;
  onCambiarBase: (nombre: string) => void;
  resumenDeBases: CargaReviewSummaryPayload | null;
  /** Filas de la base revisada, si el estudio las publica. */
  filasDeLaBase: number | null;
  /** Con la lectura hecha y sin pendientes se ofrece ir a Validación. */
  puedeContinuar: boolean;
};

/**
 * Revisión (ADR 0142, P4b R4): lo que bloquea o pide decisión en la base
 * elegida. Una sola composición para una y varias bases (`MesaDeRevision`).
 */
export function PestanaRevision(props: PestanaRevisionProps) {
  const { varias, basesPrimarias, baseElegida, mapeoPendiente, tieneRespuestas } = props;
  return (
    <MesaDeRevision
      revision={props.revision}
      leyendo={props.leyendo}
      ocupado={props.ocupado}
      tieneFormulario={props.tieneFormulario}
      tieneRespuestas={tieneRespuestas}
      mapeoPendiente={mapeoPendiente}
      filas={props.filasDeLaBase}
      varias={varias}
      basesPrimarias={basesPrimarias}
      baseElegida={baseElegida}
      onCambiarBase={props.onCambiarBase}
      resumenDeBases={props.resumenDeBases}
      puedeContinuar={props.puedeContinuar}
      // Las mismas condiciones con que se montaban el filtro de universo y la base preparada fuera.
      conDeclaraciones={varias ? Boolean(baseElegida) : tieneRespuestas && !mapeoPendiente}
      onLecturaUniverso={props.onLecturaUniverso}
      onUniversoAplicado={props.onUniversoAplicado}
      onRevisarMapeo={props.onRevisarMapeo}
      onGuardarColumnas={props.onGuardarColumnas}
    />
  );
}
