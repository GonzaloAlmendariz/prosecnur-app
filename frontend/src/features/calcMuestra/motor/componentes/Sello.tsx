/**
 * Sello de confiabilidad de una cifra, con la leyenda de la documentación
 * metodológica: oficial (diseño 2026) · verificado (reconteo sobre la base) ·
 * resumen (tabla histórica) · corregido (la fuente estaba mal; este es el bueno).
 */
import type { SelloCifra } from "../../dominio";

const SELLOS: Record<SelloCifra, { label: string; title: string }> = {
  oficial: { label: "oficial", title: "Cifra del documento metodológico oficial 2026" },
  verificado: { label: "verificado", title: "Verificada por conteo directo sobre la base canónica" },
  resumen: { label: "según resumen", title: "Proviene de una tabla-resumen histórica, no de conteo directo" },
  corregido: { label: "corregido", title: "La fuente original estaba mal; este es el valor correcto" },
};

export function Sello({ tipo }: { tipo: SelloCifra }) {
  const sello = SELLOS[tipo];
  return (
    <span className="rec-sello" data-tipo={tipo} title={sello.title}>
      {sello.label}
    </span>
  );
}
