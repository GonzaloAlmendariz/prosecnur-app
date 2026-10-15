// C52: líneas visuales completas (ACNUR, institucional…) aplicables al informe. Reusa el panel de siempre
// (`PptStyleProfilesPanel`, que escribe con `applyPptStyleProfile`); aquí sólo se le da sección, procedencia y un vacío
// propio cuando el catálogo no trae líneas (el panel, sin perfiles, no pinta nada).

import { useId } from "react";
import { PptStyleProfilesPanel } from "../PptStyleProfilesPanel";
import { usePptStyleProfiles } from "../usePptStyleProfiles";
import { SelloProcedencia } from "../estilo/SelloProcedencia";
import { CabeceraSeccion } from "./CabeceraSeccion";
import { lineaVisualAplicada } from "./modeloEstiloInforme";
import { usePlanStore } from "../store";
import { PulsoButton } from "../../../components/PulsoButton";
import { X } from "../../../vendor/lucide-react";

export function SeccionLineaVisual({ aplicada }: { aplicada: string | null }) {
  const tituloId = useId();
  const { profiles, loading, error } = usePptStyleProfiles();
  const sinLineas = !loading && !error && profiles.length === 0;
  const quitar = usePlanStore((s) => s.quitarPptStyleProfile);
  // L4: la línea aplicada se reconoce por el `profile_id` que su perfil escribe en `scope_rules.global`.
  const perfilAplicado = aplicada ? profiles.find((p) => lineaVisualAplicada(p.scope_rules ?? {}) === aplicada) ?? null : null;
  return (
    <section className="pulso-f6-informe-seccion" aria-labelledby={tituloId} data-qa-geometry-member data-seccion="linea-visual">
      <CabeceraSeccion
        id={tituloId}
        titulo="Línea visual"
        modificado={false}
        extra={<>
          <SelloProcedencia procedencia={aplicada ? "propio" : "recetario"} />
          {perfilAplicado ? (
            <PulsoButton variant="ghost" size="sm" onClick={() => quitar(perfilAplicado)} aria-label={`Quitar la línea ${perfilAplicado.titulo_humano}`}>
              <X size={14} aria-hidden="true" />
              Quitar línea
            </PulsoButton>
          ) : null}
        </>}
      />
      <p className="pulso-f6-informe-ayuda">
        Una línea funde en el informe sus colores y sus bases de gráfico, sin mover láminas ni variables. «Quitar línea»
        retira lo que trajo; lo que cambies después manda sobre ella y se queda.
      </p>
      {sinLineas ? (
        <p className="pulso-f6-informe-estado" role="status">No hay líneas visuales disponibles.</p>
      ) : (
        <div className="pulso-f6-informe-incrustado">
          <PptStyleProfilesPanel />
        </div>
      )}
    </section>
  );
}
