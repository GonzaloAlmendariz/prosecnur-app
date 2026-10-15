// C52: líneas visuales completas (ACNUR, institucional…) aplicables al informe. ID3 (2026-10-15): la lista es la
// biblioteca de Identidad (`BibliotecaLineas`: del recetario y propias); aquí van la sección, la procedencia y «Quitar».

import { useId } from "react";
import { BibliotecaLineas } from "../estilo/BibliotecaLineas";
import { useLineasPropias } from "../estilo/lineasPropiasStore";
import { usePptStyleProfiles } from "../usePptStyleProfiles";
import { SelloProcedencia } from "../estilo/SelloProcedencia";
import { CabeceraSeccion } from "./CabeceraSeccion";
// D3: la sección vive ahora en Identidad, que no carga la hoja de Reglas: trae la suya.
import "./estiloInforme.css";
import { lineaVisualAplicada } from "./modeloEstiloInforme";
import { usePlanStore } from "../store";
import { PulsoButton } from "../../../components/PulsoButton";
import { X } from "../../../vendor/lucide-react";

export function SeccionLineaVisual({ aplicada }: { aplicada: string | null }) {
  const tituloId = useId();
  const { profiles } = usePptStyleProfiles();
  const propias = useLineasPropias((s) => s.lineas);
  const quitar = usePlanStore((s) => s.quitarPptStyleProfile);
  // L4: la línea aplicada se reconoce por el `profile_id` que su perfil escribe en `scope_rules.global`.
  const perfilAplicado = aplicada ? [...profiles, ...propias].find((p) => lineaVisualAplicada(p.scope_rules ?? {}) === aplicada) ?? null : null;
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
      <BibliotecaLineas />
    </section>
  );
}
