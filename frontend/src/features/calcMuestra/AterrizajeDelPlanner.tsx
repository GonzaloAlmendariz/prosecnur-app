import { Link } from "react-router-dom";

import type { PlannerModos } from "../../api/planner";
import { PerfilNoDeclarado, RUTA_PERFILES_DEL_PLANNER } from "../bitacora/planner/PerfilNoDeclarado";
import { deskDeModo } from "./navegacion";
import type { ActiveDesk } from "./sharedCore";
import { TIPOS_DE_ESTUDIO } from "./SelectorTipo";

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
  | { tipo: "del-cliente"; perfiles: string[] }
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
    return <section className="cmv2-panel cmv2-aterrizaje" aria-busy="true" data-audit-ready="false" />;
  }
  if (decision.tipo === "error") {
    return (
      <section className="cmv2-panel cmv2-aterrizaje" role="status" data-audit-ready="vacio:planner-ilegible">
        <strong>No se pudo leer el Planner</strong>
        <p className="cmv2-sal-nota">{decision.mensaje}</p>
      </section>
    );
  }
  if (decision.tipo === "sin-perfil") {
    return <PerfilNoDeclarado detalle="Cálculo de muestra abre en el modo que fija el perfil de recojo del estudio." />;
  }
  if (decision.tipo === "del-cliente") {
    return (
      <section className="cmv2-panel cmv2-aterrizaje" role="status" data-audit-ready="vacio:muestra-del-cliente">
        <strong>La muestra la entrega el cliente</strong>
        <p className="cmv2-sal-nota">
          El Planner declara que el diseño de este estudio ({decision.perfiles.join(", ")}) no se calcula aquí.
        </p>
        <Link to={RUTA_PERFILES_DEL_PLANNER}>Ver los perfiles en el Planner</Link>
      </section>
    );
  }
  if (decision.tipo === "al-dia") {
    return (
      <section className="cmv2-panel cmv2-aterrizaje" role="status" data-audit-ready="calc-muestra-aterrizaje">
        <strong>El escenario ya es el que declara el Planner</strong>
        <div><button type="button" className="pulso-button pulso-button--secondary" onClick={onCancelar}>Volver al escenario</button></div>
      </section>
    );
  }
  if (decision.tipo === "empezar") {
    return (
      <section className="cmv2-panel cmv2-aterrizaje" aria-label="Empezar el diseño" data-audit-ready="calc-muestra-aterrizaje">
        <strong>{decision.titulo}</strong>
        <p className="cmv2-sal-nota">Es el diseño que fija el perfil de recojo declarado en el Planner.</p>
        <div>
          <button type="button" className="pulso-button is-primary" onClick={() => onEmpezar(decision.desk)}>
            Empezar el diseño
          </button>
        </div>
      </section>
    );
  }
  return (
    <section className="cmv2-panel cmv2-aterrizaje" aria-label="El Planner declara otro diseño" data-audit-ready="calc-muestra-aterrizaje">
      <strong>El Planner declara «{decision.titulo}»</strong>
      <p className="cmv2-sal-nota">Este escenario es «{decision.actual}». Para cambiarlo hay que reiniciar el cálculo.</p>
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
    </section>
  );
}
