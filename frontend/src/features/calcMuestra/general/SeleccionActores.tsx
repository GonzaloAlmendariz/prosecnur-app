import { CircleSlash2, Users } from "lucide-react";

import type { CalcMuestraComponente } from "../../../api/calcMuestra";
import type { CalcMuestraGeneralCorrida, CalcMuestraGeneralMarco } from "../../../api/calcMuestraGeneral";
import { EmptyState } from "../../../components/States";
import { ArchivoMarcoGeneral } from "./ArchivoMarcoGeneral";
import { estadoDelActor, tecnicaDelActor, type TecnicaDelActor } from "./actores";
import { vigenciaSorteo } from "./bandaDisenoModelo";
import { SeleccionGeneral } from "./SeleccionGeneral";
import { ID_TRABAJO_DEL_ACTOR, SelectorActor, type ActorDelSelector } from "./SelectorActor";
import { useMuestraGeneralStore } from "./store";
import { useActorEnFoco } from "./useActorEnFoco";
import { useIrASeccionGeneral, useMuestraGeneral } from "./useMuestraGeneral";
import "./general.css";

export function nombreDelActor(componente: Pick<CalcMuestraComponente, "actor" | "actor_id" | "id">): string {
  return componente.actor?.trim() || componente.actor_id?.trim() || componente.id;
}

/**
 * Los actores del selector con su técnica y el estado de su marco y su sorteo.
 * La vigencia del sorteo sale de `vigenciaSorteo`, la misma definición que la
 * banda, las fichas y la tarjeta: un sorteo de un marco o un cálculo que ya
 * cambiaron es «Sorteo viejo», nunca «Sorteado» (QA E11 ronda 2).
 */
export function actoresDelSelector(
  componentes: readonly CalcMuestraComponente[],
  estado: {
    cargado: boolean;
    marcos: Readonly<Record<string, CalcMuestraGeneralMarco | undefined>>;
    corridas: Readonly<Record<string, CalcMuestraGeneralCorrida | undefined>>;
  },
): ActorDelSelector[] {
  const { cargado, marcos, corridas } = estado;
  return componentes.map((c) => {
    const tecnica = tecnicaDelActor(c.tecnica);
    const marco = marcos[c.id] ?? null;
    const corrida = corridas[c.id] ?? null;
    return {
      id: c.id,
      nombre: nombreDelActor(c),
      tecnica,
      estado: estadoDelActor({
        tecnica,
        cargado,
        marco,
        corrida,
        vigente: vigenciaSorteo({ comp: c, corrida, marco }).estado === "vigente",
      }),
      conMarco: Boolean(marco),
    };
  });
}

/**
 * Acreditación › Selección (ADR 0090, E5). Cada actor es un componente del
 * estudio y se sortea con el motor de Muestra general por su `componente_id`:
 * el actor en foco (`foco=<componente_id>`) reutiliza «Archivo del marco» y la
 * Selección general tal cual. Un actor cuya técnica no da π lo dice de entrada
 * y no ofrece Sortear.
 *
 * La técnica de un actor de Acreditación la infiere el motor desde actor,
 * canal y N (cuadro maestro): declarar el marco puede cambiarla. Por eso se lee
 * siempre del componente vigente, nunca se fija al montar.
 */
export function SeleccionActores({ componentes }: { componentes: readonly CalcMuestraComponente[] }) {
  const { activo, elegir } = useActorEnFoco(componentes);
  // Rehidrata marcos y corridas aunque el actor en foco no monte el sorteo.
  const { cargado } = useMuestraGeneral(activo?.id ?? null);
  const marcos = useMuestraGeneralStore((s) => s.marcos);
  const corridas = useMuestraGeneralStore((s) => s.corridas);

  const actores = actoresDelSelector(componentes, { cargado, marcos, corridas });

  return (
    <SeleccionActoresVista
      actores={actores}
      activo={activo}
      cargado={cargado}
      onElegir={elegir}
    />
  );
}

/** La sección con el estado ya resuelto (separada para probarla sin efectos). */
export function SeleccionActoresVista({
  actores,
  activo,
  cargado,
  onElegir,
}: {
  actores: readonly ActorDelSelector[];
  activo: CalcMuestraComponente | null;
  cargado: boolean;
  onElegir: (id: string) => void;
}) {
  const irASeccion = useIrASeccionGeneral();
  const actor = activo ? actores.find((a) => a.id === activo.id) ?? null : null;

  return (
    // Sin pestaña que la controle no es un tabpanel: es la región de la
    // sección, nombrada por el encabezado de la mesa (h2).
    <section
      id="cmv2-section-acreditacion-seleccion"
      className="cmv2-tab-panel cmg-acred-seleccion"
      aria-labelledby="cmg-seccion-titulo"
      data-audit-ready={cargado ? "true" : "false"}
      data-qa-geometry-group="calc-muestra/acreditacion-seleccion"
      data-qa-geometry-contract="intrinsic"
    >
      {!activo || !actor ? (
        <section className="cmv2-panel" aria-labelledby="cmg-actores-titulo" data-qa-geometry-member>
          <div className="cmv2-panel-head">
            <div>
              <span className="cmv2-eyebrow">Actores</span>
              <h3 className="cmg-panel-titulo" id="cmg-actores-titulo">Marco y sorteo por actor</h3>
            </div>
          </div>
          <EmptyState
            icon={<Users size={20} aria-hidden="true" />}
            title="Aún no hay actores"
            hint="Siguiente: crea en Actores a quiénes vas a encuestar; cada uno se sortea por separado."
            cta={(
              <button type="button" className="cmv2-primary" onClick={() => irASeccion("actores")}>
                Ir a Actores
              </button>
            )}
          />
        </section>
      ) : (
        <>
          <SelectorActor actores={actores} activoId={activo.id} onElegir={onElegir} />
          <div
            id={ID_TRABAJO_DEL_ACTOR}
            className="cmg-actor-trabajo"
            role="region"
            aria-label={`Marco y sorteo de ${actor.nombre}`}
            data-qa-geometry-member
          >
            {actor.tecnica.sorteable ? (
              <>
                <ArchivoMarcoGeneral key={`marco-${activo.id}`} componente={activo} />
                <SeleccionGeneral key={`sorteo-${activo.id}`} componente={activo} enActor />
              </>
            ) : (
              <>
                <ActorSinSorteo nombre={actor.nombre} tecnica={actor.tecnica} onActores={() => irASeccion("actores")} />
                {/* En Acreditación la técnica sale del N del marco: cambiar el
                    archivo puede devolver al actor a una técnica sorteable. */}
                {actor.conMarco && <ArchivoMarcoGeneral key={`marco-${activo.id}`} componente={activo} />}
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function ActorSinSorteo({
  nombre,
  tecnica,
  onActores,
}: {
  nombre: string;
  tecnica: TecnicaDelActor;
  onActores: () => void;
}) {
  return (
    <section className="cmv2-panel cmg-sin-sorteo" aria-label={`${nombre}: sin sorteo`}>
      <EmptyState
        icon={<CircleSlash2 size={20} aria-hidden="true" />}
        title={tecnica.clase === "cuotas" ? `${nombre} va por cuotas` : `${nombre} no se sortea aquí`}
        hint={tecnica.motivo ?? undefined}
        cta={(
          <button type="button" className="cmv2-ghost" onClick={onActores}>
            Ver su meta en Actores
          </button>
        )}
      />
    </section>
  );
}
