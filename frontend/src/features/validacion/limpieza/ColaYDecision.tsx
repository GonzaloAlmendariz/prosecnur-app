/**
 * Cola de hallazgos y hueco del editor de decisión, lado a lado. Salió de
 * `tabs/LimpiezaTab.tsx`.
 */
import { type ReactNode, useMemo, useState } from "react";
import { Search, Inbox } from "../../../vendor/lucide-react";
import { EditorPanel } from "./EditorDeDecision";
import type { MesaDeLimpieza } from "./useMesaDeLimpieza";
import type { InstrumentoDrillResult } from "../../../api/client";
import type { LimpiezaQueueItem } from "../types";
import { RuleNarrative, type DecisionKind } from "../components/v2";
import { formatoConteo } from "../../../lib/formatoNumero";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { Panel } from "../../../components/Panel";
import { NEW_DECISION, buildVariableHoverLookup, isCorrectionActionLabel, isDocumentedActionLabel, queueItemToRule } from "./modeloLimpieza";

// =============================================================================
// Zona 2 — Workbench (cola + editor)
// =============================================================================
export function Workbench({
  queue,
  selectedSourceId,
  onSelect,
  auditReady,
  editorRef,
  activeFilterKind,
  onClearFilterKind,
  drill,
  children,
}: {
  queue: LimpiezaQueueItem[];
  selectedSourceId: string;
  onSelect: (sourceId: string) => void;
  auditReady: boolean;
  editorRef: React.RefObject<HTMLDivElement>;
  activeFilterKind: DecisionKind | null;
  onClearFilterKind: () => void;
  drill: InstrumentoDrillResult | null;
  children: ReactNode;
}) {
  // Filtro por categoría UX (taxonomía nueva). "all" = sin filtro.
  const [filterCat, setFilterCat] = useState<string>("all");
  const categoriasUx = useMemo(() => {
    const set = new Map<string, number>();
    for (const item of queue) {
      const cat = item.categoria_ux || "Otras";
      set.set(cat, (set.get(cat) ?? 0) + 1);
    }
    return Array.from(set.entries()).sort((a, b) => b[1] - a[1]);
  }, [queue]);

  const filteredQueue = useMemo(() => {
    let q = queue;
    if (filterCat !== "all") {
      q = q.filter((item) => (item.categoria_ux || "Otras") === filterCat);
    }
    if (activeFilterKind) {
      q = q.filter((item) => {
        const action = (item.current_action ?? "").toLowerCase();
        if (activeFilterKind === "pending") return item.pending;
        if (activeFilterKind === "ignore") return isDocumentedActionLabel(action);
        if (activeFilterKind === "exclude") return action.startsWith("excluir");
        if (activeFilterKind === "change") return isCorrectionActionLabel(action);
        return true;
      });
    }
    return q;
  }, [queue, filterCat, activeFilterKind]);

  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(280px, 0.9fr) minmax(0, 1.6fr)",
        gap: 16,
        alignItems: "stretch",
      }}
    >
      <Panel
        className="pulso-limpieza-cola"
        aria-labelledby="pulso-limpieza-cola-titulo"
        title={
          <span id="pulso-limpieza-cola-titulo">
            Cola de hallazgos{" "}
            <span className="pulso-limpieza-cola-conteo">
              ({filterCat === "all" ? formatoConteo(queue.length) : `${formatoConteo(filteredQueue.length)} de ${formatoConteo(queue.length)}`})
            </span>
          </span>
        }
        hint="Las pendientes aparecen primero; las que ya decidiste bajan al final."
      >

        {auditReady && categoriasUx.length > 1 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 4 }}>
            <FilterChip
              label="Todas"
              count={queue.length}
              active={filterCat === "all"}
              onClick={() => setFilterCat("all")}
            />
            {categoriasUx.map(([cat, count]) => (
              <FilterChip
                key={cat}
                label={cat}
                count={count}
                active={filterCat === cat}
                onClick={() => setFilterCat(cat)}
              />
            ))}
          </div>
        )}

        {activeFilterKind && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              padding: "6px 10px",
              borderRadius: 10,
              background: "var(--pulso-primary-soft)",
              border: "1px solid var(--pulso-primary-border)",
              fontSize: "var(--pulso-type-caption-size)",
              color: "var(--pulso-primary)",
              fontWeight: 700,
            }}
          >
            <span>Filtrado por tipo de decisión</span>
            <button
              type="button"
              onClick={onClearFilterKind}
              style={{
                fontSize: "var(--pulso-type-caption-size)",
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 999,
                border: "1px solid var(--pulso-primary-border)",
                background: "white",
                color: "var(--pulso-primary)",
                cursor: "pointer",
              }}
            >
              Limpiar
            </button>
          </div>
        )}

        {!auditReady ? (
          <EstadoVacio icono={<Inbox size={16} />} titulo="La cola aparece después de correr la auditoría." />
        ) : queue.length === 0 ? (
          <EstadoVacio icono={<Inbox size={16} />} titulo="No hay hallazgos pendientes." />
        ) : filteredQueue.length === 0 ? (
          <EstadoVacio icono={<Search size={16} />} titulo={`No hay hallazgos en "${filterCat}".`} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", paddingRight: 4 }}>
            {filteredQueue.map((item, idx) => {
              // Insertar un separador "Ya decididas" justo antes del primer
              // item no-pending (cuando hay al menos uno pendiente antes).
              const prev = idx > 0 ? filteredQueue[idx - 1] : null;
              const showDivider = !item.pending && (prev?.pending ?? false);
              return (
                <div key={item.source_id}>
                  {showDivider && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        margin: "8px 2px 10px",
                        fontSize: "var(--pulso-type-micro-size)",
                        fontWeight: 800,
                        color: "var(--pulso-text-soft)",
                        textTransform: "uppercase",
                        letterSpacing: 0.6,
                      }}
                    >
                      <span>Ya decididas</span>
                      <span style={{ flex: 1, height: 1, background: "var(--pulso-border)" }} />
                    </div>
                  )}
                  <QueueRow
                    item={item}
                    selected={item.source_id === selectedSourceId}
                    onClick={() => onSelect(item.source_id)}
                    drill={item.source_id === selectedSourceId ? drill : null}
                  />
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {/* El editor necesita su ref para volver arriba al cambiar de hallazgo, y Panel no la
          reenvía: toma el material del kit con su clase. */}
      <div ref={editorRef} className="pulso-panel pulso-panel--content pulso-limpieza-editor">
        {children}
      </div>
    </section>
  );
}

export function QueueRow({
  item,
  selected,
  onClick,
  drill,
}: {
  item: LimpiezaQueueItem;
  selected: boolean;
  onClick: () => void;
  drill: InstrumentoDrillResult | null;
}) {
  const rule = useMemo(() => queueItemToRule(item, drill), [item, drill]);
  const variableHoverLookup = useMemo(() => buildVariableHoverLookup(drill), [drill]);
  return (
    <RuleNarrative
      rule={rule}
      variant="compact"
      status={item.pending ? "pending" : "ready"}
      selected={selected}
      onClick={onClick}
      nCasos={item.n_casos ?? null}
      porcentaje={item.porcentaje ?? null}
      currentAction={item.current_action ?? null}
      variableHoverLookup={variableHoverLookup}
      // Sin hover en la cola: con muchas reglas pendientes los portals
      // se acumulaban y tiraban la app. El hovercard rico aparece en el
      // hero del editor (a la derecha), donde sí aporta valor.
      disableVariableHover
    />
  );
}

// Chip con el filtro por categoria_ux (pildorazo clickeable).
export function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 9px",
        borderRadius: 999,
        fontSize: "var(--pulso-type-micro-size)",
        fontWeight: 700,
        border: `1px solid ${active ? "var(--pulso-primary-border)" : "var(--pulso-border)"}`,
        background: active ? "var(--pulso-primary-soft)" : "white",
        color: active ? "var(--pulso-primary)" : "var(--pulso-text-soft)",
        cursor: "pointer",
      }}
    >
      {label}
      <span style={{ opacity: 0.65 }}>{count}</span>
    </button>
  );
}

export function EditorEmpty({ auditReady }: { auditReady: boolean }) {
  return (
    <EstadoVacio
      tamano="normal"
      icono={<Inbox size={20} />}
      titulo={auditReady ? "Selecciona un hallazgo de la cola para decidir." : "Corre la auditoría para poder decidir sobre las reglas."}
    />
  );
}

/** La cola de hallazgos con el editor de la decisión del hallazgo elegido. */
export default function ColaYDecision({ mesa, auditReady }: { mesa: MesaDeLimpieza; auditReady: boolean }) {
  const { selectedSourceId, setSelectedSourceId, setSelectedDecisionId, editorRef, drill } = mesa;
  return (
    <Workbench
      queue={mesa.orderedQueue}
      selectedSourceId={selectedSourceId}
      onSelect={(sourceId) => {
        setSelectedSourceId(sourceId);
        setSelectedDecisionId(NEW_DECISION);
        editorRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      }}
      auditReady={auditReady}
      editorRef={editorRef}
      activeFilterKind={mesa.activeFilterKind}
      onClearFilterKind={() => mesa.setActiveFilterKind(null)}
      drill={drill}
    >
      {!selectedSourceId ? (
        <EditorEmpty auditReady={auditReady} />
      ) : (
        <EditorPanel
          item={mesa.selectedQueueItem}
          drill={drill}
          form={mesa.form}
          setForm={mesa.setForm}
          variableOptions={mesa.variableOptions}
          caseRows={mesa.caseRows}
          caseColumns={mesa.caseColumns}
          selectedCaseIdsSet={mesa.selectedCaseIdsSet}
          drillLoading={mesa.drillLoading}
          drillError={mesa.drillError}
          relatedDecisions={mesa.relatedDecisions}
          selectedDecisionId={mesa.selectedDecisionId}
          onPickHistory={(id) => setSelectedDecisionId(id)}
          onNewDecision={() => setSelectedDecisionId(NEW_DECISION)}
          historyOpen={mesa.historyOpen}
          setHistoryOpen={mesa.setHistoryOpen}
          saveBusy={mesa.saveBusy}
          onSaveDraft={() => void mesa.handleSave("draft")}
          onSaveAndNext={() => void mesa.handleSave("ready", { advance: true })}
          onDelete={() => void mesa.handleDeleteDecision()}
          onNav={mesa.navigateQueue}
          canDelete={!!mesa.selectedDecision}
        />
      )}
    </Workbench>
  );
}
