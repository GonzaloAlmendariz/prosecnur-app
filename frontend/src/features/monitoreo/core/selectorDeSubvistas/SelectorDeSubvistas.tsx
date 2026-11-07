import "./selectorDeSubvistas.css";

/**
 * Selector de las vistas que una pestaña absorbe mientras no tiene contenido
 * propio. Cada opción tiene dirección (`panel`): el selector escribe la misma
 * URL que un enlace, no es una navegación aparte.
 */
export function SelectorDeSubvistas<T>({
  opciones,
  esActiva,
  onElegir,
}: {
  opciones: ReadonlyArray<{ clave: string; etiqueta: string; valor: T }>;
  esActiva: (valor: T) => boolean;
  onElegir: (valor: T) => void;
}) {
  if (opciones.length < 2) return null;
  return (
    <div className="mon-subvistas" role="group" aria-label="Vista de la pestaña">
      {opciones.map((opcion) => {
        const elegida = esActiva(opcion.valor);
        return (
          <button
            key={opcion.clave}
            type="button"
            className={`mon-subvista${elegida ? " is-active" : ""}`}
            aria-pressed={elegida}
            data-subvista={opcion.clave}
            onClick={() => {
              if (!elegida) onElegir(opcion.valor);
            }}
          >
            {opcion.etiqueta}
          </button>
        );
      })}
    </div>
  );
}
