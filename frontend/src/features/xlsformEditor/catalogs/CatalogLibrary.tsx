// =============================================================================
// catalogs/CatalogLibrary.tsx — sidebar de catálogos en el lens
// =============================================================================
// Reemplaza al `CatalogLibrary` inline del monolito legacy. Mejoras:
//
//   1. Búsqueda por nombre de catálogo (útil en RMS con 59 listas).
//   2. Cada item muestra: nombre + conteo opciones + conteo de preguntas
//      que lo usan (badge soft).
//   3. Highlight del catálogo activo con animación slide.
//   4. Estado vacío: CTA para crear el primer catálogo.
// =============================================================================

import { useMemo, useState } from "react";
import { ListChecks, Plus, Search } from "lucide-react";
import type { CatalogSummary } from "../types";

export type CatalogLibraryProps = {
  catalogs: CatalogSummary[];
  activeCatalogName: string | null;
  /** Mapa nombre → cantidad de preguntas que lo usan. */
  usageByCatalog: Record<string, number>;
  onFocus: (listName: string) => void;
  onCreate: () => void;
};

export function CatalogLibrary({
  catalogs,
  activeCatalogName,
  usageByCatalog,
  onFocus,
  onCreate,
}: CatalogLibraryProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalogs;
    return catalogs.filter((catalog) => catalog.listName.toLowerCase().includes(q));
  }, [catalogs, query]);

  if (catalogs.length === 0) {
    return (
      <div className="pulso-cataloglibrary pulso-cataloglibrary-empty">
        <ListChecks size={20} />
        <strong>Aún no hay catálogos</strong>
        <p>
          Crea el primer catálogo para definir las opciones reutilizables de tus
          preguntas de selección.
        </p>
        <button
          type="button"
          className="pulso-cataloglibrary-create"
          onClick={onCreate}
        >
          <Plus size={13} /> Crear primer catálogo
        </button>
      </div>
    );
  }

  return (
    <div className="pulso-cataloglibrary">
      {catalogs.length >= 6 && (
        <div className="pulso-cataloglibrary-search">
          <Search size={13} style={{ color: "var(--pulso-text-soft)" }} />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar catálogo..."
            spellCheck={false}
          />
        </div>
      )}

      <div className="pulso-cataloglibrary-list">
        {filtered.length === 0 ? (
          <div className="pulso-cataloglibrary-empty-search">
            Ningún catálogo coincide con <em>{query}</em>.
          </div>
        ) : (
          filtered.map((catalog) => {
            const isActive = catalog.listName === activeCatalogName;
            const usage = usageByCatalog[catalog.listName] ?? 0;
            return (
              <button
                key={catalog.listName}
                type="button"
                className={`pulso-cataloglibrary-item ${isActive ? "is-active" : ""}`}
                onClick={() => onFocus(catalog.listName)}
                aria-pressed={isActive}
              >
                <span className="pulso-cataloglibrary-item-icon">
                  <ListChecks size={13} />
                </span>
                <span className="pulso-cataloglibrary-item-meta">
                  <strong>{catalog.listName}</strong>
                  <span>
                    {catalog.items.length} {catalog.items.length === 1 ? "opción" : "opciones"}
                    {usage > 0 && (
                      <>
                        {" · "}
                        {usage === 1 ? "1 pregunta" : `${usage} preguntas`}
                      </>
                    )}
                  </span>
                </span>
                {usage === 0 && (
                  <span
                    className="pulso-cataloglibrary-item-unused"
                    title="Este catálogo no se está usando todavía"
                  >
                    sin uso
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
