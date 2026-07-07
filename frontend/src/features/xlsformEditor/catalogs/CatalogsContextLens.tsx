// =============================================================================
// catalogs/CatalogsContextLens.tsx — chrome del panel de catálogos
// =============================================================================
// Reusa el `ContextLens` de validación/components para mostrar el editor de
// catálogos en un panel lateral wide. Al cerrar el lens vuelve el constructor
// como protagonista — los catálogos NO compiten por ancho con el constructor.
//
// Esta versión sólo provee el chrome (lens + grid 2-col). El contenido
// (lista de catálogos a la izquierda, workspace a la derecha) lo renderiza
// el caller como `library` y `workspace` props. Permite que el monolito siga
// usando sus `CatalogLibrary`/`CatalogWorkspace` existentes sin duplicar
// lógica; en Sub-PR 7 los moveremos a archivos propios y este componente los
// importará directamente.
//
// Reglas que esta UI refuerza:
//   - El catálogo se ASIGNA en el inspector (sub-PR 6).
//   - El catálogo se EDITA solo aquí.
// =============================================================================

import type { CSSProperties, ReactNode } from "react";
import ContextLens from "../../validacion/components/ContextLens";

export type CatalogsContextLensProps = {
  open: boolean;
  onClose: () => void;
  /** Cantidad total de listas, incluyendo las que aún no tienen opciones. */
  listsCount: number;
  /** Cantidad de listas que ya tienen al menos una opción real. */
  readyListsCount: number;
  /** Acción "Nuevo catálogo" — botón en el header. */
  onCreate: () => void;
  /** Lista lateral (col izq). El monolito pasa su `<CatalogLibrary>`. */
  library: ReactNode;
  /** Editor del catálogo activo (col der). El monolito pasa su `<CatalogWorkspace>`. */
  workspace: ReactNode;
};

export default function CatalogsContextLens({
  open,
  onClose,
  listsCount,
  readyListsCount,
  onCreate,
  library,
  workspace,
}: CatalogsContextLensProps) {
  const pendingListsCount = Math.max(listsCount - readyListsCount, 0);
  const subtitle =
    listsCount === 0
      ? "Define listas reutilizables y conéctalas a las preguntas de selección desde el inspector."
      : pendingListsCount > 0
        ? `${listsCount} ${listsCount === 1 ? "lista conectada" : "listas conectadas"} · ${pendingListsCount} ${pendingListsCount === 1 ? "en preparación" : "en preparación"}. Agrega opciones reales antes de exportar.`
        : `${readyListsCount} ${readyListsCount === 1 ? "lista con opciones" : "listas con opciones"}. Conéctalas a las preguntas de selección desde el inspector.`;

  return (
    <ContextLens
      open={open}
      onClose={onClose}
      variant="wide"
      title="Listas de opciones"
      subtitle={subtitle}
      actions={(
        <button
          type="button"
          onClick={onCreate}
          className="pulso-primary"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            padding: "6px 12px",
          }}
        >
          + Nueva lista
        </button>
      )}
    >
      <div style={lensGridStyle}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
          {library}
        </div>
        <div style={{ minWidth: 0 }}>
          {workspace}
        </div>
      </div>
    </ContextLens>
  );
}

const lensGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(220px, 0.7fr) minmax(280px, 1.3fr)",
  gap: 16,
  alignItems: "start",
};
