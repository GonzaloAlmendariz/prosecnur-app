import { useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { CalcMuestraAulasReplacementSimulation } from "../../../../api/client";
import { Map, MousePointer2 } from "../../../../vendor/lucide-react";
import { fmtInt } from "../../sharedCore";
import { AulaInspectorPanel } from "./AulaInspectorPanel";
import {
  buildClassroomSelectionMap,
  selectionMapInspectionTarget,
  type SelectionMapChain,
  type SelectionMapNode,
} from "./classroomSelectionMapModel";
import "./classroomSelectionMap.css";

const EQUIVALENCE_LABELS = {
  misma_celda: "Misma celda",
  celda_equivalente: "Celda equivalente",
  misma_facultad: "Misma facultad",
  desconocido: "Sin equivalencia acreditada",
} as const;

function MapNodeButton({
  node,
  esTitular = false,
  selected,
  onInspect,
}: {
  node: SelectionMapNode;
  /** El titular encabeza la cadena; los reemplazos cuelgan de él. */
  esTitular?: boolean;
  selected: boolean;
  onInspect: (row: Record<string, unknown>) => void;
}) {
  // P3 · en el titular, la línea de abajo es el DOCENTE.
  //
  // Ahí decía «Misma celda» —la equivalencia—, que en un titular no significa
  // nada: la equivalencia mide cuánto se parece un REEMPLAZO al titular que
  // cubre, así que en la cabeza de la cadena era un rótulo constante y vacío
  // repetido una vez por cadena. El docente es lo que faltaba para poder
  // coordinar: la lista decía qué curso salió y no a quién escribirle.
  const pie = esTitular
    ? node.teacher || "docente no publicado"
    : EQUIVALENCE_LABELS[node.equivalence];
  return (
    <button
      type="button"
      className="cmv2-selection-map-node"
      data-equivalence={node.equivalence}
      data-selected={selected || undefined}
      aria-pressed={selected}
      aria-label={`Inspeccionar ${node.code}: ${node.label}. ${pie}`}
      onClick={() => onInspect(selectionMapInspectionTarget(node))}
    >
      <strong>{node.code}</strong>
      <span>{node.label}</span>
      <small className={esTitular && !node.teacher ? "is-hueco" : undefined}>{pie}</small>
    </button>
  );
}

function MapChainRow({
  chain,
  selectedRow,
  onInspect,
}: {
  chain: SelectionMapChain;
  selectedRow: Record<string, unknown> | null;
  onInspect: (row: Record<string, unknown>) => void;
}) {
  return (
    <div className="cmv2-selection-map-chain" data-qa-geometry-member>
      <MapNodeButton node={chain.titular} esTitular selected={selectedRow === chain.titular.row} onInspect={onInspect} />
      <div className="cmv2-selection-map-reserves" aria-label={`Cadena de ${chain.titular.code}`}>
        {chain.reserves.length ? chain.reserves.map((node) => (
          <MapNodeButton key={`${node.id}-${node.order}`} node={node} selected={selectedRow === node.row} onInspect={onInspect} />
        )) : <span className="cmv2-selection-map-empty">Sin reemplazos enlazados</span>}
      </div>
    </div>
  );
}

export function ClassroomSelectionMapWorkspace({
  selectionRows,
  simulation,
  selectedRow,
  methodLabel,
  onInspect,
  onInspectById,
  onCloseInspector,
}: {
  selectionRows: Array<Record<string, unknown>>;
  simulation?: CalcMuestraAulasReplacementSimulation | null;
  selectedRow: Record<string, unknown> | null;
  methodLabel: string;
  onInspect: (row: Record<string, unknown>) => void;
  onInspectById: (classroomId: string) => void;
  onCloseInspector: () => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const model = useMemo(
    () => buildClassroomSelectionMap(selectionRows, simulation),
    [selectionRows, simulation],
  );
  const virtualizer = useVirtualizer({
    count: model.virtualRows.length,
    getScrollElement: () => parentRef.current,
    // 118 y no 104: el nodo pasó a dos líneas de nombre para que el curso se
    // lea (classroomSelectionMap.css). Si la estimación se queda corta, el
    // virtualizador encima las filas.
    estimateSize: (index) => model.virtualRows[index]?.kind === "group" ? 42 : 118,
    getItemKey: (index) => model.virtualRows[index]?.key ?? index,
    overscan: 6,
  });

  return (
    <div
      className={`cmv2-selection-map-workspace${selectedRow ? " has-inspector" : ""}`}
      data-qa-geometry-group="aulas-mapa-inspector"
      data-qa-geometry-contract="intrinsic"
    >
      <section className="cmv2-panel cmv2-aulas-panel cmv2-selection-map-panel" data-qa-geometry-member>
        <div className="cmv2-subhead">
          <div>
            <strong>Mapa completo de la muestra</strong>
            <small>Cada CH conserva toda su ruta R n.1 → R n.2 → …; selecciona cualquier nodo para inspeccionarlo.</small>
          </div>
          <Map size={18} aria-hidden="true" />
        </div>
        <div
          className="cmv2-selection-map-summary"
          data-qa-geometry-group="aulas-mapa-resumen"
          data-qa-geometry-contract="equal"
        >
          <span data-qa-geometry-member><strong>{fmtInt(model.titularCount)}</strong> titulares</span>
          <span data-qa-geometry-member><strong>{fmtInt(model.reserveCount)}</strong> reemplazos</span>
          <span data-qa-geometry-member><strong>{fmtInt(model.groups.length)}</strong> facultades</span>
          <span data-qa-geometry-member><strong>{fmtInt(model.maxDepth)}</strong> profundidad máxima</span>
        </div>
        <div className="cmv2-selection-map-legend" aria-label="Leyenda de equivalencia explícita">
          {Object.entries(EQUIVALENCE_LABELS).map(([key, label]) => (
            <span key={key} data-equivalence={key}><i aria-hidden="true" />{label}</span>
          ))}
        </div>
        {model.unlinkedReserveCount > 0 && (
          <p className="cmv2-selection-map-warning">
            {fmtInt(model.unlinkedReserveCount)} reemplazos no traen titular o slot enlazable; se muestran sin inventar la relación.
          </p>
        )}
        <div
          ref={parentRef}
          className="cmv2-selection-map-viewport"
          role="region"
          tabIndex={0}
          aria-label={`Mapa virtualizado con ${fmtInt(model.titularCount)} titulares y ${fmtInt(model.reserveCount)} reemplazos`}
          data-qa-geometry-capacity="owned"
        >
          <div
            className="cmv2-selection-map-virtual"
            style={{ height: virtualizer.getTotalSize() }}
            data-qa-geometry-group="aulas-mapa-filas"
            data-qa-geometry-contract="intrinsic"
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const item = model.virtualRows[virtualRow.index];
              if (!item) return null;
              return (
                <div
                  key={item.key}
                  ref={virtualizer.measureElement}
                  data-index={virtualRow.index}
                  className="cmv2-selection-map-virtual-row"
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                  data-qa-geometry-member
                >
                  {item.kind === "group" ? (
                    <div className="cmv2-selection-map-faculty">
                      <strong>{item.group.faculty}</strong>
                      <span>{fmtInt(item.group.chains.length)} CH · {fmtInt(item.group.chains.reduce((total, chain) => total + chain.reserves.length, 0) + item.group.unlinkedReserves.length)} reemplazos</span>
                    </div>
                  ) : item.kind === "chain" ? (
                    <MapChainRow chain={item.chain} selectedRow={selectedRow} onInspect={onInspect} />
                  ) : (
                    <div className="cmv2-selection-map-unlinked" data-qa-geometry-member>
                      <MousePointer2 size={14} aria-hidden="true" />
                      <span>Sin titular enlazada</span>
                      <MapNodeButton node={item.node} selected={selectedRow === item.node.row} onInspect={onInspect} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
      {selectedRow && (
        <div className="cmv2-selection-map-inspector" data-qa-geometry-member>
          <AulaInspectorPanel
            row={selectedRow}
            selectionRows={selectionRows}
            methodLabel={methodLabel}
            onClose={onCloseInspector}
            onInspect={onInspectById}
          />
        </div>
      )}
    </div>
  );
}
