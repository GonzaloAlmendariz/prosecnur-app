import { ListOrdered, Shuffle, Wand2 } from "lucide-react";
import { useAnaliticaStore } from "../store";

// Control "¿Es una lista ordinal?" para UN `list_name`.
//
// Persiste el override explícito en `config.listas_ordinales[list_name]`
// (contrato compartido con el backend):
//   • "Automático" → borra la clave → vale la auto-detección (`list_ordinal_auto`).
//   • "Ordinal"    → setListaOrdinal(true).
//   • "Nominal"    → setListaOrdinal(false).
// El backend hace el ordenamiento real: una lista efectivamente ordinal
// conserva su orden fijo aunque se elija "Más frecuentes" en las tablas.

type OrdinalMode = "auto" | "ordinal" | "nominal";

const OPTIONS: { k: OrdinalMode; label: string; hint: string; icon: React.ReactNode }[] = [
  { k: "auto", label: "Automático", hint: "Usa la detección del sistema", icon: <Wand2 size={13} /> },
  { k: "ordinal", label: "Ordinal", hint: "Orden fijo (escalas, Likert)", icon: <ListOrdered size={13} /> },
  { k: "nominal", label: "Nominal", hint: "Se puede ordenar por frecuencia", icon: <Shuffle size={13} /> },
];

export function ListaOrdinalToggle({
  listName,
  ordinalAuto,
}: {
  listName: string;
  // Auto-detección del backend para esta lista (base del modo "Automático").
  ordinalAuto: boolean;
}) {
  const override = useAnaliticaStore((s) => s.config.listas_ordinales[listName]);
  const setListaOrdinal = useAnaliticaStore((s) => s.setListaOrdinal);
  const clearListaOrdinal = useAnaliticaStore((s) => s.clearListaOrdinal);

  const mode: OrdinalMode = override === undefined ? "auto" : override ? "ordinal" : "nominal";
  const efectivo = override === undefined ? ordinalAuto : override;

  function pick(next: OrdinalMode) {
    if (next === "auto") clearListaOrdinal(listName);
    else setListaOrdinal(listName, next === "ordinal");
  }

  return (
    <div className="analitica-orden-ordinal">
      <div className="analitica-orden-ordinal-head">
        <span className="analitica-orden-ordinal-title">¿Es una lista ordinal?</span>
        <div className="analitica-segmented" role="group" aria-label="Tipo de lista: ordinal o nominal">
          {OPTIONS.map((o) => (
            <button
              key={o.k}
              type="button"
              onClick={() => pick(o.k)}
              className={mode === o.k ? "is-on" : undefined}
              aria-pressed={mode === o.k}
              title={o.hint}
            >
              <span className="analitica-inline-title">
                {o.icon}
                {o.label}
              </span>
            </button>
          ))}
        </div>
      </div>
      <p className="analitica-orden-ordinal-hint">
        {mode === "auto" && (
          <>
            Detección automática: <strong>{ordinalAuto ? "ordinal" : "nominal"}</strong>.{" "}
          </>
        )}
        {efectivo
          ? "Las listas ordinales mantienen su orden fijo aunque elijas “Más frecuentes” en las tablas."
          : "Las listas nominales sí se reordenan por frecuencia cuando eliges “Más frecuentes”."}
      </p>
    </div>
  );
}
