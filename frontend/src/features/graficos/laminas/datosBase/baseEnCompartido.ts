// Una pregunta sin base en el informe compartido (H9, contrato-consolidado-laminas-f6-2026-10-11.md). Allí la base
// activa no dice nada —el informe junta varias— y el preflight bloquea toda ref sin `base$variable`
// (`unqualified_multisource_reference`, graficos_consolidado.R). La tarjeta no la completa por su cuenta: avisa.

export const NOTA_BASE_COMPARTIDO = "En el informe compartido elige la base de esta variable.";

export function faltaBaseEnCompartido(variable: string, scope: "active" | "consolidated"): boolean {
  const v = variable.trim();
  return scope === "consolidated" && v.length > 0 && !v.includes("$");
}
