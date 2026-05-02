import { ArrowDownAZ, ArrowDownNarrowWide } from "lucide-react";
import { useMemo } from "react";
import type { DashboardDimMatrizPayload, DashboardDimMatrizFila } from "../../../../api/client";
import { useDashboardStore } from "../../store";
import { colorOfScore, semaforoFromConfig } from "../../shared/semaforo";
import "./matriz_unidades.css";

// Matriz por unidad — filas = combinaciones de var_color (× var_nombre).
// Cada fila tiene una "card" de identidad en la 1ª columna (color de
// var_color + ícono opcional + texto), un indicador general en la 2ª,
// y una celda por conductor con color de semáforo. Las cards usan el
// mismo lenguaje visual que el FODA (sombra suave, borde blanco interno,
// animación de entrada con stagger).

export function MatrizUnidadesView({ payload }: { payload: DashboardDimMatrizPayload }) {
  const config = useDashboardStore((s) => s.config);
  const orden = useDashboardStore((s) => s.dimensiones.matrizOrden);
  const setDim = useDashboardStore((s) => s.setDimensiones);

  const sem = useMemo(
    () => semaforoFromConfig(config, payload.semaforo),
    [config, payload.semaforo],
  );

  const filas: DashboardDimMatrizFila[] = useMemo(() => {
    const rows = [...(payload.filas ?? [])];
    if (orden === "score") {
      // Mejor → peor. NULLs al final para que se note la falta de datos.
      rows.sort((a, b) => {
        const av = a.indicador_general ?? -Infinity;
        const bv = b.indicador_general ?? -Infinity;
        return bv - av;
      });
    } else {
      // Color (1ª var) > nombre (2ª var) — alfabético natural en español.
      const cmp = (a: string, b: string) =>
        a.localeCompare(b, "es", { sensitivity: "base", numeric: true });
      rows.sort((a, b) => {
        const c = cmp(a.color_label, b.color_label);
        if (c !== 0) return c;
        return cmp(a.nombre_label, b.nombre_label);
      });
    }
    return rows;
  }, [payload.filas, orden]);

  const conductores = payload.conductores ?? [];
  const groupColors = payload.group_colors ?? {};
  const icons = payload.icons ?? {};

  if (!conductores.length) {
    return <p className="dash-cardbox-help">El objetivo no tiene conductores en la base.</p>;
  }
  if (!filas.length) {
    return <p className="dash-cardbox-help">Sin filas con datos para mostrar.</p>;
  }

  return (
    <div className="dash-matriz">
      <div className="dash-matriz-toolbar">
        <span className="dash-matriz-meta">
          {filas.length} {filas.length === 1 ? "fila" : "filas"}
          {payload.var_color_label ? ` · ${payload.var_color_label}` : ""}
          {payload.var_nombre_label ? ` × ${payload.var_nombre_label}` : ""}
        </span>
        <div className="dash-matriz-orden" role="tablist" aria-label="Orden de filas">
          <button
            type="button"
            role="tab"
            aria-selected={orden === "score"}
            className={`dash-matriz-orden-btn ${orden === "score" ? "is-active" : ""}`}
            title="Ordenar por puntaje (mejor → peor)"
            onClick={() => setDim({ matrizOrden: "score" })}
          >
            <ArrowDownNarrowWide size={13} />
            <span>Puntaje</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={orden === "alfabetico"}
            className={`dash-matriz-orden-btn ${orden === "alfabetico" ? "is-active" : ""}`}
            title="Ordenar alfabéticamente"
            onClick={() => setDim({ matrizOrden: "alfabetico" })}
          >
            <ArrowDownAZ size={13} />
            <span>A–Z</span>
          </button>
        </div>
      </div>

      <div className="dash-matriz-scroll">
        <table className="dash-matriz-table" role="table">
          <thead>
            <tr>
              <th scope="col" className="dash-matriz-th-unit">Unidad</th>
              <th scope="col" className="dash-matriz-th-score is-general" title="Promedio simple de los conductores">
                Indicador general
              </th>
              {conductores.map((c) => (
                <th key={c.var} scope="col" className="dash-matriz-th-score" title={c.label}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((row, i) => {
              const bg = groupColors[row.color_label] ?? groupColors[row.color_key] ?? "#1f2a3a";
              const iconUri = row.icono_key
                ? (icons[row.icono_key] ?? icons[row.icono_label] ?? "")
                : "";
              return (
                <tr
                  key={row.key}
                  className="dash-matriz-row"
                  style={{ ["--dash-matriz-row-delay" as string]: `${i * 28}ms` }}
                >
                  <td className="dash-matriz-cell-unit">
                    <div
                      className={`dash-matriz-card ${iconUri ? "has-icon" : ""}`}
                      style={{ background: bg }}
                    >
                      {iconUri && (
                        <span
                          className="dash-matriz-card-icon"
                          aria-hidden="true"
                          style={{ ["--dash-matriz-icon-tint" as string]: config.foda_icon_tint ?? "#ffffff" }}
                        >
                          <img src={iconUri} alt="" />
                        </span>
                      )}
                      <span className="dash-matriz-card-text">
                        <strong className="dash-matriz-card-color-label">{row.color_label}</strong>
                        {row.nombre_label && (
                          <span className="dash-matriz-card-nombre-label">{row.nombre_label}</span>
                        )}
                      </span>
                      <span className="dash-matriz-card-n" title={`${row.n} casos`}>
                        n={row.n}
                      </span>
                    </div>
                  </td>
                  <td className="dash-matriz-cell-score is-general">
                    <ScoreChip value={row.indicador_general} sem={sem} />
                  </td>
                  {conductores.map((c) => {
                    const v = row.scores?.[c.label] ?? null;
                    return (
                      <td key={c.var} className="dash-matriz-cell-score">
                        <ScoreChip value={v} sem={sem} />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {payload.icon_legend && payload.icon_legend.length > 0 && (
        <div
          className="dash-matriz-legend"
          aria-label={`Leyenda de íconos${payload.var_icono_label ? ` · ${payload.var_icono_label}` : ""}`}
        >
          {payload.icon_legend.map((it) => (
            <span key={it.key} className="dash-matriz-legend-item">
              <img src={it.icono_url} alt="" aria-hidden="true" />
              <span>{it.label}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ScoreChip({
  value,
  sem,
}: {
  value: number | null | undefined;
  sem: ReturnType<typeof semaforoFromConfig>;
}) {
  if (value == null || !Number.isFinite(value)) {
    return <span className="dash-matriz-score is-empty" aria-label="Sin datos">—</span>;
  }
  const bg = colorOfScore(value, sem) ?? sem.green;
  return (
    <span className="dash-matriz-score" style={{ background: bg }}>
      {Math.round(value)}
    </span>
  );
}
