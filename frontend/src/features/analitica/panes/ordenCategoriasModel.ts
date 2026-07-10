// Lógica pura del editor "Orden de categorías" (Analítica).
// El .tsx solo presenta; toda la manipulación de secuencias vive aquí para
// poder testearla con vitest sin montar React.
//
// Contrato con el backend: `orden_categorias[list_name]` es la secuencia
// EXPLÍCITA de códigos de choice. Los códigos ausentes en la secuencia se
// anexan al final en su orden original (el backend replica esa semántica).

// Estándar de la casa (ver MEMORY / dominio-prosecnur): valores especiales
// que por convención van al final de cualquier distribución.
//   90 No aplica/perdido · 94 NS/NR · 95 No piensa votar · 96 Blanco/Viciado
//   97 No votó · 98 No sabe · 99 No responde
export const VALORES_ESPECIALES = ["90", "94", "95", "96", "97", "98", "99"] as const;

const ESPECIALES_SET = new Set<string>(VALORES_ESPECIALES);

export function esValorEspecial(code: string): boolean {
  return ESPECIALES_SET.has(code);
}

// Reordena `codes` moviendo los valores especiales al final, preservando el
// orden relativo tanto de los normales como de los especiales.
export function enviarEspecialesAlFinal(codes: string[]): string[] {
  const normales = codes.filter((c) => !ESPECIALES_SET.has(c));
  const especiales = codes.filter((c) => ESPECIALES_SET.has(c));
  return [...normales, ...especiales];
}

// Aplica un orden guardado sobre el universo de códigos del instrumento:
// primero los guardados que existen (en su orden, sin duplicar), luego los
// códigos del instrumento que faltaban (en su orden original). Mismo criterio
// que usa el backend al reconstruir `orders_list`.
export function aplicarOrdenGuardado(instrumentCodes: string[], saved: string[]): string[] {
  const universo = new Set(instrumentCodes);
  const vistos = new Set<string>();
  const resultado: string[] = [];
  for (const code of saved) {
    if (universo.has(code) && !vistos.has(code)) {
      resultado.push(code);
      vistos.add(code);
    }
  }
  for (const code of instrumentCodes) {
    if (!vistos.has(code)) {
      resultado.push(code);
      vistos.add(code);
    }
  }
  return resultado;
}

// Semilla del editor:
//   • Con override guardado → se respeta tal cual (ausentes al final).
//   • Sin override → orden del instrumento con los especiales empujados al
//     final como sugerencia (default de la casa).
export function sembrarOrden(instrumentCodes: string[], saved: string[] | undefined): string[] {
  if (saved && saved.length > 0) return aplicarOrdenGuardado(instrumentCodes, saved);
  return enviarEspecialesAlFinal(instrumentCodes);
}

// Dos secuencias son equivalentes si tienen los mismos códigos en el mismo
// orden. Se usa para decidir si el override coincide con el orden del
// instrumento (y ofrecer restaurar).
export function ordenesIguales(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((code, i) => code === b[i]);
}
