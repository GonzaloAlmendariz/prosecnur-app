import { Combine, Pencil, Sigma, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { VariableInstrumento } from "../../../../api/client";
import { useDimensionesWizardStore } from "../store";

// Panel para gestionar **subcriterios promediados** desde la sidebar
// del Step 3. Cada subcriterio combina 2+ preguntas crudas del XLSForm
// en un indicador derivado con nombre humano (ej. p17 + p17.1 →
// "Diligencia"). El sistema crea la columna `r100_<nombre>` al construir,
// promediando los valores 0-100 de sus fuentes.
//
// Estados:
//   • Vista lista — chips de subcriterios existentes + botón "Combinar".
//   • Modo edición — formulario con etiqueta, multi-select de vars,
//     botones Crear/Cancelar.
//
// El usuario armando desde cero descubre la funcionalidad al ver el
// botón "+ Combinar preguntas en un indicador" prominente arriba de la
// lista de variables disponibles.

type EditState =
  | { kind: "idle" }
  | {
      kind: "creating";
      etiqueta: string;
      seleccionadas: string[];
    }
  | {
      kind: "editing";
      nombreOriginal: string; // con prefijo
      etiqueta: string;
      // nombre crudo para mostrar / editar (sin prefijo)
      nombreSinPrefijo: string;
      seleccionadas: string[]; // vars crudas
    };

export function CombinarVarsPanel({
  variables,
  varsAsignablesPool,
}: {
  // Catálogo completo del instrumento.
  variables: VariableInstrumento[];
  // Pool de vars que se pueden incluir en un subcriterio (filtradas
  // típicamente por listas activas).
  varsAsignablesPool: string[];
}) {
  const draft = useDimensionesWizardStore((s) => s.draft);
  const agregarSubcriterio = useDimensionesWizardStore((s) => s.agregarSubcriterio);
  const actualizarSubcriterio = useDimensionesWizardStore((s) => s.actualizarSubcriterio);
  const eliminarSubcriterio = useDimensionesWizardStore((s) => s.eliminarSubcriterio);

  const [edit, setEdit] = useState<EditState>({ kind: "idle" });

  const prefijo = draft.prefijo || "r100_";

  // Vars que YA están dentro de algún otro subcriterio (no las
  // ofrecemos al crear uno nuevo, salvo que estemos editando ese mismo).
  const fuentesYaUsadas = useMemo(() => {
    const s = new Set<string>();
    draft.subcriterios.forEach((sc) => {
      const editandoEste =
        edit.kind === "editing" && edit.nombreOriginal === sc.nombre;
      if (editandoEste) return;
      sc.fuente.forEach((f) => {
        const sin = f.replace(new RegExp(`^${prefijo}`), "");
        s.add(sin);
        s.add(f);
      });
    });
    return s;
  }, [draft.subcriterios, edit, prefijo]);

  // Vars candidatas para combinar: las del pool (listas activas) que
  // no estén ya dentro de otro subcriterio y existan en el instrumento.
  const candidatas = useMemo(() => {
    return variables.filter(
      (v) => varsAsignablesPool.includes(v.name) && !fuentesYaUsadas.has(v.name),
    );
  }, [variables, varsAsignablesPool, fuentesYaUsadas]);

  function iniciarCreacion() {
    setEdit({ kind: "creating", etiqueta: "", seleccionadas: [] });
  }

  function iniciarEdicion(nombre: string) {
    const sc = draft.subcriterios.find((s) => s.nombre === nombre);
    if (!sc) return;
    setEdit({
      kind: "editing",
      nombreOriginal: sc.nombre,
      nombreSinPrefijo: sc.nombre.replace(new RegExp(`^${prefijo}`), ""),
      etiqueta: sc.etiqueta ?? "",
      seleccionadas: sc.fuente.map((f) => f.replace(new RegExp(`^${prefijo}`), "")),
    });
  }

  function cancelar() {
    setEdit({ kind: "idle" });
  }

  function confirmar() {
    if (edit.kind === "idle") return;
    const fuentes = edit.seleccionadas;
    if (fuentes.length < 2) return;
    const etiquetaLimpia = edit.etiqueta.trim();
    if (!etiquetaLimpia) return;

    // Generamos un nombre técnico desde la etiqueta o desde las fuentes
    // (e.g. "p17_prom" si vienen p17 + p17.1). Si el usuario está
    // editando, mantenemos el nombre original.
    let nombreTecnico: string;
    if (edit.kind === "editing") {
      nombreTecnico = edit.nombreSinPrefijo;
    } else {
      // Heurística: si todas las fuentes comparten un prefijo (p17,
      // p17.1) → "<prefijo común>_prom". Si no, slug del label.
      const comun = prefijoComun(fuentes);
      nombreTecnico = comun
        ? `${comun}_prom`
        : etiquetaToSlug(etiquetaLimpia);
    }

    if (edit.kind === "editing") {
      actualizarSubcriterio(edit.nombreOriginal, {
        nombre: nombreTecnico,
        etiqueta: etiquetaLimpia,
        fuente: fuentes,
      });
    } else {
      agregarSubcriterio(nombreTecnico, etiquetaLimpia, fuentes);
    }
    setEdit({ kind: "idle" });
  }

  function toggleSeleccion(name: string) {
    if (edit.kind === "idle") return;
    const ya = edit.seleccionadas.includes(name);
    setEdit({
      ...edit,
      seleccionadas: ya
        ? edit.seleccionadas.filter((v) => v !== name)
        : [...edit.seleccionadas, name],
    });
  }

  // Pool de vars visible en modo edición = candidatas (no usadas) +
  // las que ya están seleccionadas en este subcriterio (para que el
  // usuario las vea siempre).
  const poolEnEdicion: VariableInstrumento[] = useMemo(() => {
    if (edit.kind === "idle") return [];
    const ya = new Set(edit.seleccionadas);
    const fromCandidatas = candidatas;
    const fromYa = variables.filter((v) => ya.has(v.name) && !fromCandidatas.find((x) => x.name === v.name));
    return [...fromCandidatas, ...fromYa];
  }, [edit, candidatas, variables]);

  const subcriterios = draft.subcriterios;

  return (
    <div
      style={{
        marginBottom: 12,
        padding: 10,
        borderRadius: 8,
        background: "var(--pulso-surface-2, #f4f5f9)",
        border: "1px solid var(--pulso-border)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: subcriterios.length > 0 || edit.kind !== "idle" ? 8 : 0,
        }}
      >
        <Sigma size={11} color="var(--pulso-text-soft)" />
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 0.4,
            color: "var(--pulso-text-soft)",
            flex: 1,
          }}
        >
          Indicadores combinados ({subcriterios.length})
        </span>
        {edit.kind === "idle" && (
          <button
            type="button"
            onClick={iniciarCreacion}
            disabled={candidatas.length < 2}
            title={
              candidatas.length < 2
                ? "Necesitas al menos 2 preguntas disponibles para combinar"
                : "Combinar varias preguntas en un indicador único"
            }
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 8px",
              fontSize: 10,
              fontWeight: 600,
              borderRadius: 6,
              border: "1px solid var(--pulso-primary)",
              background: candidatas.length < 2 ? "var(--pulso-surface)" : "var(--pulso-primary)",
              color: candidatas.length < 2 ? "var(--pulso-text-soft)" : "white",
              cursor: candidatas.length < 2 ? "not-allowed" : "pointer",
              opacity: candidatas.length < 2 ? 0.6 : 1,
            }}
          >
            <Combine size={11} /> Combinar preguntas
          </button>
        )}
      </div>

      {/* Lista de subcriterios existentes (chips compactos) */}
      {edit.kind === "idle" && subcriterios.length > 0 && (
        <ul
          style={{
            margin: 0,
            padding: 0,
            listStyle: "none",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {subcriterios.map((sc) => {
            const fuentesSinPrefijo = sc.fuente.map((f) =>
              f.replace(new RegExp(`^${prefijo}`), ""),
            );
            return (
              <li
                key={sc.nombre}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "5px 8px",
                  borderRadius: 6,
                  background: "white",
                  border: "1px solid var(--pulso-primary-border, #c7d6ee)",
                  fontSize: 11,
                }}
              >
                <Sigma size={11} color="var(--pulso-primary)" />
                <strong style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {sc.etiqueta || sc.nombre}
                </strong>
                <code
                  style={{
                    fontFamily: "ui-monospace, monospace",
                    fontSize: 10,
                    color: "var(--pulso-text-soft)",
                  }}
                  title={`avg(${fuentesSinPrefijo.join(", ")})`}
                >
                  avg({fuentesSinPrefijo.length})
                </code>
                <button
                  type="button"
                  onClick={() => iniciarEdicion(sc.nombre)}
                  aria-label="Editar indicador combinado"
                  title="Editar"
                  style={iconBtnStyle}
                >
                  <Pencil size={10} />
                </button>
                <button
                  type="button"
                  onClick={() => eliminarSubcriterio(sc.nombre)}
                  aria-label="Eliminar indicador combinado"
                  title="Eliminar"
                  style={iconBtnStyle}
                >
                  <Trash2 size={10} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {edit.kind === "idle" && subcriterios.length === 0 && candidatas.length >= 2 && (
        <p style={{ margin: "6px 0 0", fontSize: 10, color: "var(--pulso-text-soft)", lineHeight: 1.45 }}>
          Si una idea (ej. <em>"Diligencia"</em>) se mide con 2 preguntas (ej. <code>p17</code>{" "}
          + <code>p17.1</code>), combínalas en un indicador único antes de armar bloques.
        </p>
      )}

      {/* Modo creación / edición */}
      {edit.kind !== "idle" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
          <label
            style={{
              fontSize: 9,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 0.4,
              color: "var(--pulso-text-soft)",
            }}
          >
            Nombre del indicador
          </label>
          <input
            value={edit.etiqueta}
            onChange={(e) => setEdit({ ...edit, etiqueta: e.target.value })}
            placeholder="ej. Diligencia, Confort, Seguridad física"
            autoFocus
            style={{
              padding: "6px 10px",
              fontSize: 13,
              fontWeight: 600,
              border: "1px solid var(--pulso-primary)",
              borderRadius: 6,
              background: "white",
              outline: "none",
            }}
          />

          <label
            style={{
              fontSize: 9,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 0.4,
              color: "var(--pulso-text-soft)",
              marginTop: 2,
            }}
          >
            Preguntas a promediar ({edit.seleccionadas.length} elegidas)
          </label>
          <div
            style={{
              maxHeight: 220,
              overflowY: "auto",
              border: "1px solid var(--pulso-border)",
              borderRadius: 6,
              background: "white",
              padding: 6,
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            {poolEnEdicion.length === 0 ? (
              <p style={{ margin: 0, padding: 8, fontSize: 11, color: "var(--pulso-text-soft)" }}>
                No hay preguntas disponibles para combinar.
              </p>
            ) : (
              poolEnEdicion.map((v) => {
                const checked = edit.seleccionadas.includes(v.name);
                return (
                  <label
                    key={v.name}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 6,
                      padding: "4px 6px",
                      borderRadius: 4,
                      cursor: "pointer",
                      background: checked ? "var(--pulso-primary-soft)" : "transparent",
                      transition: "background var(--anim-dur-short)",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSeleccion(v.name)}
                      style={{ marginTop: 2 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>
                        {v.label || v.name}
                      </div>
                      <code
                        style={{
                          fontFamily: "ui-monospace, monospace",
                          fontSize: 10,
                          color: "var(--pulso-text-soft)",
                        }}
                      >
                        {v.name}
                      </code>
                    </div>
                  </label>
                );
              })
            )}
          </div>

          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            <button
              type="button"
              onClick={cancelar}
              style={{
                padding: "6px 12px",
                fontSize: 12,
                borderRadius: 6,
                border: "1px solid var(--pulso-border)",
                background: "white",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <X size={12} /> Cancelar
            </button>
            <button
              type="button"
              onClick={confirmar}
              disabled={edit.seleccionadas.length < 2 || !edit.etiqueta.trim()}
              className="pulso-primary"
              style={{
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 600,
                flex: 1,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
              }}
            >
              <Combine size={12} />
              {edit.kind === "editing" ? "Guardar cambios" : "Crear indicador"}
            </button>
          </div>
          {edit.seleccionadas.length < 2 && (
            <p style={{ margin: 0, fontSize: 10, color: "var(--pulso-warn-fg, #b45309)" }}>
              Necesitas al menos 2 preguntas para promediar.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Encuentra el prefijo común más largo entre vars (case-sensitive,
// excluyendo separadores). Ej. ["p17", "p17.1"] → "p17". Útil para
// auto-nombrar el subcriterio (`p17_prom`).
function prefijoComun(vars: string[]): string {
  if (vars.length === 0) return "";
  let pref = vars[0];
  for (const v of vars.slice(1)) {
    let i = 0;
    while (i < pref.length && i < v.length && pref[i] === v[i]) i++;
    pref = pref.slice(0, i);
  }
  // Quitar separadores trailing
  return pref.replace(/[._\-]+$/, "");
}

function etiquetaToSlug(etiqueta: string): string {
  return etiqueta
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const iconBtnStyle: React.CSSProperties = {
  border: "none",
  background: "transparent",
  cursor: "pointer",
  padding: 2,
  borderRadius: 3,
  color: "var(--pulso-text-soft)",
};
