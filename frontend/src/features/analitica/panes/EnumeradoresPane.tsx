import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Users, X } from "lucide-react";
import { apiAnaliticaVariables, VariableInstrumento } from "../../../api/client";
import { Panel } from "../../../components/Panel";
import { useAnaliticaStore, ModalidadRegla } from "../store";

// Enumeradores — dropdowns para col_enumerador y col_modalidad (desde
// /variables), multiselect para cols_corte, tabla editable de
// modalidad_reglas, y campos simples de título/min/ordenar.

export function EnumeradoresPane() {
  const enumer = useAnaliticaStore((s) => s.config.enumeradores);
  const setEnumer = useAnaliticaStore((s) => s.setEnumeradores);

  const [variables, setVariables] = useState<VariableInstrumento[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const r = await apiAnaliticaVariables();
        setVariables(r.variables);
      } catch {/* no-op */}
    })();
  }, []);

  const varNames = useMemo(() => variables.map((v) => v.name), [variables]);

  function setCortes(next: string[]) {
    setEnumer({ cols_corte: next });
  }
  function toggleCorte(name: string) {
    setCortes(enumer.cols_corte.includes(name) ? enumer.cols_corte.filter((x) => x !== name) : [...enumer.cols_corte, name]);
  }

  function setReglas(next: ModalidadRegla[]) {
    setEnumer({ modalidad_reglas: next });
  }
  function addRegla() {
    setReglas([...enumer.modalidad_reglas, { patron: "", modalidad: "" }]);
  }
  function updateRegla(i: number, patch: Partial<ModalidadRegla>) {
    setReglas(enumer.modalidad_reglas.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function removeRegla(i: number) {
    setReglas(enumer.modalidad_reglas.filter((_, idx) => idx !== i));
  }

  return (
    <Panel
      eyebrow="Configuración"
      title={<span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Users size={14} /> Reporte de enumeradores</span>}
      hint="PDF con producción por enumerador, opcionalmente desagregada por corte (sexo, turno, distrito, etc.)."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Col enumerador */}
        <div>
          <div className="pulso-section-eyebrow" style={{ marginBottom: 4 }}>Columna que identifica al enumerador</div>
          <input
            list="vars-enum"
            type="text"
            value={enumer.col_enumerador}
            onChange={(e) => setEnumer({ col_enumerador: e.target.value })}
            placeholder="ej. Enumerator_name"
            style={{ width: "100%", maxWidth: 420, fontSize: 13, fontFamily: "monospace" }}
          />
          <datalist id="vars-enum">
            {varNames.map((n) => <option key={n} value={n} />)}
          </datalist>
        </div>

        {/* Cols corte */}
        <div>
          <div className="pulso-section-eyebrow" style={{ marginBottom: 6 }}>Columnas de corte (desagregación)</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
            {enumer.cols_corte.length === 0 && (
              <span style={{ fontSize: 11, color: "var(--pulso-text-soft)", fontStyle: "italic" }}>Ninguna — se reporta el total por enumerador.</span>
            )}
            {enumer.cols_corte.map((c) => (
              <span
                key={c}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "3px 4px 3px 10px", borderRadius: 999,
                  background: "var(--pulso-primary-soft)",
                  border: "1px solid var(--pulso-primary)",
                  fontSize: 11, fontFamily: "monospace", color: "var(--pulso-primary)",
                }}
              >
                {c}
                <button type="button" onClick={() => toggleCorte(c)} className="pulso-icon" aria-label={`Quitar ${c}`} style={{ minWidth: 16, minHeight: 16 }}>
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
          <input
            list="vars-all-corte"
            type="text"
            placeholder="Escribe para añadir (Enter)…"
            style={{ width: "100%", maxWidth: 420, fontSize: 13, fontFamily: "monospace" }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const v = (e.target as HTMLInputElement).value.trim();
                if (v && !enumer.cols_corte.includes(v)) toggleCorte(v);
                (e.target as HTMLInputElement).value = "";
                e.preventDefault();
              }
            }}
          />
          <datalist id="vars-all-corte">
            {varNames.map((n) => <option key={n} value={n} />)}
          </datalist>
        </div>

        {/* Col modalidad + default */}
        <div>
          <div className="pulso-section-eyebrow" style={{ marginBottom: 4 }}>Columna de modalidad (opcional)</div>
          <input
            list="vars-mod"
            type="text"
            value={enumer.col_modalidad ?? ""}
            onChange={(e) => setEnumer({ col_modalidad: e.target.value || undefined })}
            placeholder="ej. modalidad_encuesta"
            style={{ width: "100%", maxWidth: 420, fontSize: 13, fontFamily: "monospace" }}
          />
          <datalist id="vars-mod">
            {varNames.map((n) => <option key={n} value={n} />)}
          </datalist>
        </div>

        {/* Modalidad reglas (colapsable) */}
        <Collapsible title={`Reglas de modalidad (${enumer.modalidad_reglas.length})`} defaultOpen={enumer.modalidad_reglas.length > 0}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.4 }}>
              Cada regla mapea un <strong>patrón</strong> (ej. <code>TEL_*</code>) al nombre de una <strong>modalidad</strong>. Si una fila no matchea ninguna regla ni tiene valor en la columna de modalidad, se usa el default.
            </div>
            {enumer.modalidad_reglas.map((r, i) => (
              <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="text"
                  value={r.patron}
                  onChange={(e) => updateRegla(i, { patron: e.target.value })}
                  placeholder="patrón (glob, ej. TEL_*)"
                  style={{ flex: 1, fontSize: 13, fontFamily: "monospace" }}
                />
                <span style={{ color: "var(--pulso-text-soft)", fontSize: 12 }}>→</span>
                <input
                  type="text"
                  value={r.modalidad}
                  onChange={(e) => updateRegla(i, { modalidad: e.target.value })}
                  placeholder="modalidad"
                  style={{ flex: 1, fontSize: 13 }}
                />
                <button
                  type="button"
                  onClick={() => removeRegla(i)}
                  className="pulso-icon pulso-icon-danger"
                  title="Quitar regla"
                  aria-label="Quitar"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addRegla}
              style={{ alignSelf: "flex-start", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              <Plus size={12} /> Agregar regla
            </button>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 6 }}>
              <span className="pulso-section-eyebrow">Default</span>
              <input
                type="text"
                value={enumer.modalidad_default}
                onChange={(e) => setEnumer({ modalidad_default: e.target.value })}
                placeholder="Presencial"
                style={{ maxWidth: 180, fontSize: 13 }}
              />
            </div>
          </div>
        </Collapsible>

        {/* Modalidades esperadas + mostrar_vacias */}
        <div>
          <div className="pulso-section-eyebrow" style={{ marginBottom: 6 }}>Modalidades esperadas</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
            {enumer.modalidades_esperadas.map((m) => (
              <span
                key={m}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "3px 4px 3px 10px", borderRadius: 999,
                  background: "white",
                  border: "1px solid var(--pulso-border)",
                  fontSize: 11,
                }}
              >
                {m}
                <button type="button" onClick={() => setEnumer({ modalidades_esperadas: enumer.modalidades_esperadas.filter((x) => x !== m) })} className="pulso-icon" aria-label={`Quitar ${m}`} style={{ minWidth: 16, minHeight: 16 }}>
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
          <input
            type="text"
            placeholder="Añadir modalidad y Enter…"
            style={{ maxWidth: 280, fontSize: 13 }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const v = (e.target as HTMLInputElement).value.trim();
                if (v && !enumer.modalidades_esperadas.includes(v)) {
                  setEnumer({ modalidades_esperadas: [...enumer.modalidades_esperadas, v] });
                }
                (e.target as HTMLInputElement).value = "";
                e.preventDefault();
              }
            }}
          />
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", marginTop: 10 }}>
            <input
              type="checkbox"
              checked={enumer.mostrar_vacias}
              onChange={(e) => setEnumer({ mostrar_vacias: e.target.checked })}
            />
            <span>Mostrar modalidades esperadas sin encuestas</span>
          </label>
        </div>

        {/* Título + ordenar + min_encuestas */}
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 220 }}>
            <span className="pulso-section-eyebrow">Título del reporte</span>
            <input
              type="text"
              value={enumer.titulo}
              onChange={(e) => setEnumer({ titulo: e.target.value })}
              style={{ fontSize: 13 }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="pulso-section-eyebrow">Mínimo encuestas</span>
            <input
              type="number"
              value={enumer.min_encuestas}
              onChange={(e) => setEnumer({ min_encuestas: Number(e.target.value) || 0 })}
              min={0}
              style={{ width: 100, fontSize: 13 }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="pulso-section-eyebrow">Ordenar por</span>
            <select
              value={enumer.ordenar_por}
              onChange={(e) => setEnumer({ ordenar_por: e.target.value as "total" | "nombre" })}
              style={{ fontSize: 13, padding: "4px 8px" }}
            >
              <option value="total">Producción total</option>
              <option value="nombre">Nombre</option>
            </select>
          </label>
        </div>
      </div>
    </Panel>
  );
}

function Collapsible({ title, defaultOpen, children }: { title: string; defaultOpen: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: "1px solid var(--pulso-border)", borderRadius: 6, background: "var(--pulso-surface)" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%", textAlign: "left",
          padding: "8px 12px",
          display: "flex", alignItems: "center", gap: 6,
          background: "transparent", border: "none", cursor: "pointer",
          fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3,
          color: "var(--pulso-text-soft)",
        }}
        aria-expanded={open}
      >
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        {title}
      </button>
      {open && <div style={{ padding: "4px 14px 12px", background: "white" }}>{children}</div>}
    </div>
  );
}
