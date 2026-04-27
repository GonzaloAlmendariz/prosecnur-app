import { useMemo, useState } from "react";
import { Book, Download, X } from "lucide-react";
import {
  apiDashboardBaseDatosDescargar,
  type DashboardBaseDatosSeccion,
} from "../../../../api/client";
import { useDashboardStore } from "../../store";
import {
  useBaseDatosData,
  useBaseDatosEstructura,
  useDiccionarioVariable,
} from "../../useDashboardData";
import { EmptyState } from "../../shared/EmptyState";
import "./baseDatos.css";

// Tab Base de datos — vista tabular con secciones expandibles, modo
// códigos/etiquetas, búsqueda, paginación y descarga. Reproduce la
// pestaña "Base de datos" del legacy `prosecnur::reporte_interactivo()`.

export function BaseDatosTab() {
  const baseDatos = useDashboardStore((s) => s.baseDatos);
  const setBaseDatos = useDashboardStore((s) => s.setBaseDatos);
  const toggleVar = useDashboardStore((s) => s.toggleBaseDatosVariable);
  const setVariables = useDashboardStore((s) => s.setBaseDatosVariables);
  const toggleSeccion = useDashboardStore((s) => s.toggleBaseDatosSeccion);

  const { loading: loadingEst, error: errEst, payload: estructura } =
    useBaseDatosEstructura();

  const { loading: loadingData, error: errData, payload: dataPayload } =
    useBaseDatosData({
      modo: baseDatos.modo,
      variables: baseDatos.variables,
      page: baseDatos.page,
      pageSize: baseDatos.pageSize,
      search: baseDatos.search,
      sort: baseDatos.sort,
    });

  const [diccionarioOpen, setDiccionarioOpen] = useState(false);
  const [downloadFormato, setDownloadFormato] = useState<"xlsx" | "csv">("xlsx");
  const [downloadBusy, setDownloadBusy] = useState(false);

  // Todos los names (incluyendo dummies SM) para el toggle "Todas".
  const allVarNames = useMemo(() => {
    if (!estructura) return [];
    const names: string[] = [];
    for (const sec of estructura.secciones) {
      for (const v of sec.variables) {
        if (v.tipo === "sm" && v.dummies) {
          // Para SM, sumamos la madre (que el backend expandirá).
          names.push(v.name);
        } else {
          names.push(v.name);
        }
      }
    }
    return names;
  }, [estructura]);

  function handleDescargar() {
    if (!baseDatos.variables.length) return;
    setDownloadBusy(true);
    apiDashboardBaseDatosDescargar({
      modo: baseDatos.modo,
      variables: baseDatos.variables,
      formato: downloadFormato,
    })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const ts = new Date()
          .toISOString()
          .replace(/[:.]/g, "")
          .slice(0, 15);
        a.download = `base_datos_${ts}.${downloadFormato}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      })
      .finally(() => setDownloadBusy(false));
  }

  return (
    <div className="dash-base-layout">
      {/* ───── Sidebar ───── */}
      <aside className="dash-sidebar">
        <section className="dash-cardbox">
          <div className="dash-cardbox-header">
            <h2 className="dash-cardbox-title">Vista</h2>
          </div>
          <div className="dash-source-segments" role="tablist" aria-label="Modo de vista">
            <button
              type="button"
              role="tab"
              aria-selected={baseDatos.modo === "codigos"}
              className={`dash-source-segment ${baseDatos.modo === "codigos" ? "is-active" : ""}`}
              onClick={() => setBaseDatos({ modo: "codigos", page: 1 })}
            >
              Códigos
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={baseDatos.modo === "etiquetas"}
              className={`dash-source-segment ${baseDatos.modo === "etiquetas" ? "is-active" : ""}`}
              onClick={() => setBaseDatos({ modo: "etiquetas", page: 1 })}
            >
              Etiquetas
            </button>
          </div>
        </section>

        <section className="dash-cardbox">
          <div className="dash-cardbox-header">
            <h2 className="dash-cardbox-title">Variables</h2>
          </div>
          {loadingEst ? (
            <p className="dash-cardbox-help">Cargando…</p>
          ) : errEst ? (
            <p className="dash-cardbox-help">{errEst}</p>
          ) : !estructura?.secciones.length ? (
            <p className="dash-cardbox-help">No hay variables.</p>
          ) : (
            <>
              <div className="dash-quick-actions">
                <button
                  type="button"
                  className="dash-quick-btn"
                  onClick={() => setVariables(allVarNames)}
                >
                  Todas
                </button>
                <button
                  type="button"
                  className="dash-quick-btn"
                  onClick={() => setVariables([])}
                >
                  Ninguna
                </button>
              </div>
              <div className="dash-base-secciones">
                {estructura.secciones.map((sec) => (
                  <SeccionItem
                    key={sec.id}
                    sec={sec}
                    variables={baseDatos.variables}
                    abierta={baseDatos.seccionesAbiertas.includes(sec.id)}
                    onToggleSeccion={() => toggleSeccion(sec.id)}
                    onToggleVar={toggleVar}
                  />
                ))}
              </div>
            </>
          )}
        </section>

        <section className="dash-cardbox">
          <div className="dash-cardbox-header">
            <h2 className="dash-cardbox-title">Descargar</h2>
          </div>
          <label className="dash-filtro-label">Formato</label>
          <select
            className="dash-select"
            value={downloadFormato}
            onChange={(e) => setDownloadFormato(e.target.value as "xlsx" | "csv")}
          >
            <option value="xlsx">Excel (.xlsx)</option>
            <option value="csv">CSV (.csv)</option>
          </select>
          <button
            type="button"
            className="dash-primary-btn"
            disabled={!baseDatos.variables.length || downloadBusy}
            onClick={handleDescargar}
            style={{ marginTop: 10 }}
          >
            <Download size={14} style={{ marginRight: 6, display: "inline-block" }} />
            {downloadBusy ? "Generando…" : "Descargar"}
          </button>
        </section>

        <section className="dash-cardbox">
          <button
            type="button"
            className="dash-subtle-btn"
            onClick={() => setDiccionarioOpen(true)}
            disabled={!estructura?.secciones.length}
          >
            <Book size={14} />
            Libro de códigos
          </button>
        </section>
      </aside>

      {/* ───── Main ───── */}
      <main>
        <div className="dash-base-toolbar">
          <input
            className="dash-input"
            placeholder="Buscar en la tabla…"
            value={baseDatos.search}
            onChange={(e) => setBaseDatos({ search: e.target.value, page: 1 })}
            style={{ maxWidth: 320 }}
          />
        </div>
        {!baseDatos.variables.length ? (
          <EmptyState
            title="Selecciona variables"
            subtitle="Marca al menos una variable en el panel de la izquierda."
          />
        ) : loadingData ? (
          <EmptyState title="Cargando filas…" />
        ) : errData ? (
          <EmptyState title="No se pudo cargar la data" subtitle={errData} />
        ) : !dataPayload ? (
          <EmptyState title="Sin datos" />
        ) : (
          <BaseDatosTabla
            payload={dataPayload}
            page={baseDatos.page}
            pageSize={baseDatos.pageSize}
            onPage={(p) => setBaseDatos({ page: p })}
            onPageSize={(ps) => setBaseDatos({ pageSize: ps, page: 1 })}
          />
        )}
      </main>

      {diccionarioOpen && estructura && (
        <DiccionarioModal
          estructura={estructura}
          onClose={() => setDiccionarioOpen(false)}
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Item de sección con checkbox + expansión.
// -----------------------------------------------------------------------------
function SeccionItem({
  sec,
  variables,
  abierta,
  onToggleSeccion,
  onToggleVar,
}: {
  sec: DashboardBaseDatosSeccion;
  variables: string[];
  abierta: boolean;
  onToggleSeccion: () => void;
  onToggleVar: (name: string) => void;
}) {
  const checked = sec.variables.some((v) => variables.includes(v.name));
  return (
    <div className="dash-base-seccion">
      <div className="dash-base-seccion-head">
        <label className="dash-base-seccion-check">
          <input
            type="checkbox"
            checked={checked}
            onChange={() => {
              const allNames = sec.variables.map((v) => v.name);
              const someChecked = allNames.some((n) => variables.includes(n));
              for (const n of allNames) {
                const isChecked = variables.includes(n);
                if (someChecked && isChecked) onToggleVar(n);
                else if (!someChecked && !isChecked) onToggleVar(n);
              }
            }}
          />
          <strong>{sec.label}</strong>
        </label>
        <button
          type="button"
          className="dash-base-seccion-toggle"
          onClick={onToggleSeccion}
        >
          {abierta ? "Ocultar" : "Ver preguntas"}
        </button>
      </div>
      {abierta && (
        <div className="dash-base-vars">
          {sec.variables.map((v) => (
            <label key={v.name} className="dash-base-var">
              <input
                type="checkbox"
                checked={variables.includes(v.name)}
                onChange={() => onToggleVar(v.name)}
              />
              <span>
                {v.label}
                {v.tipo === "sm" && v.dummies && v.dummies.length > 0 && (
                  <small> ({v.dummies.length} opciones)</small>
                )}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Tabla paginada.
// -----------------------------------------------------------------------------
function BaseDatosTabla({
  payload,
  page,
  pageSize,
  onPage,
  onPageSize,
}: {
  payload: { rows: Record<string, string>[]; columnas: { key: string; label: string }[]; total: number };
  page: number;
  pageSize: number;
  onPage: (p: number) => void;
  onPageSize: (ps: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(payload.total / pageSize));
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(payload.total, start + payload.rows.length - 1);

  return (
    <div className="dash-base-tabla-wrap">
      <div className="dash-base-tabla-scroll">
        <table className="dash-base-tabla">
          <thead>
            <tr>
              {payload.columnas.map((c) => (
                <th key={c.key} title={c.key}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {payload.rows.length === 0 ? (
              <tr>
                <td colSpan={payload.columnas.length} style={{ textAlign: "center", color: "var(--dash-texto-suave)" }}>
                  Sin filas.
                </td>
              </tr>
            ) : (
              payload.rows.map((row, i) => (
                <tr key={i}>
                  {payload.columnas.map((c) => (
                    <td key={c.key}>{row[c.key] ?? ""}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="dash-base-paginacion">
        <span className="dash-base-paginacion-info">
          {payload.total > 0
            ? `Mostrando ${start}–${end} de ${payload.total.toLocaleString("es-PE")}`
            : "Sin filas"}
        </span>
        <div className="dash-base-paginacion-controles">
          <select
            className="dash-select"
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value))}
            style={{ width: "auto" }}
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>{n} por página</option>
            ))}
          </select>
          <button
            type="button"
            className="dash-quick-btn"
            disabled={page <= 1}
            onClick={() => onPage(Math.max(1, page - 1))}
          >
            ← Anterior
          </button>
          <span style={{ fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
            {page} / {totalPages}
          </span>
          <button
            type="button"
            className="dash-quick-btn"
            disabled={page >= totalPages}
            onClick={() => onPage(Math.min(totalPages, page + 1))}
          >
            Siguiente →
          </button>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Modal — Libro de códigos (selecciona sección + variable, muestra opciones).
// -----------------------------------------------------------------------------
function DiccionarioModal({
  estructura,
  onClose,
}: {
  estructura: { secciones: DashboardBaseDatosSeccion[] };
  onClose: () => void;
}) {
  const [seccionId, setSeccionId] = useState(estructura.secciones[0]?.id ?? "");
  const seccion = estructura.secciones.find((s) => s.id === seccionId);
  const [variable, setVariable] = useState(seccion?.variables[0]?.name ?? "");
  const { loading, error, payload } = useDiccionarioVariable(variable);

  return (
    <div className="dash-modal-backdrop" onClick={onClose}>
      <div
        className="dash-modal"
        style={{ width: "min(560px, 100%)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dash-modal-head">
          <div>
            <h2>Libro de códigos</h2>
            <p>Diccionario de opciones por variable.</p>
          </div>
          <button type="button" className="dash-icon-btn" onClick={onClose} aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: 16, display: "grid", gap: 12 }}>
          <label className="dash-filtro-label">Sección</label>
          <select
            className="dash-select"
            value={seccionId}
            onChange={(e) => {
              setSeccionId(e.target.value);
              const s = estructura.secciones.find((sx) => sx.id === e.target.value);
              setVariable(s?.variables[0]?.name ?? "");
            }}
          >
            {estructura.secciones.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
          <label className="dash-filtro-label">Variable</label>
          <select
            className="dash-select"
            value={variable}
            onChange={(e) => setVariable(e.target.value)}
          >
            {seccion?.variables.map((v) => (
              <option key={v.name} value={v.name}>{v.label}</option>
            ))}
          </select>
          {loading ? (
            <p className="dash-cardbox-help">Cargando…</p>
          ) : error ? (
            <p className="dash-cardbox-help">{error}</p>
          ) : payload ? (
            <DiccionarioContenido payload={payload} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DiccionarioContenido({
  payload,
}: {
  payload: {
    variable: string;
    etiqueta: string;
    tipo: string;
    tipo_medicion: string;
    opciones: { codigo: string; etiqueta: string }[];
  };
}) {
  return (
    <div className="dash-diccionario-content">
      <div className="dash-diccionario-meta">
        <div><strong>Variable:</strong> {payload.variable}</div>
        <div><strong>Etiqueta:</strong> {payload.etiqueta}</div>
        <div><strong>Tipo:</strong> {payload.tipo} · {payload.tipo_medicion}</div>
      </div>
      {payload.opciones.length > 0 ? (
        <table className="dash-cross-table">
          <thead>
            <tr><th>Código</th><th>Etiqueta</th></tr>
          </thead>
          <tbody>
            {payload.opciones.map((o) => (
              <tr key={o.codigo}>
                <th scope="row">{o.codigo}</th>
                <td style={{ textAlign: "left" }}>{o.etiqueta}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="dash-cardbox-help">Sin opciones (variable abierta o numérica).</p>
      )}
    </div>
  );
}
