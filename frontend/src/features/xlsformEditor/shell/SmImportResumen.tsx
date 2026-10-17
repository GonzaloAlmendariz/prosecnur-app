import { AlertTriangle, Info } from "../../../vendor/lucide-react";
import type { XlsformFormSource, XlsformFueraDelFormularioItem } from "../../../api/multiIntegrado";
import { XlsformTransferNotice } from "./XlsformTransferNotice";
import { SmConteo } from "./SmConteo";
import { SmDetallesTecnicos } from "./SmDetallesTecnicos";
import { textoSaltosSm, textoSeccionesSm } from "./smImportModel";
import "../styles/xfSmImport";

// Resumen antes de crear el borrador. Dice lo que se va a crear con el mismo
// par de conteos del resto del diálogo (U8), no promete saltos que no hay
// (U7) y deja lo técnico plegado (U6). C1: `xlsform-import-sm-resumen`,
// `intrinsic` —filas de distinta naturaleza, cada una mide lo que su dato—.
export function FinalImportReviewModal({
  surveyId,
  surveyTitle,
  sectionCount,
  questionCount,
  fieldCount,
  visualRuleCount,
  advancedRuleCount,
  overrideCount,
  pendingSuggestionCount = 0,
  fueraDelFormulario,
  definitionSha256,
  translationProfile,
  checked,
  submitting,
  onCheckedChange,
  onCancel,
  onConfirm,
}: {
  surveyId: string;
  surveyTitle?: string | null;
  sectionCount: number;
  questionCount: number;
  fieldCount: number;
  visualRuleCount: number;
  advancedRuleCount: number;
  overrideCount: number;
  pendingSuggestionCount?: number;
  /** Lo que la encuesta trae y no entra al formulario (H9), si se conoce. */
  fueraDelFormulario?: readonly XlsformFueraDelFormularioItem[] | null;
  definitionSha256?: string | null;
  translationProfile?: string | null;
  checked: boolean;
  submitting: boolean;
  onCheckedChange: (value: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const totalRules = visualRuleCount + advancedRuleCount;
  const sinSaltos = totalRules === 0;
  const creara = sinSaltos
    ? "Se creará un formulario nuevo y editable con sus secciones, preguntas, opciones, obligatoriedad y validaciones. Llega sin saltos."
    : `Se creará un formulario nuevo y editable con sus secciones, preguntas, opciones, obligatoriedad, validaciones y ${textoSaltosSm(totalRules, 0)}.`;
  return (
    <section className="pulso-xf-sm-review" aria-labelledby="sm-final-review-title">
      <header>
        <h3 id="sm-final-review-title" className="pulso-xf-sm-review-heading">
          Resumen antes de crear el borrador
        </h3>
        <p className="pulso-xf-sm-review-copy">{creara}</p>
      </header>
      <dl
        className="pulso-xf-smi-resumen"
        data-qa-geometry-group="xlsform-import-sm-resumen"
        data-qa-geometry-contract="intrinsic"
      >
        <div data-qa-geometry-member="">
          <dt>Encuesta</dt>
          <dd>
            <strong>{surveyTitle?.trim() || "Encuesta de SurveyMonkey"}</strong>
            {surveyId ? <small>ID {surveyId}</small> : null}
          </dd>
        </div>
        <div data-qa-geometry-member="">
          <dt>Contenido</dt>
          <dd>
            <strong>{textoSeccionesSm(sectionCount)}</strong>
            <SmConteo preguntas={questionCount} campos={fieldCount} ayuda="visible" />
          </dd>
        </div>
        <div data-qa-geometry-member="" className={sinSaltos ? "is-alerta" : undefined}>
          <dt>Saltos</dt>
          <dd>
            <strong>
              {sinSaltos ? <AlertTriangle size={13} aria-hidden /> : null}
              {textoSaltosSm(totalRules, pendingSuggestionCount)}
            </strong>
            {totalRules > 0 && advancedRuleCount > 0 ? (
              <small>
                {visualRuleCount} desde la lógica visual · {advancedRuleCount} traducidos de reglas pegadas
              </small>
            ) : null}
          </dd>
        </div>
        {overrideCount > 0 ? (
          <div data-qa-geometry-member="">
            <dt>Opciones reordenadas</dt>
            <dd>
              <strong>{overrideCount} {overrideCount === 1 ? "pregunta" : "preguntas"}</strong>
            </dd>
          </div>
        ) : null}
      </dl>
      <SmFueraDelFormulario items={fueraDelFormulario} />
      <SmDetallesTecnicos
        surveyId={surveyId}
        definitionSha256={definitionSha256}
        translationProfile={translationProfile}
      />
      <XlsformTransferNotice />
      <label className="pulso-xf-sm-review-check">
        <input
          type="checkbox"
          autoFocus
          checked={checked}
          disabled={submitting}
          onChange={(event) => onCheckedChange(event.target.checked)}
        />
        <span>Revisé este resumen y quiero crear el borrador.</span>
      </label>
      <footer className="pulso-xf-smi-acciones">
        <button type="button" onClick={onCancel} disabled={submitting}>
          Volver a revisar
        </button>
        <button
          type="button"
          className="pulso-primary"
          onClick={onConfirm}
          disabled={!checked || submitting}
        >
          {submitting ? "Creando borrador…" : "Crear borrador"}
        </button>
      </footer>
    </section>
  );
}

/** Lo que no entra al formulario, de la procedencia de un import SM (H9). */
export function fueraDelFormularioDe(
  source: XlsformFormSource | null | undefined,
): XlsformFueraDelFormularioItem[] {
  return source?.fuera_del_formulario ?? [];
}

/**
 * «No entra al formulario»: cada elemento de la encuesta que el formulario no
 * importa, dicho con su causa (variables personalizadas que llegan como
 * columna de metadato, imágenes). No pinta nada si la lista está vacía.
 */
export function SmFueraDelFormulario({
  items,
}: {
  items: readonly XlsformFueraDelFormularioItem[] | null | undefined;
}) {
  if (!items?.length) return null;
  return (
    <section className="pulso-xf-smi-fuera" aria-labelledby="sm-fuera-del-formulario">
      <h4 id="sm-fuera-del-formulario">
        <Info size={13} aria-hidden="true" />
        No entra al formulario
      </h4>
      <ul>
        {items.map((item, i) => (
          <li key={`${item.tipo}-${item.nombre}-${i}`}>{item.detalle}</li>
        ))}
      </ul>
    </section>
  );
}
