import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  Inbox,
  ListPlus,
  Plus,
  Search,
  Target,
  X,
} from "lucide-react";
import {
  apiCodifGrupos,
  apiCodifRespuestas,
  Grupo,
  RespuestaUnica,
} from "../../api/client";
import { LoadingBlock, ErrorBlock, EmptyState } from "../../components/States";
import { SaveStatusIndicator } from "../../components/SaveStatusIndicator";
import { GrupoCodificacionCard } from "./GrupoCodificacionCard";

type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";
type StatTone = "neutral" | "success" | "warn" | "info" | "muted";

type Props = {
  parent: string;
};

export function RespuestasCodificador({ parent }: Props) {
  const [respuestas, setRespuestas] = useState<RespuestaUnica[] | null>(null);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [error, setError] = useState<string>("");
  const [query, setQuery] = useState<string>("");
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [tipo, setTipo] = useState<string>("");
  const [smOtros, setSmOtros] = useState<{ dummy_col: string; n_otros_marcados: number } | null>(null);

  const skipNextSave = useRef(true);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await apiCodifRespuestas(parent);
        skipNextSave.current = true;
        setRespuestas(r.respuestas);
        // Merge: siempre mostrar las opciones del choice list (existentes)
        // como grupos. Si ya hay un grupo persistido para ese código con
        // origen="existente", usa ese (mantiene respuestas asignadas). Si
        // no, agregar vacío. Luego agregar los grupos persistidos con
        // origen="nuevo" después.
        const persistidos = r.grupos ?? [];
        const existentes = r.opciones_existentes ?? [];
        const persistByCode = new Map(persistidos.map((g) => [g.codigo, g]));
        const merged: Grupo[] = [];
        // 1. Opciones existentes (preservando respuestas si ya había persistido)
        for (const o of existentes) {
          const prior = persistByCode.get(o.codigo);
          if (prior && prior.origen !== "nuevo") {
            merged.push({ ...prior, origen: "existente", etiqueta: o.etiqueta });
            persistByCode.delete(o.codigo);
          } else {
            merged.push({
              id: `ex_${o.codigo}`,
              codigo: o.codigo,
              etiqueta: o.etiqueta,
              respuestas: prior?.respuestas ?? [],
              origen: "existente",
            });
            if (prior) persistByCode.delete(o.codigo);
          }
        }
        // 2. Grupos nuevos (todo lo que queda en persistidos)
        for (const g of persistByCode.values()) {
          merged.push({ ...g, origen: g.origen ?? "nuevo" });
        }
        setGrupos(merged);
        setTipo(r.tipo);
        setSmOtros(r.sm_otros ?? null);
        setSaveStatus("idle");
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [parent]);

  // Autosave 2s after any change
  useEffect(() => {
    if (!respuestas) return;
    if (skipNextSave.current) { skipNextSave.current = false; return; }
    setSaveStatus("dirty");
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      setSaveStatus("saving");
      try {
        await apiCodifGrupos(parent, grupos);
        setSaveStatus("saved");
      } catch (e) {
        setSaveStatus("error");
        setError((e as Error).message);
      }
    }, 2000);
    return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); };
  }, [grupos, parent, respuestas]);

  // Reverse map: texto_normalizado → grupo (para saber qué respuestas están asignadas)
  const asignacion = useMemo(() => {
    const m = new Map<string, Grupo>();
    for (const g of grupos) for (const t of g.respuestas) m.set(t, g);
    return m;
  }, [grupos]);

  const activeGroup = grupos.find((g) => g.id === activeGroupId) ?? null;

  // Filtered respuestas list
  const visibleRespuestas = useMemo(() => {
    if (!respuestas) return [];
    const q = query.trim().toLowerCase();
    return respuestas.filter((r) => {
      if (!q) return true;
      return r.texto.toLowerCase().includes(q) || r.texto_normalizado.includes(q);
    });
  }, [respuestas, query]);

  const codificadas = useMemo(() => asignacion.size, [asignacion]);
  const pendientes = (respuestas?.length ?? 0) - codificadas;

  // Para el counter de SM "Otros": conteos en términos de CASOS reales
  // (no textos únicos). Cada `respuesta.frecuencia` = filas que tienen
  // ese texto. codificadas = casos con texto libre que ya caen en algún
  // grupo. `smOtros.n_otros_marcados` viene del backend con el conteo
  // de filas donde el dummy de Otros está en 1.
  const totalTextoFrecuencia = useMemo(() => {
    return (respuestas ?? []).reduce((s, r) => s + (r.frecuencia ?? 0), 0);
  }, [respuestas]);
  const casosCodificados = useMemo(() => {
    let n = 0;
    for (const [norm] of asignacion) {
      const r = (respuestas ?? []).find((x) => x.texto_normalizado === norm);
      if (r) n += r.frecuencia ?? 0;
    }
    return n;
  }, [asignacion, respuestas]);
  const casosPendientesOtros = (smOtros?.n_otros_marcados ?? 0) - casosCodificados;

  function nextCodigo(): string {
    // Los códigos ≥ 70 son convenciones (Otros=70, No sabe=88, No aplica=99,
    // etc.). Al crear un grupo nuevo queremos el siguiente entero "real" de
    // la lista, no saltar a 71 solo porque ya existe un 70. Si no hay
    // códigos < 70, caemos a max+1 (caso raro donde toda la lista es
    // convencional).
    const nums = grupos.map((g) => parseInt(g.codigo, 10)).filter((n) => !Number.isNaN(n));
    if (nums.length === 0) return "1";
    const realCodes = nums.filter((n) => n < 70);
    if (realCodes.length > 0) return String(Math.max(...realCodes) + 1);
    return String(Math.max(...nums) + 1);
  }

  function addGroup() {
    const id = `g_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const codigo = nextCodigo();
    const etiqueta = "";
    const nuevo: Grupo = { id, codigo, etiqueta, respuestas: [], origen: "nuevo" };
    setGrupos((gs) => [...gs, nuevo]);
    setActiveGroupId(id);
  }

  function updateGroup(id: string, patch: Partial<Grupo>) {
    setGrupos((gs) => gs.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  }

  function deleteGroup(id: string) {
    setGrupos((gs) => gs.filter((g) => g.id !== id));
    if (activeGroupId === id) setActiveGroupId(null);
  }

  // Reordena grupos ↑/↓ (patrón idéntico al de TimelinePanel.moveSlide de
  // Fase 5 Gráficos). El autosave de grupos recoge el cambio automático;
  // el orden se persiste y se usa downstream (p.ej. integer usa el orden
  // como precedencia first-match-wins de las reglas).
  function moveGroup(id: string, direction: "up" | "down") {
    setGrupos((gs) => {
      const i = gs.findIndex((g) => g.id === id);
      if (i < 0) return gs;
      const j = direction === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= gs.length) return gs;
      const next = [...gs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function toggleRespuesta(texto_normalizado: string) {
    const current = asignacion.get(texto_normalizado);
    if (current) {
      // Quitar de su grupo actual
      updateGroup(current.id, {
        respuestas: current.respuestas.filter((r) => r !== texto_normalizado),
      });
      return;
    }
    // Agregar al grupo activo (o crear uno)
    if (!activeGroupId || !activeGroup) {
      addGroup();
      // Wait for re-render; add on next tick
      setTimeout(() => {
        setGrupos((gs) => {
          if (gs.length === 0) return gs;
          const last = gs[gs.length - 1];
          return gs.map((g) => g.id === last.id ? { ...g, respuestas: [...g.respuestas, texto_normalizado] } : g);
        });
      }, 0);
      return;
    }
    updateGroup(activeGroup.id, {
      respuestas: [...activeGroup.respuestas, texto_normalizado],
    });
  }

  function moveToGroup(texto_normalizado: string, targetGroupId: string) {
    // Quitar de donde esté y agregar al target
    setGrupos((gs) => {
      const cleaned = gs.map((g) => ({ ...g, respuestas: g.respuestas.filter((r) => r !== texto_normalizado) }));
      return cleaned.map((g) => g.id === targetGroupId ? { ...g, respuestas: [...g.respuestas, texto_normalizado] } : g);
    });
  }

  if (error) return <ErrorBlock label="Error cargando respuestas" detail={error} />;
  if (!respuestas) return <LoadingBlock variant="inline" label="Cargando respuestas…" />;

  const esSM = tipo === "select_multiple" && !!smOtros;

  // Banda de KPIs: para SM el conteo es en CASOS reales (quienes marcaron
  // "Otros"); para el resto, en textos únicos. Tonos semánticos, no el accent
  // del módulo para todo el bloque.
  const stats: Array<{ label: string; value: number; tone: StatTone }> = esSM
    ? [
        { label: "Marcaron Otros", value: smOtros!.n_otros_marcados, tone: "neutral" },
        { label: "Con texto libre", value: totalTextoFrecuencia, tone: "info" },
        { label: "Codificadas", value: casosCodificados, tone: "success" },
        { label: "Sin codificar", value: Math.max(0, casosPendientesOtros), tone: casosPendientesOtros > 0 ? "warn" : "muted" },
      ]
    : [
        { label: "Respuestas", value: respuestas.length, tone: "neutral" },
        { label: "Codificadas", value: codificadas, tone: codificadas > 0 ? "success" : "muted" },
        { label: "Sin codificar", value: pendientes, tone: pendientes > 0 ? "warn" : "muted" },
        { label: grupos.length === 1 ? "Grupo" : "Grupos", value: grupos.length, tone: "info" },
      ];

  return (
    <div className="pulso-codificacion-respuestas pulso-cv2-rc">
      {/* Toolbar: guardado + acción. La banda de KPIs va debajo, full-width. */}
      <div className="pulso-cv2-rc-toolbar">
        <SaveStatusIndicator state={saveStatus} variant="badge" />
        <div className="pulso-cv2-rc-toolbar-spacer" />
        <button
          type="button"
          className="pulso-primary pulso-cv2-newgroup"
          onClick={addGroup}
        >
          <Plus size={14} /> Nuevo grupo
        </button>
      </div>

      {/* Banda de KPIs (stat-row) — tonos semánticos. Para SM lleva el
          eyebrow de la opción "Otros, especifique". */}
      <div className={`pulso-cv2-statband${esSM ? " is-otros" : ""}`}>
        {esSM && (
          <div className="pulso-cv2-statband-eyebrow">
            Opción "Otros, especifique" en <code>{parent}</code>
          </div>
        )}
        <div className="pulso-cv2-statrow">
          {stats.map((s) => (
            <div key={s.label} className={`pulso-cv2-stat is-${s.tone}`}>
              <span className="pulso-cv2-stat-val">{s.value}</span>
              <span className="pulso-cv2-stat-label">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Split-view origen → destino. El destino (grupos) lleva superficie de
          acento del módulo para leerse como el lugar donde caen las respuestas. */}
      <div className="pulso-cv2-split">
        {/* ORIGEN — respuestas únicas */}
        <section className="pulso-cv2-col pulso-cv2-col--origen">
          <div className="pulso-cv2-col-head">
            <span className="pulso-cv2-col-title">Respuestas únicas</span>
            <span className="pulso-cv2-col-count">
              {codificadas} de {respuestas.length} codificadas
            </span>
          </div>
          <div className="pulso-cv2-search">
            <Search size={14} className="pulso-cv2-search-icon" />
            <input
              placeholder="Buscar respuestas…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pulso-cv2-search-input"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="pulso-icon"
                aria-label="Limpiar búsqueda"
                title="Limpiar"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <div className="pulso-cv2-resp-list">
            {visibleRespuestas.length === 0 && (
              <div className="pulso-cv2-resp-empty">No hay respuestas que coincidan.</div>
            )}
            {visibleRespuestas.map((r) => {
              const grupo = asignacion.get(r.texto_normalizado);
              const assigned = !!grupo;
              return (
                <div
                  key={r.texto_normalizado}
                  className={`pulso-cv2-resp-row${assigned ? " is-assigned" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={assigned}
                    onChange={() => toggleRespuesta(r.texto_normalizado)}
                    aria-label={`${assigned ? "Quitar" : "Agregar"} "${r.texto}" ${assigned ? `del grupo ${grupo!.etiqueta || grupo!.codigo}` : "al grupo activo"}`}
                  />
                  <div className="pulso-cv2-resp-main">
                    <div className="pulso-cv2-resp-text">
                      {r.label ? (
                        <>
                          <code className="pulso-cv2-resp-code">{r.texto}</code>
                          {r.label}
                        </>
                      ) : r.texto}
                    </div>
                    <div className="pulso-cv2-resp-meta">
                      <span><strong>{r.frecuencia}</strong> {r.frecuencia === 1 ? "vez" : "veces"}</span>
                      {r.variantes > 1 && <span>{r.variantes} variantes</span>}
                      {assigned && (
                        <span className="pulso-cv2-resp-assigned">
                          <ArrowRight size={10} /> {grupo!.codigo}{grupo!.etiqueta ? ` · ${grupo!.etiqueta}` : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  {!assigned && grupos.length > 1 && (
                    <QuickAssignDropdown grupos={grupos} onPick={(gid) => moveToGroup(r.texto_normalizado, gid)} />
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* DESTINO — grupos de codificación */}
        <section className="pulso-cv2-col pulso-cv2-col--destino">
          <div className="pulso-cv2-col-head">
            <span className="pulso-cv2-col-title">
              <Target size={13} className="pulso-cv2-col-title-icon" />
              Grupos de codificación
            </span>
            <span className="pulso-cv2-col-count">
              {grupos.length} {grupos.length === 1 ? "grupo" : "grupos"}
            </span>
          </div>
          {grupos.length === 0 ? (
            <EmptyState
              variant="inline"
              icon={<Inbox size={18} />}
              title="Sin grupos todavía"
              hint="Crea uno con 'Nuevo grupo' o marca una respuesta a la izquierda — se crea un grupo vacío automáticamente."
            />
          ) : (
            <div className="pulso-cv2-grupos-list pulso-codificacion-grupos-list">
              {grupos.map((g, idx) => (
                <GrupoCodificacionCard
                  key={`${g.id}-${idx}`}
                  grupo={g}
                  respuestas={respuestas}
                  asignacion={asignacion}
                  active={g.id === activeGroupId}
                  onActivate={() => setActiveGroupId(g.id)}
                  onUpdate={(patch) => updateGroup(g.id, patch)}
                  onDelete={() => deleteGroup(g.id)}
                  onRemoveRespuesta={(t) => updateGroup(g.id, { respuestas: g.respuestas.filter((r) => r !== t) })}
                  onAddRespuesta={(t) => updateGroup(g.id, { respuestas: [...g.respuestas, t] })}
                  onMoveUp={() => moveGroup(g.id, "up")}
                  onMoveDown={() => moveGroup(g.id, "down")}
                  isFirst={idx === 0}
                  isLast={idx === grupos.length - 1}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function QuickAssignDropdown({ grupos, onPick }: { grupos: Grupo[]; onPick: (gid: string) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Click-outside + Escape cierran el menú. Patrón estándar para dropdowns
  // controlados — más robusto que onMouseLeave (que se pierde si el cursor
  // sale rápido del área). El botón padre también cierra al reclickear
  // gracias al toggle `setOpen((v) => !v)`.
  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="pulso-cv2-qa">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`pulso-cv2-qa-btn${open ? " is-open" : ""}`}
        title="Asignar a grupo existente"
      >
        <ListPlus size={11} />
        <span>asignar</span>
        <ChevronDown size={9} className="pulso-cv2-qa-caret" />
      </button>
      {open && (
        <div role="menu" className="pulso-cv2-qa-menu">
          {grupos.length === 0 && (
            <div className="pulso-cv2-qa-empty">Todavía no hay grupos creados.</div>
          )}
          {grupos.map((g) => (
            <button
              key={g.id}
              type="button"
              role="menuitem"
              onClick={(e) => { e.stopPropagation(); onPick(g.id); setOpen(false); }}
              className="pulso-cv2-qa-item"
            >
              <strong>{g.codigo}</strong> {g.etiqueta || <em className="pulso-cv2-qa-unnamed">sin nombre</em>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
