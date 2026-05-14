import { ChevronDown, Layers, Loader2, Save, Sigma } from "lucide-react";
import { IconAI } from "../../../../lib/icons";
import { useEffect, useState } from "react";
import {
  apiAnaliticaConfigPut,
  apiAnaliticaDimensionesBuild,
  apiAnaliticaVariables,
  apiProjectSave,
  apiProjectStatus,
  VariableInstrumento,
} from "../../../../api/client";
import { useSession } from "../../../../lib/SessionContext";
import { useAnaliticaStore } from "../../store";
import { ConfettiBurst } from "../shared/ConfettiBurst";
import { DiagramaArbol } from "../shared/DiagramaArbol";
import { stripPrefijo } from "../shared/displayVar";
import { useDimensionesWizardStore } from "../store";

// Step 5 — Confirmar y generar. Muestra el árbol resumen + editor
// compacto del semáforo + botón grande "Generar dimensiones".
//
// Al click:
//   1. Promovemos el draft del wizard al store global de Analítica.
//   2. Llamamos POST /api/analitica/config (autosave inmediato).
//   3. Llamamos POST /api/analitica/dimensiones/build.
//   4. Confetti + transición a la vista de resumen post-build.

export function Step5_Confirmar({ onSuccess }: { onSuccess: () => void }) {
  const draft = useDimensionesWizardStore((s) => s.draft);
  const setDimensiones = useAnaliticaStore((s) => s.setDimensiones);
  const config = useAnaliticaStore((s) => s.config);
  const { refresh } = useSession();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confetti, setConfetti] = useState(false);
  const [savedToProject, setSavedToProject] = useState(false);
  const [resultado, setResultado] = useState<{
    n_filas: number;
    n_idx: number;
    n_sub: number;
  } | null>(null);

  const sinBloques = draft.subindices.length === 0;

  async function handleGenerar() {
    if (sinBloques) {
      setError("Define al menos un bloque temático en el paso 3 antes de generar.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      // Promover draft al store + persistir al backend.
      setDimensiones(draft);
      const nextConfig = { ...config, dimensiones: draft };
      await apiAnaliticaConfigPut(nextConfig);
      // Construir.
      const r = await apiAnaliticaDimensionesBuild();
      setResultado({ n_filas: r.n_filas, n_idx: r.n_idx, n_sub: r.n_sub });
      setConfetti(true);
      await refresh();

      // Guardar el .pulso inmediatamente para que la config + el output
      // queden persistidos sin esperar al autosave (cada 5 min). Solo si
      // hay un .pulso activo — en sesión efímera no aplica.
      try {
        const status = await apiProjectStatus();
        if (status.has_project) {
          await apiProjectSave(null);
          setSavedToProject(true);
        }
      } catch {
        // No bloqueante: si el guardado falla, el usuario verá el toast
        // de éxito de generación pero sin "Guardado en .pulso". Igualmente
        // el autosave intentará de nuevo más tarde.
      }

      // Esperar al final de la animación y delegar al padre.
      window.setTimeout(() => {
        onSuccess();
      }, 1700);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, position: "relative" }}>
      <header>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>
          Revisa la estructura y genera
        </h2>
        <p
          style={{
            margin: "6px 0 0",
            fontSize: 13,
            color: "var(--pulso-text-soft)",
            lineHeight: 1.5,
            maxWidth: 720,
          }}
        >
          Esta es la jerarquía que vamos a construir. Si algo no calza, vuelve al
          paso correspondiente desde la barra superior. Cuando estés listo, pulsa{" "}
          <strong>Generar dimensiones</strong>.
        </p>
      </header>

      <div
        style={{
          padding: "18px 20px",
          borderRadius: 12,
          border: "1px solid var(--pulso-border)",
          background: "var(--pulso-surface)",
          boxShadow: "var(--pulso-shadow-low)",
          overflowX: "auto",
        }}
      >
        <DiagramaArbol
          listas={draft.listas_objetivo}
          bloques={draft.subindices}
          indices={draft.indices}
        />
      </div>

      <DetalleEstructura />


      <details
        style={{
          padding: "10px 14px",
          borderRadius: 10,
          background: "var(--pulso-surface-2, #f4f5f9)",
          fontSize: 12,
        }}
      >
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>
          Semáforo (cortes y colores)
        </summary>
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ color: "var(--pulso-text-soft)" }}>
            Cortes: <strong>{draft.semaforo.cortes.join(" / ")}</strong> · Colores:{" "}
            <ColorChip c={draft.semaforo.colores.rojo} l="rojo" />
            <ColorChip c={draft.semaforo.colores.ambar} l="ámbar" />
            <ColorChip c={draft.semaforo.colores.verde} l="verde" />
          </div>
          <small style={{ color: "var(--pulso-text-soft)" }}>
            Estos cortes se aplican al colorear celdas, gauges y heatmaps en
            Cruces y Dashboard. Por ahora se mantienen los valores por default
            (o los que vinieron de la plantilla); se podrán afinar más adelante.
          </small>
        </div>
      </details>

      {error && (
        <div
          role="alert"
          style={{
            padding: 12,
            borderRadius: 8,
            border: "1px solid var(--pulso-danger-border)",
            background: "var(--pulso-danger-bg)",
            color: "var(--pulso-danger-fg)",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap",
          padding: "16px 18px",
          borderRadius: 12,
          background: "var(--pulso-primary-soft)",
          border: "1px solid var(--pulso-primary-border, #c7d6ee)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {confetti && <ConfettiBurst />}
        <button
          type="button"
          className="pulso-primary"
          onClick={handleGenerar}
          disabled={busy || sinBloques}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: 14,
            padding: "10px 18px",
            fontWeight: 700,
          }}
        >
          {busy ? <Loader2 size={16} className="pulso-spin" /> : <IconAI size={16} />}
          {busy ? "Generando…" : "Generar dimensiones"}
        </button>
        <div style={{ flex: 1, fontSize: 12, color: "var(--pulso-text)" }}>
          {resultado ? (
            <>
              <strong>¡Listo!</strong> {resultado.n_filas.toLocaleString("es-PE")} filas,{" "}
              {resultado.n_sub} bloques, {resultado.n_idx} índices.
              {savedToProject && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    marginLeft: 8,
                    color: "var(--pulso-success-fg, #15803d)",
                    fontWeight: 600,
                  }}
                >
                  <Save size={11} /> Guardado en tu .pulso
                </span>
              )}
            </>
          ) : (
            <>
              {draft.listas_objetivo.length} listas evaluativas,{" "}
              {draft.subindices.length} bloques,{" "}
              {draft.subindices.reduce((acc, b) => acc + b.vars.length, 0)} variables,{" "}
              {draft.indices.length} índices compuestos.
            </>
          )}
        </div>
      </div>

      <p
        style={{
          margin: 0,
          fontSize: 11,
          color: "var(--pulso-text-soft)",
          lineHeight: 1.5,
        }}
      >
        💾 La configuración + los índices generados se guardan con tu archivo{" "}
        <code>.pulso</code>. La próxima vez que abras este proyecto, las dimensiones
        aparecerán listas sin tener que volver a importar nada.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------
// Detalle expandible: acordeón con bloques y composición de índices.
// Cada bloque clickeable expande las vars con su label humano (resuelto
// desde el instrumento + subcriterios definidos). Cada índice muestra
// su fórmula como (bloque1 + bloque2 + …) / N.

function DetalleEstructura() {
  const draft = useDimensionesWizardStore((s) => s.draft);
  const [openBloque, setOpenBloque] = useState<string | null>(null);
  const [openIndice, setOpenIndice] = useState<string | null>(null);
  const [variables, setVariables] = useState<VariableInstrumento[]>([]);

  useEffect(() => {
    let cancelled = false;
    apiAnaliticaVariables()
      .then((r) => {
        if (!cancelled) setVariables(r.variables);
      })
      .catch(() => {
        /* tolerante: si falla, mostramos solo nombres técnicos */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const prefijo = draft.prefijo || "r100_";

  // Resuelve un nombre de var a su label humano corto, en orden de
  // prioridad:
  //   1. `labels_indicadores[v]` o `labels_indicadores[r100_v]` — la
  //      etiqueta corta canónica del estudio (ej. "Respeto y
  //      amabilidad", "Confort"). Es lo que aparece en gráficos.
  //   2. Etiqueta del subcriterio (si v es derivado).
  //   3. Label largo del instrumento (texto completo de la pregunta).
  //   4. Fallback al nombre técnico.
  function labelDeVar(v: string): string {
    const sinPrefijo = v.replace(new RegExp(`^${prefijo}`), "");
    const conPrefijo = sinPrefijo === v ? `${prefijo}${v}` : v;

    const labelCorto =
      draft.labels_indicadores[v] ??
      draft.labels_indicadores[conPrefijo] ??
      draft.labels_indicadores[sinPrefijo];
    if (labelCorto) return labelCorto;

    const subcriterio = draft.subcriterios.find((sc) => {
      const scSinPrefijo = sc.nombre.replace(new RegExp(`^${prefijo}`), "");
      return scSinPrefijo === sinPrefijo || sc.nombre === v;
    });
    if (subcriterio?.etiqueta) return subcriterio.etiqueta;

    const direct = variables.find((x) => x.name === sinPrefijo);
    if (direct?.label) return direct.label;

    return sinPrefijo;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Bloques */}
      <section
        style={{
          padding: 14,
          borderRadius: 12,
          border: "1px solid var(--pulso-border)",
          background: "white",
        }}
      >
        <header style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Layers size={14} color="var(--pulso-primary)" />
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>
            Bloques temáticos ({draft.subindices.length})
          </h3>
          <span style={{ fontSize: 11, color: "var(--pulso-text-soft)" }}>
            cada bloque será un sub-índice 0-100
          </span>
        </header>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {draft.subindices.map((b) => {
            const open = openBloque === b.nombre;
            return (
              <div
                key={b.nombre}
                style={{
                  border: "1px solid var(--pulso-border)",
                  borderRadius: 8,
                  background: "var(--pulso-surface)",
                  overflow: "hidden",
                }}
              >
                <button
                  type="button"
                  onClick={() => setOpenBloque(open ? null : b.nombre)}
                  aria-expanded={open}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 12px",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <ChevronDown
                    size={13}
                    style={{
                      transition: "transform var(--anim-dur-short) var(--anim-ease-smooth)",
                      transform: open ? "rotate(0deg)" : "rotate(-90deg)",
                    }}
                  />
                  <strong style={{ fontSize: 13, flex: 1 }}>{b.etiqueta}</strong>
                  <span style={{ fontSize: 11, color: "var(--pulso-text-soft)" }}>
                    {b.vars.length} {b.vars.length === 1 ? "var" : "vars"}
                  </span>
                </button>
                {open && (
                  <ul
                    style={{
                      margin: 0,
                      padding: "0 12px 10px 32px",
                      listStyle: "none",
                      display: "flex",
                      flexDirection: "column",
                      gap: 3,
                    }}
                  >
                    {b.vars.map((v) => (
                      <li
                        key={v}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          fontSize: 12,
                          color: "var(--pulso-text)",
                          padding: "3px 0",
                        }}
                      >
                        <span style={{ flex: 1 }}>{labelDeVar(v)}</span>
                        <code
                          style={{
                            fontFamily: "ui-monospace, monospace",
                            fontSize: 10,
                            color: "var(--pulso-text-soft)",
                          }}
                        >
                          {stripPrefijo(v, prefijo)}
                        </code>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Índices */}
      {draft.indices.length > 0 && (
        <section
          style={{
            padding: 14,
            borderRadius: 12,
            border: "1px solid var(--pulso-border)",
            background: "white",
          }}
        >
          <header style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Sigma size={14} color="var(--pulso-primary)" />
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>
              Índices compuestos ({draft.indices.length})
            </h3>
            <span style={{ fontSize: 11, color: "var(--pulso-text-soft)" }}>
              promedio 0-100 de varios bloques
            </span>
          </header>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {draft.indices.map((idx) => {
              const open = openIndice === idx.nombre;
              const bloquesEtiquetas = idx.subindices
                .map((s) => draft.subindices.find((b) => b.nombre === s)?.etiqueta ?? s);
              return (
                <div
                  key={idx.nombre}
                  style={{
                    border: "1px solid var(--pulso-border)",
                    borderRadius: 8,
                    background: "var(--pulso-surface)",
                    overflow: "hidden",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setOpenIndice(open ? null : idx.nombre)}
                    aria-expanded={open}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 12px",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <ChevronDown
                      size={13}
                      style={{
                        transition: "transform var(--anim-dur-short) var(--anim-ease-smooth)",
                        transform: open ? "rotate(0deg)" : "rotate(-90deg)",
                      }}
                    />
                    <strong style={{ fontSize: 13, flex: 1 }}>{idx.etiqueta}</strong>
                  </button>
                  {open && (
                    <div
                      style={{
                        padding: "0 12px 10px 32px",
                        fontSize: 12,
                        color: "var(--pulso-text)",
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "ui-monospace, monospace",
                          fontSize: 11,
                          padding: "6px 10px",
                          background: "var(--pulso-surface-2, #f4f5f9)",
                          borderRadius: 6,
                          color: "var(--pulso-text-soft)",
                        }}
                      >
                        {idx.etiqueta} = ({bloquesEtiquetas.join(" + ")}) /{" "}
                        {bloquesEtiquetas.length}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function ColorChip({ c, l }: { c: string; l: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        marginLeft: 6,
        fontSize: 11,
      }}
    >
      <span
        style={{
          width: 12,
          height: 12,
          borderRadius: 3,
          background: c,
          border: "1px solid rgba(0,0,0,0.1)",
          display: "inline-block",
        }}
      />
      {l}
    </span>
  );
}
