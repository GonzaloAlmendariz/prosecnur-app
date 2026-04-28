import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronRight, ListChecks } from "lucide-react";
import {
  apiAnaliticaDimensionesDetect,
  apiAnaliticaVariables,
  DimensionesEscalaDetectada,
  VariableInstrumento,
} from "../../../../api/client";
import { LoadingBlock } from "../../../../components/States";
import { ListaMappingEditor } from "../shared/ListaMappingEditor";
import { useDimensionesWizardStore } from "../store";

// Step 2 — Listas evaluativas. Escaneamos el instrumento y mostramos
// las listas que parecen escalas (satisfacción, acuerdo, sí-no, …).
// Cada lista es un toggle row: el usuario marca cuáles tratar como
// escalas 0-100. El default activa todas las listas detectadas.

const NOMBRES_HUMANOS: Record<string, string> = {
  satisfaccion: "Satisfacción",
  acuerdo: "Acuerdo",
  oportunidad: "Oportunidad",
  info_disponible: "Información disponible",
  flex_horario: "Flexibilidad de horario",
  canales: "Canales de atención",
  prioridad: "Prioridad",
  acceso_local: "Acceso al local",
  senal: "Señalización",
  si_parcial_no: "Sí / Parcial / No",
  si_masmenos_no: "Sí / Más o menos / No",
  equip: "Equipamiento",
  si_nosabe: "Sí / No / No sabe",
  parcialnosabe: "Parcial / No sabe",
  masmenosnosabe: "Más o menos / No sabe",
  recomendable: "Recomendable",
  recuerda_parcialnosabe: "Recuerda / Parcial / No sabe",
  recuerda_masmenosnosabe: "Recuerda / Más o menos / No sabe",
  si_no: "Sí / No",
};

export function Step2_ListasEvaluativas() {
  const draft = useDimensionesWizardStore((s) => s.draft);
  const setListasObjetivo = useDimensionesWizardStore((s) => s.setListasObjetivo);

  const [escalas, setEscalas] = useState<DimensionesEscalaDetectada[] | null>(null);
  const [variables, setVariables] = useState<VariableInstrumento[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    // Cargar variables del instrumento en paralelo para mostrar labels
    // humanos de las preguntas dentro del editor de cada lista.
    apiAnaliticaVariables()
      .then((r) => {
        if (!cancelled) setVariables(r.variables);
      })
      .catch(() => {
        /* tolerante */
      });
    apiAnaliticaDimensionesDetect()
      .then((r) => {
        if (cancelled) return;
        setEscalas(r.escalas);
        // Default si el draft está vacío:
        //   1. Si hay listas marcadas como "default evaluativa estándar"
        //      (satisfaccion, acuerdo, si_no, …), las pre-marcamos.
        //   2. Si NO hay defaults pero sí hay listas detectadas (estudios
        //      con nombres custom), no pre-marcamos nada — el usuario
        //      elige conscientemente cuáles son evaluativas.
        if (draft.listas_objetivo.length === 0 && r.escalas.length > 0) {
          const defaults = r.escalas
            .filter((e) => e.es_default_evaluativa)
            .map((e) => e.list_name);
          if (defaults.length > 0) {
            setListasObjetivo(defaults);
          }
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError((e as Error).message);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const seleccionadas = useMemo(
    () => new Set(draft.listas_objetivo),
    [draft.listas_objetivo],
  );

  // Expansión inline: cuál lista tiene el editor de mapping abierto.
  // Solo una a la vez para mantener foco. Se auto-cierra al deseleccionar.
  const [expandida, setExpandida] = useState<string | null>(null);

  function toggle(listName: string) {
    if (seleccionadas.has(listName)) {
      setListasObjetivo(draft.listas_objetivo.filter((l) => l !== listName));
      if (expandida === listName) setExpandida(null);
    } else {
      setListasObjetivo([...draft.listas_objetivo, listName]);
    }
  }

  function toggleExpansion(listName: string) {
    setExpandida((cur) => (cur === listName ? null : listName));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <header>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>
          ¿Qué preguntas son evaluativas?
        </h2>
        <p
          style={{
            margin: "6px 0 0 0",
            fontSize: 13,
            color: "var(--pulso-text-soft)",
            lineHeight: 1.5,
            maxWidth: 720,
          }}
        >
          Mostramos todas las listas <code>select_one</code> que usa tu instrumento.
          Las marcadas como <strong>Estándar</strong> son escalas evaluativas
          reconocidas (satisfacción, acuerdo, sí-no, …) y vienen pre-activadas.
          Las marcadas como <strong>Custom</strong> son listas con nombres no
          estándar — actívalas si son evaluativas (no si son demográficas tipo
          sexo, edad, distrito).
        </p>
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

      {!escalas && !error && <LoadingBlock label="Escaneando instrumento…" />}

      {escalas && escalas.length === 0 && (
        <div
          style={{
            padding: 18,
            borderRadius: 10,
            border: "1px dashed var(--pulso-border)",
            background: "var(--pulso-surface)",
            textAlign: "center",
          }}
        >
          <ListChecks size={26} color="var(--pulso-text-soft)" />
          <p style={{ marginTop: 8, fontSize: 13 }}>
            Tu instrumento no tiene preguntas <code>select_one</code> con listas tipo
            escala estándar.
          </p>
          <p style={{ fontSize: 12, color: "var(--pulso-text-soft)" }}>
            Puedes seguir al siguiente paso, pero quizás no haya variables disponibles
            para asignar a bloques.
          </p>
        </div>
      )}

      {escalas && escalas.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[...escalas]
            .sort((a, b) => {
              // Listas estándar (GIZ-style) primero — el usuario las verá
              // arriba y reconoce más fácil. Las custom vienen después.
              if (a.es_default_evaluativa !== b.es_default_evaluativa) {
                return a.es_default_evaluativa ? -1 : 1;
              }
              return a.list_name.localeCompare(b.list_name);
            })
            .map((e, i) => {
            const activa = seleccionadas.has(e.list_name);
            const expand = expandida === e.list_name;
            const tieneChoices = e.choices && e.choices.length > 0;
            return (
              <div
                key={e.list_name}
                style={{
                  borderRadius: 10,
                  border: `2px solid ${activa ? "var(--pulso-primary)" : "var(--pulso-border)"}`,
                  background: activa ? "var(--pulso-primary-soft)" : "white",
                  animation: `pulso-lens-slide-in-kf var(--anim-dur-med) var(--anim-ease-expressive) both`,
                  animationDelay: `${i * 40}ms`,
                  transition:
                    "background var(--anim-dur-short), border-color var(--anim-dur-short)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "12px 16px",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => toggle(e.list_name)}
                    aria-pressed={activa}
                    aria-label={`Activar lista ${e.list_name}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      background: activa ? "var(--pulso-primary)" : "white",
                      color: activa ? "white" : "var(--pulso-text-soft)",
                      border: `1px solid ${activa ? "var(--pulso-primary)" : "var(--pulso-border)"}`,
                      flexShrink: 0,
                      cursor: "pointer",
                      padding: 0,
                      transition: "background var(--anim-dur-short)",
                    }}
                  >
                    {activa && <Check size={14} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => (activa ? toggleExpansion(e.list_name) : toggle(e.list_name))}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      textAlign: "left",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--pulso-text)" }}>
                        {NOMBRES_HUMANOS[e.list_name] ?? e.list_name}
                      </span>
                      {e.es_default_evaluativa ? (
                        <span
                          title="Lista evaluativa estándar reconocida automáticamente"
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: 0.4,
                            padding: "2px 6px",
                            borderRadius: 999,
                            background: "var(--pulso-success-bg, #f0fdf4)",
                            color: "var(--pulso-success-fg, #15803d)",
                            border: "1px solid var(--pulso-success-border, #86efac)",
                          }}
                        >
                          Estándar
                        </span>
                      ) : (
                        <span
                          title="Lista del instrumento que no coincide con escalas evaluativas conocidas. Decide si es evaluativa o no (ej. demográfica)."
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: 0.4,
                            padding: "2px 6px",
                            borderRadius: 999,
                            background: "var(--pulso-surface-2, #f4f5f9)",
                            color: "var(--pulso-text-soft)",
                            border: "1px solid var(--pulso-border)",
                          }}
                        >
                          Custom
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", marginTop: 2 }}>
                      <code>{e.list_name}</code> · {e.n}{" "}
                      {e.n === 1 ? "pregunta" : "preguntas"}
                      {tieneChoices && (
                        <span>
                          {" "}
                          · {e.choices.length} opciones de respuesta
                        </span>
                      )}
                    </div>
                  </button>
                  {activa && tieneChoices && (
                    <button
                      type="button"
                      onClick={() => toggleExpansion(e.list_name)}
                      aria-expanded={expand}
                      aria-label={expand ? "Cerrar editor" : "Editar mapeo 0-100"}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "5px 10px",
                        borderRadius: 6,
                        border: "1px solid var(--pulso-border)",
                        background: "white",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--pulso-text)",
                        cursor: "pointer",
                      }}
                    >
                      {expand ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      {expand ? "Cerrar" : "Ver mapeo"}
                    </button>
                  )}
                </div>
                {activa && expand && tieneChoices && (
                  <div style={{ padding: "0 16px 14px" }}>
                    <ListaMappingEditor
                      lista={e.list_name}
                      choicesDetectadas={e.choices}
                      vars={e.vars}
                      variablesInstrumento={variables}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <details
        style={{
          marginTop: 8,
          padding: "10px 14px",
          borderRadius: 8,
          background: "var(--pulso-surface-2, #f4f5f9)",
          fontSize: 12,
        }}
      >
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>
          Códigos especiales (avanzado)
        </summary>
        <p style={{ marginTop: 8, color: "var(--pulso-text-soft)", lineHeight: 1.5 }}>
          Tratamos los códigos <code>{draft.codigos_missing.join(", ")}</code> como
          missing por default. Estos valores se mapean a NA en lugar de aparecer en la
          escala 0-100.
        </p>
      </details>
    </div>
  );
}
