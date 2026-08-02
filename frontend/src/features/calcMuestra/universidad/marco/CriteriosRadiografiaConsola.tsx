import { useEffect, useMemo, useState } from "react";
import type {
  CalcMuestraAulasCriteriosRadiografia,
  CriterioScope,
  CriteriosCatalogo,
} from "../../../../api/client";
import {
  buildCriteriosRadiografiaModel,
  criterioCardsForScope,
} from "./criteriosRadiografiaModel";
import {
  CRITERIO_RADIOGRAFIA_STATE_COPY,
  CriteriosRadiografiaCardDetalle,
} from "./CriteriosRadiografiaCardDetalle";
import {
  useCriteriosI18bSurface,
  type CriteriosI18bSurfaceSource,
} from "./useCriteriosI18bSurface";
import { CriteriosRadiografiaRecovery } from "./CriteriosRadiografiaRecovery";
import "./criteriosRadiografia.css";

export { CriteriosRadiografiaCardDetalle } from "./CriteriosRadiografiaCardDetalle";

export function CriteriosRadiografiaConsola({
  catalogo,
  radiografia,
  rawPresent,
  scope,
  legacyCardIds,
  i18bSource,
  onReconstruir,
  puedeReconstruir,
  reconstruyendo,
}: {
  catalogo: CriteriosCatalogo;
  radiografia: CalcMuestraAulasCriteriosRadiografia | null;
  rawPresent?: boolean;
  scope: CriterioScope;
  legacyCardIds?: ReadonlySet<string>;
  i18bSource?: CriteriosI18bSurfaceSource | null;
  onReconstruir?: () => void;
  puedeReconstruir?: boolean;
  reconstruyendo?: boolean;
}) {
  const i18b = useCriteriosI18bSurface(
    i18bSource,
    radiografia?.frame_hash ?? null,
    radiografia?.schema === "calc_muestra_aulas_criterios_radiografia_v2"
      ? radiografia
      : null,
  );
  const model = useMemo(
    () => buildCriteriosRadiografiaModel({
      catalogo,
      radiografia,
      rawPresent: rawPresent ?? i18b.rawRadiographyPresent,
      legacyCardIds,
    }),
    [catalogo, i18b.rawRadiographyPresent, legacyCardIds, radiografia, rawPresent],
  );
  const cards = useMemo(() => criterioCardsForScope(model, scope), [model, scope]);
  const [focusedId, setFocusedId] = useState(() => cards[0]?.cardId ?? "");
  useEffect(() => {
    if (!cards.some((card) => card.cardId === focusedId)) setFocusedId(cards[0]?.cardId ?? "");
  }, [cards, focusedId]);
  const focused = cards.find((card) => card.cardId === focusedId) ?? cards[0] ?? null;
  const framePresent = i18bSource?.frame != null;
  const rawRadiographyPresent = rawPresent === true || i18b.rawRadiographyPresent;
  const legacyContract = radiografia?.schema === "calc_muestra_aulas_criterios_radiografia_v1";
  const needsRecovery = framePresent && (!rawRadiographyPresent || legacyContract);
  if (needsRecovery) {
    return (
      <CriteriosRadiografiaRecovery
        scope={scope}
        onActualizar={onReconstruir}
        puedeActualizar={puedeReconstruir}
        actualizando={reconstruyendo}
      />
    );
  }
  if (!cards.length || !focused) return null;
  return (
    <section className="cmv2-crc" aria-label={`Consola analítica de criterios de ${scope === "alumno" ? "estudiante" : "curso-horario"}`}>
      <header className="cmv2-crc-head">
        <div>
          <span className="cmv2-crc-eyebrow">Radiografía antes de decidir</span>
          <h3>Dato → distribución → cascada → ancla → impacto → acción</h3>
          <p>{cards.length} tarjetas de este bloque · {model.expectedGateIds.length} gates en el denominador completo.</p>
        </div>
        <label className="cmv2-crc-focus" htmlFor={`cmv2-crc-focus-${scope}`}>
          <span>Enfocar criterio</span>
          <select
            id={`cmv2-crc-focus-${scope}`}
            value={focused.cardId}
            onChange={(event) => setFocusedId(event.target.value)}
          >
            {cards.map((card) => (
              <option value={card.cardId} key={card.cardId}>
                {card.label} · {CRITERIO_RADIOGRAFIA_STATE_COPY[card.state].label}
              </option>
            ))}
          </select>
        </label>
      </header>
      <nav
        className="cmv2-crc-card-strip"
        aria-label="Tarjetas dinámicas de criterios"
        data-qa-geometry-group="calc-muestra/criterios-tarjetas"
        data-qa-geometry-contract="intrinsic"
      >
        {cards.map((card) => (
          <button
            type="button"
            key={card.cardId}
            data-card-id={card.cardId}
            data-gates={card.gateIds.length}
            data-state={card.state}
            data-qa-geometry-member
            data-qa-geometry-capacity="owned"
            aria-pressed={card.cardId === focused.cardId}
            onClick={() => setFocusedId(card.cardId)}
          >
            <strong>{card.label}</strong>
            <span>{card.gateIds.length} {card.gateIds.length === 1 ? "gate" : "gates"}</span>
          </button>
        ))}
      </nav>
      {model.orphanGateIds.length || model.duplicateCardIds.length ? (
        <div className="cmv2-crc-contract-alert" role="alert">
          Contrato incompleto: {model.orphanGateIds.length ? `gates huérfanos ${model.orphanGateIds.join(", ")}` : ""}
          {model.orphanGateIds.length && model.duplicateCardIds.length ? " · " : ""}
          {model.duplicateCardIds.length ? `tarjetas duplicadas ${model.duplicateCardIds.join(", ")}` : ""}.
        </div>
      ) : null}
      {i18b.invalid.length ? (
        <div className="cmv2-crc-contract-alert" role="alert">
          Evidencia I18b inválida u obsoleta: {i18b.invalid.join(", ")}. React no sustituye esos datos con cálculos locales.
        </div>
      ) : null}
      <div
        className="cmv2-crc-frame"
        data-qa-geometry-group="calc-muestra/criterios-radiografia-consola"
        data-qa-geometry-contract="intrinsic"
        aria-live="polite"
      >
        <div data-qa-geometry-member data-qa-geometry-capacity="owned">
          <CriteriosRadiografiaCardDetalle
            card={focused}
            radiografia={radiografia}
            totals={i18b.totals}
            cascade={i18b.cascade}
            anchors={i18b.anchors}
            previewRequest={i18b.previewRequest}
            i18bComplete={i18b.status === "complete"}
          />
        </div>
      </div>
    </section>
  );
}
