import { GlidingRadioGroup } from "../../../../components/GlidingRadioGroup";
import type { ExplorarFuente } from "../../../../api/validacion";

const OPCIONES: readonly { valor: ExplorarFuente; etiqueta: string }[] = [
  { valor: "raw", etiqueta: "Antes de limpieza" },
  { valor: "final", etiqueta: "Después" },
];

/**
 * Momento de las respuestas: tal como se cargaron o tras Limpieza. «Después»
 * queda deshabilitado (con el porqué en el title) hasta que Limpieza se cierre.
 */
export default function FuenteToggle({
  fuente,
  onChange,
  hasFinal,
  finalizedAt,
}: {
  fuente: ExplorarFuente;
  onChange: (f: ExplorarFuente) => void;
  hasFinal: boolean;
  finalizedAt: string | null;
}) {
  const cerradaEl = (() => {
    if (!finalizedAt) return null;
    const d = new Date(finalizedAt);
    return Number.isNaN(d.getTime()) ? null : d.toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short" });
  })();
  return (
    <>
      <GlidingRadioGroup
        value={fuente}
        options={OPCIONES}
        getOptionValue={(o) => o.valor}
        onValueChange={(v) => {
          if (v === "final" && !hasFinal) return;
          onChange(v);
        }}
        className="vx-seg"
        aria-label="Momento de respuestas del explorador"
        getOptionProps={(o) => ({
          disabled: o.valor === "final" && !hasFinal,
          title:
            o.valor === "raw"
              ? "Respuestas tal como se cargaron. Útil para detectar errores."
              : hasFinal
                ? "Respuestas tras aplicar todas las decisiones de Limpieza."
                : "Cierra Limpieza primero para habilitar este modo.",
        })}
      >
        {(o) => <span>{o.etiqueta}</span>}
      </GlidingRadioGroup>
      {fuente === "final" && cerradaEl && <span className="vx-barra-nota">Cerrada el {cerradaEl}</span>}
    </>
  );
}
