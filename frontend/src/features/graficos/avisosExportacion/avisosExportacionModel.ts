// Avisos de la validación previa a exportar, agrupados por lámina. Llegan como frases sueltas
// («Lámina 60 · “Cifras destacadas (p172)”: el espacio «Cifra izquierda» no tiene título…») y se pintaban unidas con
// « · » en un solo párrafo; Gonzalo (2026-10-14): «se ve como un montón de texto pegado».

export type GrupoAvisos = { clave: string; lamina: string | null; titulo: string | null; detalles: string[] };

const PATRON = /^Lámina\s+(\d+)\s*·\s*[“"«]([^”"»]*)[”"»]\s*:\s*(.+)$/s;

/** Agrupa por lámina conservando el orden de aparición; lo que no nombra lámina va en un grupo «Informe». */
export function agruparAvisos(avisos: readonly string[]): GrupoAvisos[] {
  const grupos = new Map<string, GrupoAvisos>();
  for (const aviso of avisos) {
    const texto = aviso.trim();
    if (!texto) continue;
    const m = PATRON.exec(texto);
    const clave = m ? `l${m[1]}` : "informe";
    const grupo = grupos.get(clave) ?? { clave, lamina: m ? m[1] : null, titulo: m ? m[2].trim() : null, detalles: [] };
    const detalle = m ? m[3].trim() : texto;
    const capital = detalle.charAt(0).toUpperCase() + detalle.slice(1);
    if (!grupo.detalles.includes(capital)) grupo.detalles.push(capital);
    grupos.set(clave, grupo);
  }
  return [...grupos.values()];
}

/** «Ir a la lámina 44» desde la etiqueta del error («Lámina 44 · “Preguntas por grupos (p79)”»). */
export function rotuloIrALamina(etiqueta: string): string {
  const n = /Lámina\s+(\d+)/.exec(etiqueta)?.[1];
  return n ? `Ir a la lámina ${n}` : "Ir a la lámina";
}
