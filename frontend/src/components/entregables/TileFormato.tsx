// Ícono del formato de un entregable: una hoja con la esquina doblada y la
// sigla del formato (XLSX, PDF, PPTX…). Neutro: no hay token de color por
// formato y el contenedor no resalta nada. Sin formato (mientras se genera) es
// la hoja sola.

export function TileFormato({ formato, chico = false }: { formato: string | null; chico?: boolean }) {
  const sigla = (formato ?? "").slice(0, 4).toUpperCase();
  return (
    <span
      className="pulso-entregable-tile"
      data-chico={chico ? "true" : undefined}
      data-letras={sigla.length >= 4 ? "4" : undefined}
      aria-hidden="true"
    >
      {sigla}
    </span>
  );
}
