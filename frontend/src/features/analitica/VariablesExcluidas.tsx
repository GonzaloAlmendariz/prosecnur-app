import { useState } from "react";
import { EyeOff, Plus, X } from "lucide-react";
import { VariableInstrumento } from "../../api/client";
import { useAnaliticaStore } from "./store";
import { VariableSelect } from "./VariableSelect";

// Bucket global de variables que se excluyen de los entregables de
// análisis. Las bases exportadas conservan todas sus columnas. El contenedor padre (DefinicionGlobal) provee el
// colapsable; acá mostramos directamente chips + botones. Eso evita
// que el dropdown del VariableSelect quede clippeado por un ancestro
// con overflow:hidden.

export function VariablesExcluidas({ variables }: { variables: VariableInstrumento[] }) {
  const excluidas = useAnaliticaStore((s) => s.config.variables_excluidas);
  const numericasGlobal = useAnaliticaStore((s) => s.config.numericas);
  const numericasFrecuencias = useAnaliticaStore((s) => s.config.frecuencias.numericas_override);
  const toggleVariableExcluida = useAnaliticaStore((s) => s.toggleVariableExcluida);
  const setExcluidas = useAnaliticaStore((s) => s.setVariablesExcluidas);

  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState("");

  function commit() {
    if (pending && !excluidas.includes(pending)) toggleVariableExcluida(pending);
    setPending("");
    setAdding(false);
  }

  const numericas = numericasFrecuencias ?? numericasGlobal;
  const disponibles = variables.filter((v) => {
    if (excluidas.includes(v.name)) return false;
    return !!v.categorica || numericas.includes(v.name);
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {excluidas.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {excluidas.map((v) => {
            const meta = variables.find((x) => x.name === v);
            return (
              <span
                key={v}
                title={meta?.label || v}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "3px 5px 3px 10px", borderRadius: 999,
                  background: "var(--pulso-surface-2)",
                  border: "1px solid var(--pulso-border)",
                  fontSize: 11, fontFamily: "monospace", color: "var(--pulso-text-soft)",
                  lineHeight: 1.2,
                }}
              >
                <EyeOff size={11} />
                {v}
                <button
                  type="button"
                  onClick={() => toggleVariableExcluida(v)}
                  className="pulso-icon"
                  aria-label={`Quitar ${v} de las variables excluidas`}
                  style={{ minWidth: 20, minHeight: 20 }}
                >
                  <X size={11} />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {adding ? (
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <VariableSelect
              variables={disponibles}
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
  );
}
