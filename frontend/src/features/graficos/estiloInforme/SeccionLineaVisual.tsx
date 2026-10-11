// C52: líneas visuales completas (ACNUR, institucional…) aplicables al informe. Reusa el panel de siempre
// (`PptStyleProfilesPanel`, que escribe con `applyPptStyleProfile`); aquí sólo se le da sección, procedencia y un vacío
// propio cuando el catálogo no trae líneas (el panel, sin perfiles, no pinta nada).

import { useId } from "react";
import { PptStyleProfilesPanel } from "../PptStyleProfilesPanel";
import { usePptStyleProfiles } from "../usePptStyleProfiles";
import { SelloProcedencia } from "../estilo/SelloProcedencia";
import { CabeceraSeccion } from "./CabeceraSeccion";

export function SeccionLineaVisual({ aplicada }: { aplicada: string | null }) {
  const tituloId = useId();
  const { profiles, loading, error } = usePptStyleProfiles();
  const sinLineas = !loading && !error && profiles.length === 0;
  return (
    <section className="pulso-f6-informe-seccion" aria-labelledby={tituloId} data-qa-geometry-member data-seccion="linea-visual">
      <CabeceraSeccion
        id={tituloId}
        titulo="Línea visual"
        modificado={false}
        extra={<SelloProcedencia procedencia={aplicada ? "propio" : "recetario"} />}
      />
      <p className="pulso-f6-informe-ayuda">
        Una línea funde en el informe sus colores y sus bases de gráfico, sin mover láminas ni variables. Se deshace con
        Deshacer; lo que cambies después en Cálculos o Paletas manda sobre ella.
      </p>
      {sinLineas ? (
        <p className="pulso-f6-informe-estado" role="status">El catálogo del recetario no trae líneas visuales.</p>
      ) : (
        <div className="pulso-f6-informe-incrustado">
          <PptStyleProfilesPanel />
        </div>
      )}
    </section>
  );
}
