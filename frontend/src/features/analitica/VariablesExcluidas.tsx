import { useState } from "react";
import { EyeOff, Plus, X } from "lucide-react";
import { VariableInstrumento } from "../../api/client";
import { useAnaliticaStore } from "./store";
import { VariableSelect } from "./VariableSelect";
import { Collapsible } from "./PaneKit";

// Bucket global de variables que se excluyen de Codebook y Frecuencias.
// Codebook.vs y Frecuencias.vs comparten este mismo bucket: editar desde
// cualquiera de los dos panes refleja en el otro. Útil para limpiar
// reportes de variables técnicas, metadata u otras que no aportan al
// análisis (p. ej. `_uuid`, `deviceid`, `start`, timestamps, etc.).

export function VariablesExcluidas({ variables }: { variables: VariableInstrumento[] }) {
  const excluidas = useAnaliticaStore((s) => s.config.variables_excluidas);
  const toggleVariableExcluida = useAnaliticaStore((s) => s.toggleVariableExcluida);
  const setExcluidas = useAnaliticaStore((s) => s.setVariablesExcluidas);

  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState("");

  function commit() {
    if (pending && !excluidas.includes(pending)) toggleVariableExcluida(pending);
    setPending("");
    setAdding(false);
  }

  const summary =
    excluidas.length === 0
      ? "ninguna"
      : excluidas.length === 1
      ? "1 variable excluida"
      : `${excluidas.length} variables excluidas`;

  return (
    <Collapsible title="Variables excluidas del reporte" summary={summary} defaultOpen={excluidas.length > 0}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.5 }}>
          Las variables listadas aquí se omiten tanto del <strong>Libro de códigos</strong> como de <strong>Frecuencias</strong>.
          La selección se sincroniza entre ambos panes. No afecta a Cruces ni Enumeradores.
        </div>

        {excluidas.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {excluidas.map((v) => {
              const meta = variables.find((x) => x.name === v);
              return (
                <span
                  key={v}
                  title={meta?.label}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "3px 4px 3px 10px", borderRadius: 999,
                    background: "var(--pulso-surface-2)",
                    border: "1px solid var(--pulso-border)",
                    fontSize: 11, fontFamily: "monospace", color: "var(--pulso-text-soft)",
                  }}
                >
                  <EyeOff size={10} />
                  {v}
                  <button
                    type="button"
                    onClick={() => toggleVariableExcluida(v)}
                    className="pulso-icon"
                    aria-label={`Quitar ${v}`}
                    style={{ minWidth: 16, minHeight: 16 }}
                  >
                    <X size={10} />
                  </button>
                </span>
              );
            })}
          </div>
        )}

        {adding ? (
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <VariableSelect
                variables={variables.filter((v) => !excluidas.includes(v.name))}
                value={pending}
                onChange={setPending}
                placeholder="Seleccionar variable a excluir…"
              />
            </div>
            <button
              type="button"
              className="pulso-primary"
              onClick={commit}
              disabled={!pending}
              style={{ fontSize: 12, padding: "6px 14px" }}
            >
              Excluir
            </button>
            <button
              type="button"
              onClick={() => { setAdding(false); setPending(""); }}
              style={{ fontSize: 12, padding: "6px 10px" }}
            >
              Cancelar
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setAdding(true)}
              style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              <Plus size={12} /> Excluir una variable
            </button>
            {excluidas.length > 0 && (
              <button type="button" onClick={() => setExcluidas([])} style={{ fontSize: 12 }}>
                Quitar todas
              </button>
            )}
          </div>
        )}
      </div>
    </Collapsible>
  );
}
