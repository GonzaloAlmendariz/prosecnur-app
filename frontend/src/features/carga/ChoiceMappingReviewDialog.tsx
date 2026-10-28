import { ArrowRightLeft, Info, ShieldCheck } from "../../vendor/lucide-react";
import type { ChoiceCodeMap, ChoiceCodeMapReview } from "../../api/xlsformEditor";
import { Dialog } from "../../components/Dialog";
import { PulsoButton } from "../../components/PulsoButton";

// Revisión del mapeo de códigos de respuesta (Carga). Monta el Dialog del kit
// (L1): Escape, foco atrapado y de vuelta vienen de la primitiva; antes no
// cerraba con Escape. Mientras se aplica (`busy`) no se puede cerrar. Salió de
// CargaPage.tsx, que pasa de 2.700 líneas.

function normalizedChoiceCode(value: string): string {
  return String(value ?? "").replace(/^0+([0-9]+)$/, "$1");
}

export function choiceMapChangedItems(map: ChoiceCodeMap) {
  return map.mappings.filter((item) => normalizedChoiceCode(item.source_code) !== normalizedChoiceCode(item.xls_code));
}

export function ChoiceMappingReviewDialog({
  review,
  busy,
  onClose,
  onConfirm,
}: {
  review: ChoiceCodeMapReview;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const needsConfirmation = review.requires_confirmation;
  const changedCounts = review.maps.map((map) => choiceMapChangedItems(map).length);
  const totalChangedOptions = changedCounts.reduce((sum, count) => sum + count, 0);
  const allHighConfidence = review.maps.every((map) => map.high_confidence);
  return (
    <Dialog
      open
      onOpenChange={(abierto) => { if (!abierto) onClose(); }}
      dismissible={!busy}
      size="lg"
      title="Usar mapeo recomendado"
      subtitle="Preparación de respuestas"
      icon={needsConfirmation ? <ArrowRightLeft size={16} aria-hidden="true" /> : <ShieldCheck size={16} aria-hidden="true" />}
      flush
      footer={(
        <>
          <PulsoButton variant="secondary" size="md" onClick={onClose} disabled={busy}>
            Cerrar y revisar luego
          </PulsoButton>
          {needsConfirmation && (
            <PulsoButton variant="primary" size="md" onClick={() => void onConfirm()} disabled={busy}>
              <ShieldCheck size={15} aria-hidden="true" />
              Usar este mapeo
            </PulsoButton>
          )}
        </>
      )}
    >
      <div className="pulso-choice-map-explain">
        <Info size={16} />
        <p>
          Pulso detectó diferencias entre los códigos de origen y los valores finales del formulario. Las
          etiquetas coinciden, pero algunos códigos no. Al confirmar, las respuestas se ajustan hacia el
          formulario y las reglas usan ese mismo puente para interpretar C1, C2, C3.
        </p>
      </div>

      <div className="pulso-choice-map-summary">
        <div>
          <span>Preguntas afectadas</span>
          <strong>{review.maps.length}</strong>
        </div>
        <div>
          <span>Opciones ajustadas</span>
          <strong>{totalChangedOptions}</strong>
        </div>
        <div>
          <span>Confianza</span>
          <strong>{allHighConfidence ? "Alta" : "Requiere revisión"}</strong>
        </div>
      </div>

      <p className="pulso-choice-map-guidance">
        Revisa solo si algo te llama la atención. Si las etiquetas son las correctas, la acción esperada es usar el mapeo recomendado.
      </p>

      <div className="pulso-choice-map-list" data-qa-geometry-capacity="owned">
        {review.maps.map((map, index) => (
          <ChoiceMappingCard
            key={`${map.variable}-${map.list_name}`}
            map={map}
            defaultOpen={!map.high_confidence || index === 0}
          />
        ))}
      </div>
    </Dialog>
  );
}

function ChoiceMappingCard({ map, defaultOpen }: { map: ChoiceCodeMap; defaultOpen?: boolean }) {
  const changedRows = choiceMapChangedItems(map);
  const visibleRows = changedRows.length > 0 ? changedRows : map.mappings.slice(0, 4);
  const unchangedRows = Math.max(0, map.mappings.length - changedRows.length);
  return (
    <details className="pulso-choice-map-card" open={defaultOpen}>
      <summary className="pulso-choice-map-card-head">
        <div>
          <h3>
            <code>{map.variable}</code> {map.label}
          </h3>
          <p>
            {changedRows.length} ajuste(s) de código · {map.type === "select_multiple" ? "selección múltiple" : "selección única"} · lista <code>{map.list_name}</code>
          </p>
        </div>
        <span className={`pulso-choice-map-confidence${map.high_confidence ? " is-high" : " is-review"}`}>
          {map.high_confidence ? "Alta confianza" : "Revisar"}
        </span>
      </summary>

      <div className="pulso-choice-map-table" role="table" aria-label={`Mapeo de ${map.variable}`}>
        <div className="pulso-choice-map-row is-head" role="row">
          <span role="columnheader">Código origen SM/SAV</span>
          <span role="columnheader">Etiqueta detectada</span>
          <span role="columnheader">Valor final del formulario</span>
        </div>
        {visibleRows.map((item, idx) => (
          <div className="pulso-choice-map-row" role="row" key={`${item.source_code}-${item.xls_code}-${idx}`}>
            <span role="cell">
              <code>C{item.source_code}</code>
            </span>
            <span role="cell">
              {item.source_label || item.xls_label}
            </span>
            <span role="cell">
              <code>{item.xls_code}</code>
              {item.xls_label && <em>{item.xls_label}</em>}
            </span>
          </div>
        ))}
      </div>

      {unchangedRows > 0 && (
        <p className="pulso-choice-map-more">
          {unchangedRows} opción(es) ya coincidían o no necesitaban cambio.
        </p>
      )}
    </details>
  );
}
