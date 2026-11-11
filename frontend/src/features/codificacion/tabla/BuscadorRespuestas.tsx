import { Search, X } from "../../../vendor/lucide-react";

export type BuscadorRespuestasProps = {
  valor: string;
  onCambiar: (texto: string) => void;
  /** Nombre accesible: dice de qué pregunta son las respuestas. */
  etiqueta: string;
};

/** El buscador de respuestas de Codificar. Lo comparten la vista de tarjetas y la de tabla. */
export function BuscadorRespuestas({ valor, onCambiar, etiqueta }: BuscadorRespuestasProps) {
  return (
    <div className="pulso-cv2-search">
      <Search size={14} className="pulso-cv2-search-icon" aria-hidden="true" />
      <input
        type="search"
        placeholder="Buscar en las respuestas"
        value={valor}
        onChange={(evento) => onCambiar(evento.target.value)}
        className="pulso-cv2-search-input"
        aria-label={etiqueta}
      />
      {valor ? (
        <button
          type="button"
          onClick={() => onCambiar("")}
          className="pulso-icon"
          aria-label="Limpiar búsqueda"
          title="Limpiar"
        >
          <X size={12} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
