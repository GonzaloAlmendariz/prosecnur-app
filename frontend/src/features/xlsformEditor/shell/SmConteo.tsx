import { useId } from "react";
import { AYUDA_CONTEO_SM, textoConteoSm } from "./smImportModel";

// El único par de conteos de la importación (U8): «26 preguntas · 74 campos».
// La ayuda dice qué es cada uno; con `ayuda="visible"` se lee debajo, con
// `ayuda="titulo"` queda en el `title` y en la descripción accesible.
export function SmConteo({
  preguntas,
  campos,
  ayuda = "titulo",
  className,
}: {
  preguntas: number;
  campos: number;
  ayuda?: "visible" | "titulo";
  className?: string;
}) {
  const ayudaId = useId();
  const texto = textoConteoSm(preguntas, campos);
  if (ayuda === "visible") {
    return (
      <span className={`pulso-xf-smi-conteo${className ? ` ${className}` : ""}`}>
        <strong aria-describedby={ayudaId}>{texto}</strong>
        <small id={ayudaId}>{AYUDA_CONTEO_SM}</small>
      </span>
    );
  }
  return (
    <span className={`pulso-xf-smi-conteo is-inline${className ? ` ${className}` : ""}`} title={AYUDA_CONTEO_SM}>
      <strong aria-describedby={ayudaId}>{texto}</strong>
      <span id={ayudaId} className="pulso-sr-only">{AYUDA_CONTEO_SM}</span>
    </span>
  );
}
