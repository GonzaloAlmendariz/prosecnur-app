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

/**
 * S1: la radiografía de un criterio pertenece a la tarjeta que lo decide.
 *
 * `useCriteriosRadiografiaInline` entrega, por `cardId`, el detalle listo para
 * incrustarse en su `CriterioCard`, más las alertas de contrato que son del
 * bloque entero. La consola con selector propio queda solo para superficies que
 * no tienen tarjetas donde colgar el detalle.
 */
export function useCriteriosRadiografiaInline({
  catalogo,
  radiografia,
  rawPresent,
  scope,
  legacyCardIds,
  i18bSource,
}: {
  catalogo: CriteriosCatalogo;
  radiografia: CalcMuestraAulasCriteriosRadiografia | null;
  rawPresent?: boolean;
  scope: CriterioScope;
  legacyCardIds?: ReadonlySet<string>;
  i18bSource?: CriteriosI18bSurfaceSource | null;
}) {
  const i18b = useCriteriosI18bSurface(
    i18bSource,
    radiografia?.frame_hash ?? null,
    radiografia?.schema === "calc_muestra_aulas_criterios_radiografia_v2" ? radiografia : null,
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
  const framePresent = i18bSource?.frame != null;
  const rawRadiographyPresent = rawPresent === true || i18b.rawRadiographyPresent;
  const legacyContract = radiografia?.schema === "calc_muestra_aulas_criterios_radiografia_v1";
  const needsRecovery = framePresent && (!rawRadiographyPresent || legacyContract);

  const detalle = (cardId: string) => {
    const card = cards.find((item) => item.cardId === cardId);
    if (!card || needsRecovery) return null;
    return (
      <CriteriosRadiografiaCardDetalle
        card={card}
        radiografia={radiografia}
        totals={i18b.totals}
        cascade={i18b.cascade}
        anchors={i18b.anchors}
        previewRequest={i18b.previewRequest}
        i18bComplete={i18b.status === "complete"}
      />
    );
  };

  /**
   * S4/S5 · Lo que una categoría aporta al **marco ejecutado**, publicado por R.
   *
   * El conmutador de cada categoría mostraba el conteo del catálogo —lo que hay
   * en la base antes de aplicar nada— así que se decidía contra un número que
   * no dice qué hace el criterio. Medido: PREGRADO marcaba «25.155 estudiantes»
   * mientras el marco publica 20.879 alumnos únicos elegibles, y MAESTRIA
   * marcaba «2.819» con aporte real 0.
   *
   * Devuelve la fila Total que R recalcula por segmento: no se suman facultades
   * en React, que es justo lo que el contrato prohíbe.
   */
  const aporte = (cardId: string, segmentKey: string) => {
    const fila = (i18b.totals?.rows ?? []).find(
      (row) => row.card_id === cardId && row.segment_key === segmentKey,
    );
    if (!fila) return null;
    return {
      elegibles: fila.actual.n_estudiantes_unicos,
      ch: fila.actual.n_ch,
      chContraste: fila.contraste_total.n_ch,
    };
  };

  return { cards, detalle, aporte, needsRecovery, model, invalid: i18b.invalid };
}

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
        <h3>Radiografía por facultad</h3>
        <p>{cards.length} criterios · {model.expectedGateIds.length} gates</p>
      </header>
      {/* Un solo control para enfocar un criterio. La tira reemplaza al
          `<select>` que la duplicaba: lleva el estado de la evidencia encima,
          así que no se pierde nada al quitarlo. */}
      <nav
        className="cmv2-crc-card-strip"
        aria-label="Enfocar criterio"
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
            <em data-state={card.state}>{CRITERIO_RADIOGRAFIA_STATE_COPY[card.state].label}</em>
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
