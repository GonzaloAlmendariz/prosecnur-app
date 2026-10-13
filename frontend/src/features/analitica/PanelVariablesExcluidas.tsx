// Panel lateral «Variables excluidas» de Analítica (U5, checklist
// entregables-hsyvbg-2026-10-13).
//
// Direccionable: `?panel=excluidas` desde cualquier pestaña de Analítica; la
// forma que se enlaza es `/analitica?pestana=datos&panel=excluidas`. Un enlace
// puede nombrar la base en el foco (`&foco=<base>`): si no es la activa, el panel
// lo dice y ofrece cambiarla, porque la lista se lee y se escribe en la config
// de la base activa y mostrar la de otra en silencio sería mentir.
//
// El diálogo de Radix pone el foco en el título, cierra con Esc y atrapa el
// tabulador.

import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "../../vendor/lucide-react";
import { apiAnaliticaDataReview } from "../../api/client";
import { getOrigenExterno, type OrigenExterno } from "../../api/cargaOrigenExterno";
import { apiEstudioActiveBaseSet, apiEstudioGet, type EstudioPayload } from "../../api/estudio";
import { PulsoButton } from "../../components/PulsoButton";
import { ErrorBlock, LoadingBlock } from "../../components/States";
import { usePanelDireccionable } from "../../lib/navegacion/paneles";
import { useSeccion } from "../../lib/navegacion/useDireccion";
import { useSession } from "../../lib/SessionContext";
import { PANEL_VARIABLES_EXCLUIDAS } from "./panelesAnalitica";
import { useAnaliticaStore } from "./store";
import { VariablesExcluidas } from "./VariablesExcluidas";
import {
  configAnaliticaPorBase,
  motivosDesdeOrigen,
  type MotivoExclusion,
  type VariableElegible,
} from "./variablesExcluidasModel";
import "./variablesExcluidas.css";

type Carga =
  | { tipo: "cargando" }
  | { tipo: "error"; detalle: string }
  | {
    tipo: "lista";
    variables: VariableElegible[];
    motivos: Map<string, MotivoExclusion>;
    estudio: EstudioPayload | null;
  };

function etiquetaDeBase(estudio: EstudioPayload | null, nombre: string | null | undefined): string {
  if (!nombre) return "";
  const base = estudio?.bases?.[nombre];
  return base?.source_alias || base?.source_title || nombre;
}

export function PanelVariablesExcluidas() {
  const panel = usePanelDireccionable(PANEL_VARIABLES_EXCLUIDAS);
  const procesamiento = useSeccion("procesamiento");
  const { state, refresh } = useSession();
  const hydrated = useAnaliticaStore((s) => s.hydrated);
  const excluidas = useAnaliticaStore((s) => s.config.variables_excluidas);
  const setExcluidas = useAnaliticaStore((s) => s.setVariablesExcluidas);
  const [carga, setCarga] = useState<Carga>({ tipo: "cargando" });
  const [cambiandoBase, setCambiandoBase] = useState(false);
  const contenido = useRef<HTMLDivElement | null>(null);

  const activa = state?.active_base ?? null;
  const porBase = configAnaliticaPorBase({
    modoProcesamiento: state?.estudio_processing_mode,
    topologiaDeclarada: state?.estudio_topology_declared,
    nBases: state?.n_bases,
  });
  const nBases = state?.n_bases ?? 0;
  const basesDelAlcance = porBase
    ? [activa]
    : nBases > 1
      ? state?.bases_nombres ?? []
      : [activa];
  const claveAlcance = basesDelAlcance.join("|");

  useEffect(() => {
    if (!panel.abierto) return;
    let vigente = true;
    setCarga({ tipo: "cargando" });
    (async () => {
      try {
        const [review, estudio, origenes] = await Promise.all([
          apiAnaliticaDataReview(),
          apiEstudioGet().catch(() => null),
          // Sin declaración de origen la exclusión no tiene motivo conocido; un
          // fallo de esta lectura no impide editar la lista.
          Promise.all(
            basesDelAlcance.map((base) => getOrigenExterno(base).catch(() => null)),
          ),
        ]);
        if (!vigente) return;
        setCarga({
          tipo: "lista",
          variables: review.variables.map((v) => ({
            name: v.name,
            label: v.label_actual || v.label_original || "",
          })),
          motivos: motivosDesdeOrigen(
            origenes.filter((o): o is OrigenExterno => o !== null),
          ),
          estudio,
        });
      } catch (e) {
        if (vigente) setCarga({ tipo: "error", detalle: (e as Error).message });
      }
    })();
    return () => { vigente = false; };
    // `claveAlcance` resume las bases; la lista misma cambia de identidad en
    // cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel.abierto, claveAlcance]);

  const estudio = carga.tipo === "lista" ? carga.estudio : null;
  const pedida = procesamiento.foco?.trim() || null;
  const otraBase = porBase && pedida && activa && pedida !== activa && (state?.bases_nombres ?? []).includes(pedida)
    ? pedida
    : null;
  const alcance = porBase
    ? `Base «${etiquetaDeBase(estudio, activa)}»`
    : nBases > 1
      ? "Todas las bases: comparten esta lista"
      : "";

  async function cambiarABase(nombre: string) {
    setCambiandoBase(true);
    try {
      const resultado = await apiEstudioActiveBaseSet(nombre);
      await refresh();
      window.dispatchEvent(new CustomEvent("pulso:active-base-changed", {
        detail: { active: resultado.active, processing_mode: resultado.processing_mode },
      }));
    } finally {
      setCambiandoBase(false);
    }
  }

  const listo = hydrated && carga.tipo !== "cargando" && !cambiandoBase;

  return (
    <Dialog.Root open={panel.abierto} onOpenChange={(abierto) => { if (!abierto) panel.cerrar(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="pulso-excluidas-velo" />
        <Dialog.Content
          ref={contenido}
          className="pulso-excluidas"
          {...panel.props}
          data-audit-ready={listo ? "true" : "false"}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            contenido.current?.querySelector<HTMLElement>("[data-excluidas-titulo]")?.focus();
          }}
        >
          <header className="pulso-excluidas-cabecera">
            <div className="pulso-excluidas-titular">
              <div>
                <Dialog.Title asChild>
                  <h2 tabIndex={-1} data-excluidas-titulo="">Variables excluidas</h2>
                </Dialog.Title>
                {alcance ? <p className="pulso-excluidas-alcance">{alcance}</p> : null}
              </div>
              <Dialog.Close asChild>
                <button type="button" className="pulso-excluidas-cerrar" aria-label="Cerrar variables excluidas">
                  <X size={16} aria-hidden="true" />
                </button>
              </Dialog.Close>
            </div>
            <Dialog.Description asChild>
              <p className="pulso-excluidas-regla">
                Una variable excluida no sale en ningún entregable de Analítica (bases exportadas,
                libro de códigos, tablas y cruces) ni en los comparativos. No se borra de los
                datos: puedes volver a incluirla cuando quieras. Los cambios se guardan solos.
              </p>
            </Dialog.Description>
            {otraBase ? (
              <div className="pulso-excluidas-otra-base" role="status">
                <span>
                  El enlace pide la base «{etiquetaDeBase(estudio, otraBase)}», pero estás viendo
                  «{etiquetaDeBase(estudio, activa)}».
                </span>
                <PulsoButton
                  variant="secondary"
                  size="sm"
                  onClick={() => void cambiarABase(otraBase)}
                  disabled={cambiandoBase}
                >
                  Ver «{etiquetaDeBase(estudio, otraBase)}»
                </PulsoButton>
              </div>
            ) : null}
          </header>

          <div className="pulso-excluidas-cuerpo">
            {!hydrated || carga.tipo === "cargando" ? (
              <LoadingBlock label="Cargando variables…" />
            ) : carga.tipo === "error" ? (
              <ErrorBlock label="No se pudieron leer las variables de la base" detail={carga.detalle} />
            ) : (
              <VariablesExcluidas
                variables={carga.variables}
                excluidas={excluidas}
                onCambiar={setExcluidas}
                motivos={carga.motivos}
              />
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
