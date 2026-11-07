
import type { PlannerModos, PlannerTipoPerfil } from "../../api/planner";
import { ETIQUETA_PERFIL } from "../estudio/copiaDelEstudio";
import { EnlaceFichaDelEstudio } from "../estudio/EnlaceFichaDelEstudio";
import { PerfilNoDeclarado } from "../estudio/PerfilNoDeclarado";
import { deskDeModo } from "./navegacion";
import type { ActiveDesk } from "./sharedCore";
import { TIPOS_DE_ESTUDIO } from "./SelectorTipo";
import { Panel } from "../../components/Panel";

/**
 * Aterrizaje de Cálculo de muestra según el Planner (ADR 0122, fase P2).
 *
 * El tipo de estudio ya no se elige aquí: lo fija el perfil de recojo que el
 * estudio declara en el Planner (`GET /api/planner/modos`). Este componente
 * reemplaza al selector de tipos:
 *
 * - con un modo declarado y sin escenario, un solo botón: «Empezar el diseño»;
 * - con un escenario de OTRO modo, dice cuál declara el Planner y qué se pierde
 *   al cambiar (`perdidas`), con confirmación;
 * - sin modo, el vacío propio del Planner; si la muestra la entrega el cliente,
 *   lo dice.
 */

export type DecisionDeAterrizaje =
  | { tipo: "cargando" }
  | { tipo: "error"; mensaje: string }
  | { tipo: "sin-perfil" }
  | { tipo: "del-cliente"; perfiles: PlannerTipoPerfil[] }
  | { tipo: "empezar"; desk: ActiveDesk; titulo: string }
  | { tipo: "cambiar"; desk: ActiveDesk; titulo: string; actual: string }
  | { tipo: "al-dia"; desk: ActiveDesk };

function tituloDe(desk: string): string {
  return TIPOS_DE_ESTUDIO.find((t) => t.id === desk)?.title ?? desk.replace(/_/g, " ");
}

export function decidirAterrizaje(
  modos: PlannerModos | null,
  currentDesk: ActiveDesk,
  hayEscenario: boolean,
  error: string | null = null,
): DecisionDeAterrizaje {
  if (!modos) return error ? { tipo: "error", mensaje: error } : { tipo: "cargando" };
  const desk = deskDeModo(modos.calc.modo) as ActiveDesk | null;
  if (!desk) {
    return modos.calc.delCliente.length
      ? { tipo: "del-cliente", perfiles: modos.calc.delCliente }
      : { tipo: "sin-perfil" };
  }
  if (!hayEscenario) return { tipo: "empezar", desk, titulo: tituloDe(desk) };
  if (desk === currentDesk) return { tipo: "al-dia", desk };
  return { tipo: "cambiar", desk, titulo: tituloDe(desk), actual: tituloDe(currentDesk) };
}

export function AterrizajeDelPlanner({ decision, perdidas, confirmando, onEmpezar, onPedirCambio, onCancelar, onConfirmar }: {
  decision: DecisionDeAterrizaje;
  perdidas: readonly string[];
  /** El cambio ya se pidió y espera confirmación. */
  confirmando: boolean;
  onEmpezar: (desk: ActiveDesk) => void;
  onPedirCambio: (desk: ActiveDesk) => void;
  onCancelar: () => void;
  onConfirmar: () => void;
}) {
  if (decision.tipo === "cargando") {
    return <Panel className="cmv2-aterrizaje" aria-busy="true" data-audit-ready="false">{null}</Panel>;
  }
  if (decision.tipo === "error") {
    return (
      <Panel
        className="cmv2-aterrizaje"
        role="status"
        aria-labelledby="cmv2-aterrizaje-titulo"
        title={<span id="cmv2-aterrizaje-titulo">No se pudo leer el tipo del estudio</span>}
        hint={decision.mensaje}
        data-audit-ready="vacio:planner-ilegible"
      >
        {null}
      </Panel>
    );
  }
  if (decision.tipo === "sin-perfil") {
    return <PerfilNoDeclarado detalle="Cálculo de muestra abre en el modo que fija el tipo del estudio." />;
  }
  if (decision.tipo === "del-cliente") {
    return (
      <Panel
        className="cmv2-aterrizaje"
        role="status"
        aria-labelledby="cmv2-aterrizaje-titulo"
        title={<span id="cmv2-aterrizaje-titulo">La muestra la entrega el cliente</span>}
        hint={`En un estudio ${decision.perfiles.map((t) => ETIQUETA_PERFIL[t].toLowerCase()).join(", ")} la muestra no se calcula aquí.`}
        data-audit-ready="vacio:muestra-del-cliente"
      >
        <EnlaceFichaDelEstudio>Ver la ficha del estudio</EnlaceFichaDelEstudio>
      </Panel>
    );
  }
  if (decision.tipo === "al-dia") {
    return (
      <Panel
        className="cmv2-aterrizaje"
        role="status"
        aria-labelledby="cmv2-aterrizaje-titulo"
        title={<span id="cmv2-aterrizaje-titulo">El escenario ya es el que fija el tipo del estudio</span>}
        data-audit-ready="calc-muestra-aterrizaje"
      >
        <div><button type="button" className="pulso-button pulso-button--secondary" onClick={onCancelar}>Volver al escenario</button></div>
      </Panel>
    );
  }
  if (decision.tipo === "empezar") {
    return (
      <Panel
        className="cmv2-aterrizaje"
        aria-labelledby="cmv2-aterrizaje-titulo"
        title={<span id="cmv2-aterrizaje-titulo">{decision.titulo}</span>}
        hint="Es el diseño que fija el tipo declarado en la ficha del estudio."
        data-audit-ready="calc-muestra-aterrizaje"
      >
        <div>
          <button type="button" className="pulso-button is-primary" onClick={() => onEmpezar(decision.desk)}>
            Empezar el diseño
          </button>
        </div>
      </Panel>
    );
  }
  return (
    <Panel
      className="cmv2-aterrizaje"
      aria-labelledby="cmv2-aterrizaje-titulo"
      title={<span id="cmv2-aterrizaje-titulo">El tipo del estudio pide «{decision.titulo}»</span>}
      hint={`Este escenario es «${decision.actual}». Para cambiarlo hay que reiniciar el cálculo.`}
      data-audit-ready="calc-muestra-aterrizaje"
    >
      {confirmando ? (
        <>
          {perdidas.length ? (
            <ul className="cmv2-sal-nota">
              {perdidas.map((p) => <li key={p}>{p}</li>)}
            </ul>
          ) : null}
          <div className="cmv2-aterrizaje-acciones">
            <button type="button" className="pulso-button pulso-button--secondary" onClick={onCancelar}>Conservar el escenario</button>
            <button type="button" className="pulso-button is-primary" onClick={onConfirmar}>Reiniciar como «{decision.titulo}»</button>
          </div>
        </>
      ) : (
        <div className="cmv2-aterrizaje-acciones">
          <button type="button" className="pulso-button pulso-button--secondary" onClick={onCancelar}>Volver al escenario</button>
          <button type="button" className="pulso-button is-primary" onClick={() => onPedirCambio(decision.desk)}>Cambiar a «{decision.titulo}»</button>
        </div>
      )}
    </Panel>
  );
}
