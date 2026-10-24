import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import "./cabeceraDePestana.css";

/**
 * Cabecera de pestaña del esqueleto común (estándar §2b, G1), 44 px: ícono
 * carmesí en cuadro suave, antetítulo «SECCIÓN · GRUPO» en versalitas y el
 * nombre de la pestaña debajo, sin subtítulo. A la derecha, un control propio
 * de la pestaña (selector de sub-vistas) y chips de contexto.
 *
 * Es la forma general de `profiles/telefonico/navegacion/CabeceraTelefonica`,
 * que nació atada a las secciones del telefónico.
 */
export function CabeceraDePestana({
  icono: Icono,
  antetitulo,
  titulo,
  control,
  chips = [],
}: {
  icono: LucideIcon;
  antetitulo: string;
  titulo: string;
  control?: ReactNode;
  chips?: readonly string[];
}) {
  return (
    <header className="mon-pcab">
      <span className="mon-pcab-icono" aria-hidden="true">
        <Icono size={17} />
      </span>
      <span className="mon-pcab-copia">
        <span className="mon-pcab-antetitulo">{antetitulo}</span>
        <h2>{titulo}</h2>
      </span>
      <span className="mon-pcab-derecha">
        {control}
        {chips.map((chip) => (
          <span key={chip} className="mon-pcab-chip">{chip}</span>
        ))}
      </span>
    </header>
  );
}

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
    <div className="mon-pcab-subvistas" role="group" aria-label="Vista de la pestaña">
      {opciones.map((opcion) => {
        const elegida = esActiva(opcion.valor);
        return (
          <button
            key={opcion.clave}
            type="button"
            className={`mon-pcab-subvista${elegida ? " is-active" : ""}`}
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
