import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import {
  apiDashboardCategoriasVar,
  DashboardCategoriaValor,
  DashboardFiltro,
  DashboardSeccion,
} from "../../../../api/client";

// Filtros multi-row del Resumen. Espejo de la lógica de filtros del
// legacy en interactivo_resumen.R:592-963 (filtro_rows_ui +
// .register_filter_row + filtros_activos), simplificada para React:
// hasta MAX_FILTROS filas, cada una con sección + variable + categorías.
//
// API hacia afuera: emite el array de DashboardFiltro a aplicar (solo
// los que tienen var + valores). Sin filas → array vacío.

const MAX_FILTROS = 6;

type FilaState = {
  uid: number;
  seccion: string;
  varName: string;
  valoresSeleccionados: string[];
};

let UID_SEED = 1;
const nextUid = () => UID_SEED++;

export function FiltrosMultiRow({
  secciones,
  enabled,
  onToggleEnabled,
  onChange,
}: {
  secciones: DashboardSeccion[];
  enabled: boolean;
  onToggleEnabled: (v: boolean) => void;
  onChange: (filtros: DashboardFiltro[]) => void;
}) {
  const [filas, setFilas] = useState<FilaState[]>(() => [
    { uid: nextUid(), seccion: "", varName: "", valoresSeleccionados: [] },
  ]);

  // Catálogos cacheados por var (asincrónico, vienen del backend).
  const [catalogos, setCatalogos] = useState<
    Record<string, DashboardCategoriaValor[]>
  >({});

  // Cuando una fila apunta a una var nueva, hidrata su catálogo.
  useEffect(() => {
    const vars = filas
      .map((f) => f.varName)
      .filter((v) => v && !catalogos[v]);
    if (!vars.length) return;
    let cancelled = false;
    Promise.all(
      vars.map((v) =>
        apiDashboardCategoriasVar(v).then((r) => [v, r.valores] as const),
      ),
    )
      .then((entries) => {
        if (cancelled) return;
        setCatalogos((prev) => {
          const next = { ...prev };
          for (const [v, vals] of entries) next[v] = vals;
          return next;
        });
      })
      .catch(() => {
        // silencioso; la fila se queda sin opciones hasta el próximo cambio
      });
    return () => {
      cancelled = true;
    };
  }, [filas, catalogos]);

  // Emitir filtros activos al padre.
  useEffect(() => {
    if (!enabled) {
      onChange([]);
      return;
    }
    const activos: DashboardFiltro[] = filas
      .filter((f) => f.varName && f.valoresSeleccionados.length > 0)
      .map((f) => ({ var: f.varName, valores: f.valoresSeleccionados }));
    onChange(activos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filas, enabled]);

  const updateFila = (uid: number, patch: Partial<FilaState>) => {
    setFilas((cur) => cur.map((f) => (f.uid === uid ? { ...f, ...patch } : f)));
  };
  const removeFila = (uid: number) => {
    setFilas((cur) => {
      const next = cur.filter((f) => f.uid !== uid);
      if (next.length === 0) {
        return [{ uid: nextUid(), seccion: "", varName: "", valoresSeleccionados: [] }];
      }
      return next;
    });
  };
  const addFila = () => {
    setFilas((cur) =>
      cur.length >= MAX_FILTROS
        ? cur
        : [
            ...cur,
            { uid: nextUid(), seccion: "", varName: "", valoresSeleccionados: [] },
          ],
    );
  };
  const resetFilas = () => {
    setFilas([
      { uid: nextUid(), seccion: "", varName: "", valoresSeleccionados: [] },
    ]);
  };

  // Vars usadas por OTRAS filas — para evitar elegir la misma var dos veces.
  const usedVarsByOtherRows = useMemo(() => {
    const set = new Map<string, Set<number>>();
    for (const f of filas) {
      if (!f.varName) continue;
      if (!set.has(f.varName)) set.set(f.varName, new Set());
      set.get(f.varName)!.add(f.uid);
    }
    return (uid: number) => {
      const used = new Set<string>();
      for (const [v, uids] of set.entries()) {
        const others = Array.from(uids).filter((u) => u !== uid);
        if (others.length) used.add(v);
      }
      return used;
    };
  }, [filas]);

  return (
    <div>
      <div className="dash-filtros-head">
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--dash-primario)" }}>
          Filtros
        </div>
        <label className="dash-switch">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onToggleEnabled(e.target.checked)}
            aria-label="Activar filtros"
          />
          <span className="dash-switch-slider" />
        </label>
      </div>

      {enabled && (
        <>
          <div className="dash-filtros-rows">
            {filas.map((f, idx) => {
              const usedOther = usedVarsByOtherRows(f.uid);
              const seccionVars =
                secciones.find((s) => s.nombre === f.seccion)?.vars ?? [];
              const varsAvail = seccionVars.filter(
                (v) => v.name === f.varName || !usedOther.has(v.name),
              );
              const cats = catalogos[f.varName] ?? [];
              return (
                <div key={f.uid} className="dash-filtro-row">
                  <div className="dash-filtro-row-head">
                    <div className="dash-filtro-row-title">Filtro {idx + 1}</div>
                    {filas.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeFila(f.uid)}
                        className="dash-filtro-remove"
                        title="Quitar filtro"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  <label className="dash-filtro-label">Sección</label>
                  <select
                    className="dash-select"
                    value={f.seccion}
                    onChange={(e) =>
                      updateFila(f.uid, {
                        seccion: e.target.value,
                        varName: "",
                        valoresSeleccionados: [],
                      })
                    }
                  >
                    <option value="">— Selecciona —</option>
                    {secciones.map((s) => (
                      <option key={s.nombre} value={s.nombre}>
                        {s.nombre}
                      </option>
                    ))}
                  </select>

                  <label className="dash-filtro-label">Variable</label>
                  <select
                    className="dash-select"
                    value={f.varName}
                    disabled={!f.seccion}
                    onChange={(e) =>
                      updateFila(f.uid, {
                        varName: e.target.value,
                        valoresSeleccionados: [],
                      })
                    }
                  >
                    <option value="">Sin filtro</option>
                    {varsAvail.map((v) => (
                      <option key={v.name} value={v.name}>
                        {v.label}
                      </option>
                    ))}
                  </select>

                  {f.varName && (
                    <>
                      <label className="dash-filtro-label">Categorías</label>
                      <div className="dash-checkboxes">
                        {cats.length === 0 ? (
                          <div
                            className="dash-filtro-cats-skeleton"
                            aria-label="Cargando categorías"
                          >
                            <span className="dash-filtro-cats-skel-bar" />
                            <span className="dash-filtro-cats-skel-bar" />
                            <span className="dash-filtro-cats-skel-bar" />
                          </div>
                        ) : (
                          cats.map((c) => (
                            <label
                              key={c.value}
                              className="dash-checkbox-item"
                            >
                              <input
                                type="checkbox"
                                checked={f.valoresSeleccionados.includes(c.value)}
                                onChange={(e) => {
                                  const set = new Set(f.valoresSeleccionados);
                                  if (e.target.checked) set.add(c.value);
                                  else set.delete(c.value);
                                  updateFila(f.uid, {
                                    valoresSeleccionados: Array.from(set),
                                  });
                                }}
                              />
                              {c.label}
                            </label>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <div className="dash-quick-actions">
            <button
              type="button"
              onClick={addFila}
              disabled={filas.length >= MAX_FILTROS}
              className="dash-quick-btn"
            >
              Agregar filtro
            </button>
            <button
              type="button"
              onClick={resetFilas}
              className="dash-quick-btn"
            >
              Restablecer
            </button>
          </div>
          {filas.length >= MAX_FILTROS && (
            <p
              style={{
                fontSize: 11,
                color: "var(--dash-texto-suave)",
                margin: "6px 0 0 0",
              }}
            >
              Máximo {MAX_FILTROS} filtros.
            </p>
          )}
        </>
      )}
    </div>
  );
}
