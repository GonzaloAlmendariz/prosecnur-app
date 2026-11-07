/**
 * Lo que Aplicar descarta, dicho en el pie de «Ajustes del diseño» (antes lo decían los inspectores de Muestra
 * y Población, junto a su botón; al mudar los grupos el aviso tiene que viajar con el botón que lo produce).
 */
export function avisoAlAplicar(e: { muestra: boolean; rangos: boolean; hayTamano: boolean; hayCuotasOSorteo: boolean }): string | null {
  if (e.rangos && (e.hayTamano || e.hayCuotasOSorteo)) return "Aplicar recalcula la población y descarta el tamaño, las cuotas y el sorteo actual.";
  if (e.muestra && e.hayCuotasOSorteo) return "Aplicar recalcula el tamaño y descarta las cuotas y el sorteo actual.";
  return null;
}
