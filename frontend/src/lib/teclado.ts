// Atajos de teclado en macOS y en Windows.
//
// La app corre en los dos: el mismo atajo es ⌘B en uno y Ctrl+B en el otro.
// Lo que se MUESTRA dice la tecla del sistema en que se mira, y lo que se
// ESCUCHA acepta el modificador de ese sistema. Un «⌘» escrito a mano en la UI
// es lo que un usuario de Windows ve como un símbolo que su teclado no tiene.

type Navegador = { platform?: string; userAgent?: string; userAgentData?: { platform?: string } };

/** ¿macOS (o iPadOS)? Sin navegador (tests), no. */
export function esMac(nav: Navegador | undefined = typeof navigator === "undefined" ? undefined : (navigator as Navegador)): boolean {
  if (!nav) return false;
  const plataforma = nav.userAgentData?.platform || nav.platform || nav.userAgent || "";
  return /mac|iphone|ipad/i.test(plataforma);
}

/** La tecla modificadora tal como se rotula: «⌘» en macOS, «Ctrl» en Windows. */
export function teclaMod(mac: boolean = esMac()): string {
  return mac ? "⌘" : "Ctrl";
}

/** «⌘Z» en macOS, «Ctrl+Z» en Windows: el atajo solo, para escribirlo dentro de una frase. */
export function nombreDeAtajo(tecla: string, mac: boolean = esMac()): string {
  return mac ? `⌘${tecla}` : `Ctrl+${tecla.replace(/⇧/g, "Shift+")}`;
}

/**
 * «Negrita (⌘B)» en macOS, «Negrita (Ctrl+B)» en Windows. `tecla` puede llevar
 * «⇧» delante para Mayús: «Rehacer (⌘⇧Z)» / «Rehacer (Ctrl+Shift+Z)».
 */
export function rotuloDeAtajo(accion: string, tecla: string, mac: boolean = esMac()): string {
  return `${accion} (${nombreDeAtajo(tecla, mac)})`;
}

/** ¿El evento trae el modificador del sistema? ⌘ en macOS, Ctrl en Windows. */
export function conModificador(event: { metaKey: boolean; ctrlKey: boolean }, mac: boolean = esMac()): boolean {
  return mac ? event.metaKey : event.ctrlKey;
}
