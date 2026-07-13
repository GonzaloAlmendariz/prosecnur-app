import { useMemo } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  GitCompareArrows,
  Hash,
  Layers,
  Link,
  Repeat,
} from "../../../vendor/lucide-react";
import {
  externalRosterBadgeLabel,
  formatRelationalRepeatHeadline,
  relationalKindCopy,
  relationalKindLabel,
  type RelationalKind,
  type RelationalRuleInfo,
  type RelationalSummary,
} from "../relationalPlan";

// =============================================================================
// Panel de la familia "coherencia relacional del repeat" (Fase 4, ADR 0030).
//
// Presenta madre + hija como UN instrumento con base relacionada, con la
// identidad naranja transversal (`--pulso-repeat-*`). Destaca RC1
// (cardinalidad) y RC5 (correspondencia) como chequeos de primera clase, marca
// las reglas que requieren un roster externo (pulldata) y explica las que se
// evalúan al cargar la base hija. Toda la clasificación/copy es lógica pura de
// `relationalPlan.ts`; aquí solo se presenta.
// =============================================================================

/** Vista mínima de una regla relacional que consume el panel. */
export type RelationalRuleView = {
  id: string;
  displayName: string;
  nInconsistencias: number | null;
  porcentaje: number | null;
  info: RelationalRuleInfo;
};

type CardStatus = "cases" | "pending" | "external" | "clean";

type RelationalCard = {
  key: string;
  kind: RelationalKind;
  title: string;
  copy: string;
  status: CardStatus;
  count: number | null;
  porcentaje: number | null;
  ruleId: string | null;
  externalDatasets: string[];
};

const KIND_ORDER: RelationalKind[] = [
  "cardinality",
  "correspondence",
  "referential",
  "uniqueness",
  "other",
];

function kindIcon(kind: RelationalKind) {
  switch (kind) {
    case "cardinality":
      return <Hash size={14} />;
    case "correspondence":
      return <GitCompareArrows size={14} />;
    case "referential":
      return <Link size={14} />;
    case "uniqueness":
      return <Layers size={14} />;
    default:
      return <Repeat size={14} />;
  }
}

function rowStatus(view: RelationalRuleView): CardStatus {
  const info = view.info;
  if (info.requiresExternalDataset) return "external";
  if (info.childBaseMissing) return "pending";
  if ((view.nInconsistencias ?? 0) > 0) return "cases";
  return "clean";
}

function cardTitle(kind: RelationalKind, repeatGroup: string | null): string {
  const base = relationalKindLabel(kind);
  return repeatGroup ? `${base} · ${repeatGroup}` : base;
}

/**
 * Construye las tarjetas de la familia: una por regla relacional, más tarjetas
 * "sin inconsistencias" sintetizadas para RC1/RC5 cuando el resumen del plan
 * dice que existen pero no aparecen en el resultado (pasaron sin casos, así que
 * el backend las filtra del `resumen_tabla`).
 */
function buildCards(
  rows: RelationalRuleView[],
  summary: RelationalSummary | null,
): RelationalCard[] {
  const byKind = new Map<RelationalKind, RelationalRuleView[]>();
  for (const row of rows) {
    const list = byKind.get(row.info.kind) ?? [];
    list.push(row);
    byKind.set(row.info.kind, list);
  }

  const cards: RelationalCard[] = [];
  const primary = summary?.repeats[0] ?? null;

  for (const kind of KIND_ORDER) {
    const kindRows = byKind.get(kind) ?? [];
    if (kindRows.length > 0) {
      for (const row of kindRows) {
        const status = rowStatus(row);
        cards.push({
          key: row.id,
          kind,
          title: cardTitle(kind, row.info.repeatGroup),
          copy: relationalKindCopy(kind),
          status,
          count: row.nInconsistencias ?? null,
          porcentaje: row.porcentaje ?? null,
          ruleId: row.id,
          externalDatasets: row.info.externalDatasets,
        });
      }
      continue;
    }
    // Sintetizamos RC1/RC5 desde el resumen del plan: existen estructuralmente
    // (el instrumento declara el repeat con su conductor) pero pasaron limpias.
    if (!primary) continue;
    if (kind === "cardinality") {
      cards.push({
        key: `synth-cardinality-${primary.repeatGroup}`,
        kind,
        title: cardTitle(kind, primary.repeatGroup),
        copy: relationalKindCopy(kind),
        status: "clean",
        count: 0,
        porcentaje: 0,
        ruleId: null,
        externalDatasets: [],
      });
    } else if (kind === "correspondence" && primary.smConductor) {
      cards.push({
        key: `synth-correspondence-${primary.repeatGroup}`,
        kind,
        title: cardTitle(kind, primary.repeatGroup),
        copy: relationalKindCopy(kind),
        status: "clean",
        count: 0,
        porcentaje: 0,
        ruleId: null,
        externalDatasets: [],
      });
    }
  }
  return cards;
}

function StatusChip({ status, count }: { status: CardStatus; count: number | null }) {
  if (status === "cases") {
    const n = count ?? 0;
    return (
      <span className="pulso-rel-status is-cases">
        <AlertTriangle size={12} />
        {n.toLocaleString("es-PE")} {n === 1 ? "caso" : "casos"}
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="pulso-rel-status is-pending">
        <Clock size={12} />
        Se evalúa junto con la base de respuestas repetidas
      </span>
    );
  }
  if (status === "external") {
    return (
      <span className="pulso-rel-status is-external">
        <Database size={12} />
        Requiere un listado externo
      </span>
    );
  }
  return (
    <span className="pulso-rel-status is-clean">
      <CheckCircle2 size={12} />
      Sin inconsistencias
    </span>
  );
}

function RelationalCardView({
  card,
  selected,
  onSelect,
}: {
  card: RelationalCard;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const clickable = card.status === "cases" && !!card.ruleId;
  const featured = card.kind === "cardinality" || card.kind === "correspondence";
  const className = [
    "pulso-rel-card",
    featured ? "is-featured" : "",
    clickable ? "is-clickable" : "",
    selected ? "is-selected" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const body = (
    <>
      <div className="pulso-rel-card-head">
        <span className="pulso-rel-card-kind">
          <span className="pulso-rel-card-icon" aria-hidden="true">
            {kindIcon(card.kind)}
          </span>
          {card.title}
        </span>
        <StatusChip status={card.status} count={card.count} />
      </div>
      <div className="pulso-rel-card-copy">{card.copy}</div>
      {card.status === "external" && (
        <div className="pulso-rel-external-note">
          {externalRosterBadgeLabel(card.externalDatasets)}
        </div>
      )}
      {clickable && card.porcentaje != null && (
        <div className="pulso-rel-card-foot">{card.porcentaje.toFixed(1)}% de los registros</div>
      )}
    </>
  );

  if (clickable && card.ruleId) {
    const ruleId = card.ruleId;
    return (
      <button
        type="button"
        className={className}
        onClick={() => onSelect(ruleId)}
        aria-pressed={selected}
      >
        {body}
      </button>
    );
  }
  return <div className={className}>{body}</div>;
}

export default function RelationalRuleFamily({
  summary,
  rows,
  selectedRuleId,
  onSelect,
}: {
  summary: RelationalSummary | null;
  rows: RelationalRuleView[];
  selectedRuleId: string | null;
  onSelect: (id: string) => void;
}) {
  const cards = useMemo(() => buildCards(rows, summary), [rows, summary]);

  // No hay nada relacional en este instrumento: no renderizamos el panel.
  if (cards.length === 0 && !summary) return null;

  const primary = summary?.repeats[0] ?? null;
  const repeatGroups =
    summary?.repeatGroups ??
    Array.from(new Set(rows.map((r) => r.info.repeatGroup).filter((g): g is string => !!g)));
  const headline = primary
    ? formatRelationalRepeatHeadline(primary)
    : repeatGroups.length > 0
      ? `Las respuestas de «${repeatGroups.join("», «")}» se validan junto con la base principal.`
      : "La base principal y sus respuestas repetidas se validan en conjunto.";
  const nChecks = summary?.nRelational ?? cards.length;
  const nExternal = summary?.nRequiresExternalDataset ?? 0;

  return (
    <section className="pulso-rel-family" data-audit-ready="validacion-relacional">
      <header className="pulso-rel-family-header">
        <span className="pulso-rel-family-mark" aria-hidden="true">
          <Repeat size={15} />
        </span>
        <div className="pulso-rel-family-title-wrap">
          <div className="pulso-rel-family-title">Coherencia de las filas repetidas</div>
          <div className="pulso-rel-family-headline">{headline}</div>
        </div>
        <div className="pulso-rel-family-meta">
          <span className="pulso-rel-count-chip">
            {nChecks} {nChecks === 1 ? "chequeo" : "chequeos"}
          </span>
          {nExternal > 0 && (
            <span className="pulso-rel-count-chip is-external">
              <Database size={11} />
              {nExternal} con listado externo
            </span>
          )}
        </div>
      </header>

      {cards.length === 0 ? (
        <div className="pulso-rel-empty">
          Este instrumento tiene respuestas repetidas, pero aún no se han
          evaluado sus reglas de coherencia.
        </div>
      ) : (
        <div className="pulso-rel-grid">
          {cards.map((card) => (
            <RelationalCardView
              key={card.key}
              card={card}
              selected={!!card.ruleId && card.ruleId === selectedRuleId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </section>
  );
}
