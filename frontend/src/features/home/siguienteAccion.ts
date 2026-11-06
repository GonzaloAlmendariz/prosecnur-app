// L31 · Home vivo: la siguiente acción de cada módulo, a la vista.
//
// El modelo de la tarjeta ya calculaba una acción («Revisar alertas», «Continuar en Validación», «Completar enlaces»)
// y sólo la usaba como nombre accesible del botón. Se muestra cuando dice algo: «Abrir X» repite el nombre del
// módulo y no orienta, así que se calla.

export function accionVisible(accion: { label: string } | null | undefined): string | null {
  const label = accion?.label?.trim();
  if (!label) return null;
  if (/^abrir\b/i.test(label)) return null;
  return label;
}
