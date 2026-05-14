import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { IconAI } from "../../../../lib/icons";
import { useEffect, useMemo, useState } from "react";
import {
  apiAnaliticaDimensionesSugerir,
  apiAnaliticaVariables,
  VariableInstrumento,
} from "../../../../api/client";
import { LoadingBlock } from "../../../../components/States";
import { BloqueCard } from "../shared/BloqueCard";
import { CombinarVarsPanel } from "../shared/CombinarVarsPanel";
import { stripPrefijo, variantesNombre } from "../shared/displayVar";
import { VariableMeta, VariablePill } from "../shared/VariablePill";
import { useDimensionesWizardStore } from "../store";

// Step 3 — Asignar variables a bloques temáticos vía drag-drop.
//
// Layout: sidebar izquierdo con todas las variables disponibles (que
// usan listas evaluativas marcadas en step 2), y centro/derecha con
// las cards de bloques. Drag de pill → bloque. Cada bloque también
// puede tener pills internas que se arrastran a otro bloque.
//
// Botón "Sugerir desde el instrumento" invoca el backend que detecta
// begin_group/end_group y propone bloques iniciales.

export function Step3_Bloques() {
  const draft = useDimensionesWizardStore((s) => s.draft);
  const setBloques = useDimensionesWizardStore((s) => s.setBloques);
  const asignarVarABloque = useDimensionesWizardStore((s) => s.asignarVarABloque);
  const desasignarVar = useDimensionesWizardStore((s) => s.desasignarVar);
  const setLabelIndicador = useDimensionesWizardStore((s) => s.setLabelIndicador);
  const freshVars = useDimensionesWizardStore((s) => s.freshVars);
  const freshBloques = useDimensionesWizardStore((s) => s.freshBloques);
  const varsFaltantesJson = useDimensionesWizardStore((s) => s.varsFaltantesJson);

  const [variables, setVariables] = useState<VariableInstrumento[] | null>(null);
  const [error, setError] = useState("");
  const [busySugerir, setBusySugerir] = useState(false);
  // Bloque recién creado al que hay que auto-enfocar el input "etiqueta".
  // Lo limpiamos tras un tick para que no se re-enfoque en re-renders.
  const [bloqueAFocus, setBloqueAFocus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiAnaliticaVariables()
      .then((r) => {
        if (!cancelled) setVariables(r.variables);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError((e as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Mapa nombre → meta (para que las pills muestren label humano).
  // Acepta búsqueda por nombre crudo (`p12`) y por nombre prefijado
  // (`r100_p12`). Orden de prioridad para el label visible:
  //   1. `labels_indicadores` (etiqueta corta canónica, ej. "Confort")
  //   2. Etiqueta del subcriterio (para vars derivadas)
  //   3. Label largo del instrumento (texto de la pregunta completa)
  //   4. Fallback al nombre crudo
  const prefijo = draft.prefijo || "r100_";
  const varsMeta: Record<string, VariableMeta> = useMemo(() => {
    const m: Record<string, VariableMeta> = {};
    const labelCanonical = (rawName: string, prefName: string): string | undefined =>
      draft.labels_indicadores[rawName] ?? draft.labels_indicadores[prefName];

    // 1) Vars crudas del instrumento, ambas con y sin prefijo.
    (variables ?? []).forEach((v) => {
      const prefName = `${prefijo}${v.name}`;
      const labelFinal = labelCanonical(v.name, prefName) ?? v.label;
      m[v.name] = { name: v.name, label: labelFinal, seccion: v.list_name };
      m[prefName] = { name: prefName, label: labelFinal, seccion: v.list_name };
    });
    // 2) Subcriterios promediados con su etiqueta humana (también pueden
    //    tener override en labels_indicadores).
    draft.subcriterios.forEach((sc) => {
      const sinPrefijo = sc.nombre.replace(new RegExp(`^${prefijo}`), "");
      const labelFinal =
        labelCanonical(sinPrefijo, sc.nombre) ?? sc.etiqueta ?? sinPrefijo;
      const meta: VariableMeta = {
        name: sc.nombre,
        label: labelFinal,
        seccion: "subcriterio promediado",
      };
      m[sc.nombre] = meta;
      m[sinPrefijo] = { ...meta, name: sinPrefijo };
    });
    // 3) Vars del JSON sin coincidencia: igual aparecen como pill ⚠.
    varsFaltantesJson.forEach((v) => {
      if (!m[v]) m[v] = { name: v, label: v };
    });
    return m;
  }, [variables, varsFaltantesJson, draft.subcriterios, draft.labels_indicadores, prefijo]);

  // Variables disponibles para arrastrar = las que usan listas marcadas
  // en step 2, que aún no están asignadas a ningún bloque y no son fuente
  // de un subcriterio (porque ya viajan combinadas).
  const listasActivas = new Set(draft.listas_objetivo);
  const asignadas = new Set(
    draft.subindices.flatMap((b) =>
      b.vars.flatMap((v) => {
        const { conPrefijo, sinPrefijo } = variantesNombre(v, prefijo);
        return [conPrefijo, sinPrefijo];
      }),
    ),
  );
  // Vars que están dentro de algún subcriterio promediado: se ocultan
  // del pool — viajan al bloque dentro del indicador combinado.
  const fuentesDeSubcriterios = new Set(
    draft.subcriterios.flatMap((sc) =>
      sc.fuente.flatMap((f) => {
        const { conPrefijo, sinPrefijo } = variantesNombre(f, prefijo);
        return [conPrefijo, sinPrefijo];
      }),
    ),
  );
  const candidatasRaw = (variables ?? []).filter(
    (v) =>
      v.tipo === "select_one" &&
      listasActivas.has(v.list_name) &&
      !asignadas.has(v.name) &&
      !fuentesDeSubcriterios.has(v.name),
  );
  // Pool para combinar: TODAS las vars que usan listas activas (incluso
  // si ya están en subcriterios — el panel de combinar las maneja con
  // exclusión local). Para drag, solo las realmente disponibles.
  const varsAsignablesPool = (variables ?? [])
    .filter((v) => v.tipo === "select_one" && listasActivas.has(v.list_name))
    .map((v) => v.name);

  // Subcriterios "disponibles" = los que aún no están en ningún bloque.
  const subcriteriosCandidatos = draft.subcriterios.filter((sc) => {
    return !asignadas.has(sc.nombre) && !asignadas.has(stripPrefijo(sc.nombre, prefijo));
  });

  // Set de nombres de subcriterios (con y sin prefijo) para que las pills
  // dentro de bloques se pinten con variant esCombinado.
  const varsCombinadasSet = new Set(
    draft.subcriterios.flatMap((sc) => {
      const { conPrefijo, sinPrefijo } = variantesNombre(sc.nombre, prefijo);
      return [conPrefijo, sinPrefijo];
    }),
  );

  const faltantesSet = new Set(varsFaltantesJson);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeData = active.data.current as { kind: string; name: string } | undefined;
    const overData = over.data.current as { kind: string; nombre: string } | undefined;
    if (!activeData || activeData.kind !== "variable") return;
    if (!overData || overData.kind !== "bloque") return;
    asignarVarABloque(activeData.name, overData.nombre);
  }

  function agregarBloque() {
    const idx = draft.subindices.length + 1;
    const nombre = `bloque_${idx}`;
    setBloques([
      ...draft.subindices,
      { nombre, etiqueta: "", vars: [] },
    ]);
    // Auto-focus al input del nuevo bloque para que el usuario nombre
    // el bloque inmediatamente — sin tener que descubrir que es editable.
    setBloqueAFocus(nombre);
    window.setTimeout(() => setBloqueAFocus(null), 100);
  }

  async function sugerirDesdeInstrumento() {
    setBusySugerir(true);
    try {
      const r = await apiAnaliticaDimensionesSugerir();
      // Mergear con bloques actuales: si un bloque sugerido tiene el
      // mismo nombre que uno existente, NO sobrescribimos (preservamos
      // ediciones del usuario). Solo agregamos los nuevos.
      const existentes = new Set(draft.subindices.map((b) => b.nombre));
      const nuevos = r.bloques.filter((b) => !existentes.has(b.nombre));
      setBloques([...draft.subindices, ...nuevos]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusySugerir(false);
    }
  }

  function eliminarBloque(nombre: string) {
    setBloques(draft.subindices.filter((b) => b.nombre !== nombre));
  }

  function renombrarBloque(nombre: string, etiqueta: string) {
    setBloques(draft.subindices.map((b) => (b.nombre === nombre ? { ...b, etiqueta } : b)));
  }

  if (!variables && !error) return <LoadingBlock label="Cargando variables del instrumento…" />;

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <header style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>
              Agrupa preguntas en bloques temáticos
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
              Arrastra cada variable de la izquierda a un bloque para definir su
              tema (Trato, Tiempo, Información, …). Cada bloque produce un{" "}
              <strong>sub-índice 0-100</strong> que es el promedio de sus variables.
            </p>
          </div>
          <button
            type="button"
            onClick={sugerirDesdeInstrumento}
            disabled={busySugerir}
            className="pulso-secondary"
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <IconAI size={13} />
            {busySugerir ? "Sugiriendo…" : "Sugerir desde el instrumento"}
          </button>
        </header>

        {error && (
          <div
            role="alert"
            style={{
              padding: 12,
              borderRadius: 8,
              border: "1px solid var(--pulso-danger-border)",
              background: "var(--pulso-danger-bg)",
              color: "var(--pulso-danger-fg)",
              fontSize: 12,
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(220px, 280px) 1fr",
            gap: 18,
            alignItems: "start",
          }}
        >
          {/* Sidebar de variables disponibles */}
          <aside
            aria-label="Variables disponibles"
            style={{
              padding: 12,
              borderRadius: 12,
              border: "1px solid var(--pulso-border)",
              background: "var(--pulso-surface)",
              maxHeight: 560,
              overflowY: "auto",
              position: "sticky",
              top: 90,
            }}
          >
            {/* Panel para gestionar indicadores combinados (subcriterios
                promediados). Aparece arriba para que sea descubrible al
                armar desde cero. */}
            <CombinarVarsPanel
              variables={variables ?? []}
              varsAsignablesPool={varsAsignablesPool}
            />

            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 0.4,
                color: "var(--pulso-text-soft)",
                marginBottom: 8,
              }}
            >
              Preguntas disponibles ({candidatasRaw.length + subcriteriosCandidatos.length})
            </div>
            {candidatasRaw.length === 0 && subcriteriosCandidatos.length === 0 ? (
              <SidebarEmptyState
                hayListasActivas={listasActivas.size > 0}
                hayVarsAsignadas={asignadas.size > 0}
                hayVariablesEnInstrumento={(variables ?? []).length > 0}
              />
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {/* Subcriterios combinados primero — son los más complejos
                    y queremos que el usuario los vea de inmediato. */}
                {subcriteriosCandidatos.map((sc) => {
                  const labelHumano =
                    draft.labels_indicadores[sc.nombre] ??
                    draft.labels_indicadores[stripPrefijo(sc.nombre, prefijo)] ??
                    sc.etiqueta ??
                    stripPrefijo(sc.nombre, prefijo);
                  return (
                    <VariablePill
                      key={sc.nombre}
                      meta={{
                        name: sc.nombre,
                        label: labelHumano,
                        seccion: "indicador combinado",
                      }}
                      esCombinado
                      prefijo={prefijo}
                      fresh={!!freshVars[sc.nombre]}
                      editableLabel
                      onLabelChange={(next) => setLabelIndicador(sc.nombre, next)}
                    />
                  );
                })}
                {/* Preguntas crudas */}
                {candidatasRaw.map((v) => {
                  const labelHumano =
                    draft.labels_indicadores[`${prefijo}${v.name}`] ??
                    draft.labels_indicadores[v.name] ??
                    v.label;
                  return (
                    <VariablePill
                      key={v.name}
                      meta={{
                        name: v.name,
                        label: labelHumano,
                        seccion: v.list_name,
                      }}
                      prefijo={prefijo}
                      fresh={!!freshVars[v.name]}
                      editableLabel
                      onLabelChange={(next) => setLabelIndicador(v.name, next)}
                    />
                  );
                })}
              </div>
            )}
          </aside>

          {/* Bloques */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: 12,
              }}
            >
              {draft.subindices.map((b, i) => (
                <div
                  key={b.nombre}
                  style={{
                    animation: `pulso-lens-slide-in-kf var(--anim-dur-med) var(--anim-ease-expressive) both`,
                    animationDelay: `${i * 50}ms`,
                  }}
                >
                  <BloqueCard
                    nombre={b.nombre}
                    etiqueta={b.etiqueta}
                    vars={b.vars}
                    varsMeta={varsMeta}
                    fresh={!!freshBloques[b.nombre]}
                    varsFaltantes={faltantesSet}
                    autoFocusEtiqueta={bloqueAFocus === b.nombre}
                    prefijo={prefijo}
                    varsCombinadas={varsCombinadasSet}
                    onRenameEtiqueta={(nuevo) => renombrarBloque(b.nombre, nuevo)}
                    onDelete={() => eliminarBloque(b.nombre)}
                    onRemoveVar={desasignarVar}
                    onLabelVarChange={setLabelIndicador}
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={agregarBloque}
              className="pulso-secondary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "10px 14px",
                border: "1px dashed var(--pulso-border)",
                borderRadius: 10,
                background: "var(--pulso-surface)",
                cursor: "pointer",
                fontSize: 13,
                color: "var(--pulso-text-soft)",
              }}
            >
              <Plus size={14} /> Agregar bloque
            </button>
          </div>
        </div>
      </div>
    </DndContext>
  );
}

// Mensaje contextual para la sidebar cuando no hay variables. Distinguimos
// los 3 escenarios reales para guiar al usuario hacia el fix correcto.
function SidebarEmptyState({
  hayListasActivas,
  hayVarsAsignadas,
  hayVariablesEnInstrumento,
}: {
  hayListasActivas: boolean;
  hayVarsAsignadas: boolean;
  hayVariablesEnInstrumento: boolean;
}) {
  let titulo: string;
  let detalle: React.ReactNode;
  let tono: "ok" | "warn" = "warn";

  if (hayVarsAsignadas && hayListasActivas) {
    titulo = "Todo asignado";
    detalle = (
      <>
        Todas las variables ya están en algún bloque. Puedes arrastrarlas entre
        bloques para reorganizar.
      </>
    );
    tono = "ok";
  } else if (!hayListasActivas) {
    titulo = "No hay listas activas";
    detalle = (
      <>
        Vuelve al paso anterior (<strong>Listas</strong>) y activa al menos una
        lista evaluativa. Sin listas marcadas, no hay preguntas candidatas para
        agrupar en bloques.
      </>
    );
  } else if (!hayVariablesEnInstrumento) {
    titulo = "Instrumento vacío";
    detalle = (
      <>
        El proyecto no tiene un XLSForm cargado o la preparación de Analítica
        falló. Verifica la fase 1 (Carga) y la preparación del módulo.
      </>
    );
  } else {
    titulo = "Sin variables candidatas";
    detalle = (
      <>
        Las listas activas no tienen preguntas <code>select_one</code>{" "}
        asociadas. Revisa el paso anterior — quizá las listas que activaste
        no son evaluativas en este instrumento.
      </>
    );
  }

  const isOk = tono === "ok";
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 8,
        background: isOk
          ? "var(--pulso-success-bg, #f0fdf4)"
          : "var(--pulso-warn-bg, #fffbeb)",
        border: `1px solid ${
          isOk
            ? "var(--pulso-success-border, #86efac)"
            : "var(--pulso-warn-border, #fcd34d)"
        }`,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          marginBottom: 4,
          color: isOk
            ? "var(--pulso-success-fg, #15803d)"
            : "var(--pulso-warn-fg, #b45309)",
        }}
      >
        {titulo}
      </div>
      <p style={{ margin: 0, fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.5 }}>
        {detalle}
      </p>
    </div>
  );
}
