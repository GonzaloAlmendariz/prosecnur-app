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
import { cleanCodificacionLabel, displayCodificacionValueLabel } from "./codificacionLabels";

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
  const [liveMsg, setLiveMsg] = useState("");

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
          const etiqueta = cleanCodificacionLabel(o.etiqueta || o.codigo);
          if (prior && prior.origen !== "nuevo") {
            merged.push({ ...prior, origen: "existente", etiqueta });
            persistByCode.delete(o.codigo);
          } else {
            merged.push({
              id: `ex_${o.codigo}`,
              codigo: o.codigo,
              etiqueta,
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
        announce("Cambios guardados.");
      } catch (e) {
        setSaveStatus("error");
        setError((e as Error).message);
        announce("No se pudo guardar la codificación.");
      }
    }, 2000);
    return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); };
  }, [grupos, parent, respuestas]);

  const esSM = tipo === "select_multiple" && !!smOtros;

  // Reverse map: texto_normalizado → grupos. En recodificación de
  // select_multiple una misma respuesta puede aportar a más de una categoría.
  const asignaciones = useMemo(() => {
    const m = new Map<string, Grupo[]>();
    for (const g of grupos) {
      for (const t of g.respuestas) {
        const current = m.get(t) ?? [];
        if (!current.some((x) => x.id === g.id)) current.push(g);
        m.set(t, current);
      }
    }
    return m;
  }, [grupos]);

  const asignacion = useMemo(() => {
    const m = new Map<string, Grupo>();
    for (const [t, gs] of asignaciones) {
      if (gs[0]) m.set(t, gs[0]);
    }
    return m;
  }, [asignaciones]);

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

  const codificadas = useMemo(() => asignaciones.size, [asignaciones]);
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
    for (const [norm] of asignaciones) {
      const r = (respuestas ?? []).find((x) => x.texto_normalizado === norm);
      if (r) n += r.frecuencia ?? 0;
    }
    return n;
  }, [asignaciones, respuestas]);
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

  function announce(message: string) {
    setLiveMsg(message);
    window.setTimeout(() => setLiveMsg(""), 1200);
  }

  function respuestaLabel(texto_normalizado: string): string {
    const found = respuestas?.find((r) => r.texto_normalizado === texto_normalizado);
    return found ? displayCodificacionValueLabel(found.texto, found.label).label : texto_normalizado;
  }

  function grupoLabel(grupo: Grupo): string {
    const display = displayCodificacionValueLabel(grupo.codigo, grupo.etiqueta);
    if (display.code) return `${display.code} · ${display.label}`;
    return display.label || `grupo ${grupo.codigo}`;
  }

  function grupoTieneRespuesta(grupo: Grupo, texto_normalizado: string): boolean {
    return grupo.respuestas.includes(texto_normalizado);
  }

  function addGroup() {
    const id = `g_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const codigo = nextCodigo();
    const etiqueta = "";
    const nuevo: Grupo = { id, codigo, etiqueta, respuestas: [], origen: "nuevo" };
    setGrupos((gs) => [...gs, nuevo]);
    setActiveGroupId(id);
    announce(`Grupo ${codigo} creado y seleccionado.`);
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
    if (esSM && activeGroup) {
      const alreadyInActive = grupoTieneRespuesta(activeGroup, texto_normalizado);
      updateGroup(activeGroup.id, {
        respuestas: alreadyInActive
          ? activeGroup.respuestas.filter((r) => r !== texto_normalizado)
          : [...activeGroup.respuestas, texto_normalizado],
      });
      announce(
        `"${respuestaLabel(texto_normalizado)}" ${alreadyInActive ? "quitada de" : "asignada a"} ${grupoLabel(activeGroup)}.`,
      );
      return;
    }

    const current = asignacion.get(texto_normalizado);
    if (current) {
      // Quitar de su grupo actual
      updateGroup(current.id, {
        respuestas: current.respuestas.filter((r) => r !== texto_normalizado),
      });
      announce(`"${respuestaLabel(texto_normalizado)}" quitada de ${grupoLabel(current)}.`);
      return;
    }
    // Agregar al grupo activo (o crear uno)
    if (!activeGroupId || !activeGroup) {
      const id = `g_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const codigo = nextCodigo();
      const nuevo: Grupo = { id, codigo, etiqueta: "", respuestas: [texto_normalizado], origen: "nuevo" };
      setGrupos((gs) => [...gs, nuevo]);
      setActiveGroupId(id);
      announce(`"${respuestaLabel(texto_normalizado)}" asignada al nuevo grupo ${codigo}.`);
      return;
    }
    updateGroup(activeGroup.id, {
      respuestas: [...activeGroup.respuestas, texto_normalizado],
    });
    announce(`"${respuestaLabel(texto_normalizado)}" asignada a ${grupoLabel(activeGroup)}.`);
  }

  function moveToGroup(texto_normalizado: string, targetGroupId: string) {
    const target = grupos.find((g) => g.id === targetGroupId);
    if (esSM) {
      setGrupos((gs) => gs.map((g) => {
        if (g.id !== targetGroupId || g.respuestas.includes(texto_normalizado)) return g;
        return { ...g, respuestas: [...g.respuestas, texto_normalizado] };
      }));
      if (target) announce(`"${respuestaLabel(texto_normalizado)}" asignada también a ${grupoLabel(target)}.`);
      return;
    }
    // Quitar de donde esté y agregar al target
    setGrupos((gs) => {
      const cleaned = gs.map((g) => ({ ...g, respuestas: g.respuestas.filter((r) => r !== texto_normalizado) }));
      return cleaned.map((g) => g.id === targetGroupId ? { ...g, respuestas: [...g.respuestas, texto_normalizado] } : g);
    });
    if (target) announce(`"${respuestaLabel(texto_normalizado)}" movida a ${grupoLabel(target)}.`);
  }

  if (error) return <ErrorBlock label="Error cargando respuestas" detail={error} />;
  if (!respuestas) return <LoadingBlock variant="inline" label="Cargando respuestas…" />;

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
          aria-label="Crear nuevo grupo de codificación"
        >
          <Plus size={14} /> Nuevo grupo
        </button>
      </div>
      <div className="pulso-sr-only" aria-live="polite" aria-atomic="true">
        {liveMsg}
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
              type="search"
              placeholder="Buscar respuestas…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pulso-cv2-search-input"
              aria-label={`Buscar respuestas de ${parent}`}
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
              const gruposAsignados = asignaciones.get(r.texto_normalizado) ?? [];
              const grupo = gruposAsignados[0];
              const assigned = gruposAsignados.length > 0;
              const checked = esSM && activeGroup ? activeGroup.respuestas.includes(r.texto_normalizado) : assigned;
              const display = displayCodificacionValueLabel(r.texto, r.label);
              const gruposDisponibles = esSM
                ? grupos.filter((g) => !g.respuestas.includes(r.texto_normalizado))
                : grupos;
              const puedeAsignarRapido = esSM ? gruposDisponibles.length > 0 : !assigned && grupos.length > 1;
              const assignedLabel = gruposAsignados.map((g) => grupoLabel(g)).join("; ");
              return (
                <div
                  key={r.texto_normalizado}
                  className={`pulso-cv2-resp-row${assigned ? " is-assigned" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleRespuesta(r.texto_normalizado)}
                    aria-label={`${checked ? "Quitar" : "Agregar"} "${display.label}" ${esSM && activeGroup ? `del grupo activo ${grupoLabel(activeGroup)}` : assigned ? `del grupo ${grupo!.etiqueta || grupo!.codigo}` : "al grupo activo"}`}
                  />
                  <div className="pulso-cv2-resp-main">
                    <div className="pulso-cv2-resp-text" title={display.title}>
                      {display.code && <code className="pulso-cv2-resp-code">{display.code}</code>}
                      {display.label}
                    </div>
                    <div className="pulso-cv2-resp-meta">
                      <span><strong>{r.frecuencia}</strong> {r.frecuencia === 1 ? "vez" : "veces"}</span>
                      {r.variantes > 1 && <span>{r.variantes} variantes</span>}
                      {assigned && (
                        <span className="pulso-cv2-resp-assigned" title={assignedLabel}>
                          <ArrowRight size={10} /> {esSM && gruposAsignados.length > 1 ? `${gruposAsignados.length} categorías` : grupoLabel(grupo!)}
                        </span>
                      )}
                    </div>
                  </div>
                  {puedeAsignarRapido && (
                    <QuickAssignDropdown grupos={gruposDisponibles} respuesta={display.label} onPick={(gid) => moveToGroup(r.texto_normalizado, gid)} />
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
                  onAddRespuesta={(t) => {
                    if (g.respuestas.includes(t)) return;
                    updateGroup(g.id, { respuestas: [...g.respuestas, t] });
                    announce(`"${respuestaLabel(t)}" agregada a ${grupoLabel(g)}.`);
                  }}
                  onMoveUp={() => moveGroup(g.id, "up")}
                  onMoveDown={() => moveGroup(g.id, "down")}
                  isFirst={idx === 0}
                  isLast={idx === grupos.length - 1}
                  allowMultiAssign={esSM}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function QuickAssignDropdown({ grupos, respuesta, onPick }: { grupos: Grupo[]; respuesta: string; onPick: (gid: string) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);
  const menuId = useMemo(() => `qa-${Math.random().toString(36).slice(2)}`, []);

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

  useEffect(() => {
    if (open) firstItemRef.current?.focus();
  }, [open]);

  function focusSibling(current: HTMLElement, direction: 1 | -1) {
    const items = Array.from(rootRef.current?.querySelectorAll<HTMLButtonElement>("[role='menuitem']:not(:disabled)") ?? []);
    if (!items.length) return;
    const idx = items.indexOf(current as HTMLButtonElement);
    const next = items[(idx + direction + items.length) % items.length];
    next?.focus();
  }

  return (
    <div ref={rootRef} className="pulso-cv2-qa">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? menuId : undefined}
        aria-label={`Asignar "${respuesta}" a un grupo existente`}
        className={`pulso-cv2-qa-btn${open ? " is-open" : ""}`}
        title="Asignar a grupo existente"
      >
        <ListPlus size={11} />
        <span>asignar</span>
        <ChevronDown size={9} className="pulso-cv2-qa-caret" />
      </button>
      {open && (
        <div id={menuId} role="menu" className="pulso-cv2-qa-menu" aria-label={`Grupos para asignar "${respuesta}"`}>
          {grupos.length === 0 && (
            <div className="pulso-cv2-qa-empty">Todavía no hay grupos creados.</div>
          )}
          {grupos.map((g, idx) => {
            const display = displayCodificacionValueLabel(g.codigo, g.etiqueta);
            return (
              <button
                key={g.id}
                ref={idx === 0 ? firstItemRef : undefined}
                type="button"
                role="menuitem"
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    focusSibling(e.currentTarget, 1);
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    focusSibling(e.currentTarget, -1);
                  } else if (e.key === "Home") {
                    e.preventDefault();
                    firstItemRef.current?.focus();
                  } else if (e.key === "End") {
                    e.preventDefault();
                    const items = rootRef.current?.querySelectorAll<HTMLButtonElement>("[role='menuitem']:not(:disabled)");
                    items?.[items.length - 1]?.focus();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    setOpen(false);
                  }
                }}
                onClick={(e) => { e.stopPropagation(); onPick(g.id); setOpen(false); }}
                className="pulso-cv2-qa-item"
                title={display.title}
              >
                {display.code && <strong>{display.code}</strong>} {display.label || <em className="pulso-cv2-qa-unnamed">sin nombre</em>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
