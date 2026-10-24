import { useMemo, useState } from "react";
import { detalleDelCatalogo, ordenarYBuscar, type EncuestaDelCatalogo } from "./modeloDeCatalogo";

/**
 * Lista de encuestas de una cuenta con búsqueda por nombre o código, de la
 * más reciente a la más antigua. La comparten Kobo y SurveyMonkey en el panel
 * de conexión de fuentes, que usan los modos que conectan encuestas.
 */
export function CatalogoDeEncuestas({
  items,
  servicio,
  onElegir,
}: {
  items: readonly EncuestaDelCatalogo[];
  servicio: "kobo" | "surveymonkey";
  onElegir: (item: EncuestaDelCatalogo) => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const visibles = useMemo(() => ordenarYBuscar(items, busqueda), [items, busqueda]);
  const cosa = servicio === "kobo" ? "formularios" : "encuestas";
  return (
    <>
      <input
        value={busqueda}
        onChange={(event) => setBusqueda(event.currentTarget.value)}
        placeholder={`Buscar por nombre o código entre ${items.length.toLocaleString("es-PE")} ${cosa}`}
        aria-label={`Buscar ${cosa} por nombre o código`}
      />
      <div className="fuentes-conectar-catalogo" data-qa-geometry-capacity="owned">
        {visibles.length ? visibles.map((item) => (
          <button key={item.id} type="button" className="fuentes-conectar-encuesta" onClick={() => onElegir(item)}>
            <strong>{item.nombre}</strong>
            <em>{detalleDelCatalogo(item)}</em>
          </button>
        )) : <p className="fuentes-conectar-pista">{servicio === "kobo" ? "Ningún formulario" : "Ninguna encuesta"} coincide con «{busqueda}».</p>}
      </div>
    </>
  );
}
