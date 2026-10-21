// atajosDelEditor.ts — cómo se nombra un atajo de teclado en cada sistema.
//
// La app corre en macOS y en Windows: el mismo atajo es ⌘B en uno y Ctrl+B en
// el otro, y el tooltip dice el del sistema en que se mira.

type Navegador = { platform?: string; userAgent?: string; userAgentData?: { platform?: string } };

/** ¿macOS (o iPadOS)? Sin navegador (tests), no. */
export function esMac(nav: Navegador | undefined = typeof navigator === "undefined" ? undefined : (navigator as Navegador)): boolean {
  if (!nav) return false;
  const plataforma = nav.userAgentData?.platform || nav.platform || nav.userAgent || "";
  return /mac|iphone|ipad/i.test(plataforma);
}

/** «Negrita (⌘B)» en macOS, «Negrita (Ctrl+B)» en Windows. */
export function rotuloDeAtajo(accion: string, tecla: string, mac: boolean = esMac()): string {
  return mac ? `${accion} (⌘${tecla})` : `${accion} (Ctrl+${tecla})`;
}
