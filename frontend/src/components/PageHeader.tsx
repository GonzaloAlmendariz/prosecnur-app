// Page header unificado — usado por las Fases 3/4/5 (y próximamente 1/2).
//
// Consolida el patrón repetido `<h1 class="pulso-page-title">Fase N — ...</h1>`
// + `<p class="pulso-page-lead">...</p>` que aparecía copy-pasted en cada
// page component. Acepta un slot opcional `meta` a la derecha para
// chips/badges contextuales (estado de prereq, save indicator, etc.).

type Props = {
  title: string;
  lead?: string;
  /**
   * Slot opcional a la derecha del título (misma línea). Útil para
   * mostrar chips de estado, badges de progreso, o botones contextuales
   * ligeros. No usar para toolbars grandes — eso va en una banda aparte.
   */
  meta?: React.ReactNode;
};

export function PageHeader({ title, lead, meta }: Props) {
  return (
    <header style={{ marginBottom: lead ? 20 : 14 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: lead ? 4 : 0,
        }}
      >
        <h1 className="pulso-page-title" style={{ margin: 0 }}>
          {title}
        </h1>
        {meta && (
          <div style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 8 }}>
            {meta}
          </div>
        )}
      </div>
      {lead && (
        <p className="pulso-page-lead" style={{ margin: 0, maxWidth: 780 }}>
          {lead}
        </p>
      )}
    </header>
  );
}
