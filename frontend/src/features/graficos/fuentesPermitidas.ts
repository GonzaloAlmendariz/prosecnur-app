// Qué bases ofrece el selector de preguntas (VariablePicker). Módulo puro.

/** Las bases que ofrece el selector: la de `soloBase`; si no, las de `soloBases` que existen; si ninguna, todas. */
export function fuentesPermitidas<S extends { name: string }>(todas: readonly S[], soloBase: string | null, soloBases: readonly string[] | null): S[] {
  if (soloBase && todas.some((s) => s.name === soloBase)) return todas.filter((s) => s.name === soloBase);
  const permitidas = new Set(soloBases ?? []);
  const filtradas = todas.filter((s) => permitidas.has(s.name));
  return filtradas.length ? filtradas : [...todas];
}
