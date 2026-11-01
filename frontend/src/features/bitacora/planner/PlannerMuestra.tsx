// Planner › Muestra: universo y variables de cuota de cada población
// (ADR 0122 §3). Es de lectura (decisión de Meta B): se edita en Cálculo de
// muestra, que la declara en el Planner (F4 del ADR 0121). Las celdas con
// cuota no viven aquí: son del diseñador (Cálculo de muestra u Hojas de ruta).

import { Link } from "react-router-dom";

import type { PlannerTipoPerfil } from "../../../api/planner";
import { PlannerCabecera } from "./PlannerCabecera";
import { ETIQUETA_PERFIL } from "./plannerCopia";
import type { ControlPlanner } from "./usePlanner";

// Cálculo aterriza en el modo que fija el perfil; Hojas de ruta diseña el territorial.
const RUTA_CALCULO = "/calc-muestra";

// Quién lee hoy lo declarado (sólo lo declarado, no lo proyectado): Monitoreo de
// aulas lo cruza con las celdas del diseño (monitoreo_aulas_representatividad_planner.R).
const LA_LEE: Partial<Record<PlannerTipoPerfil, string>> = { aulas: "Monitoreo de aulas, contra las celdas del diseño" };

export function PlannerMuestra({ control }: { control: ControlPlanner }) {
  const { estado } = control;
  if (!estado) return null;
  const poblaciones = estado.planner.perfiles.flatMap((p) => p.poblaciones.map((x) => ({ perfil: p, poblacion: x })));

  return (
    <div className="planner-seccion">
      <PlannerCabecera
        titulo="Muestra"
        lead="A quién representa cada población del estudio y por qué variables se fija su cuota."
        origen={estado.origen.perfiles}
        declaradoEn={estado.declaradoEn.perfiles}
        acciones={<Link className="plan-button" to={RUTA_CALCULO}>Editar en Cálculo de muestra</Link>}
      />
      {poblaciones.length === 0 ? (
        <p className="planner-vacio">Declara primero los perfiles de recojo: cada población declara aquí su universo.</p>
      ) : (
        <div className="planner-perfiles">
          {poblaciones.map(({ perfil, poblacion }) => {
            const rep = poblacion.representatividad;
            const variables = rep?.variables ?? [];
            return (
              <article key={`${perfil.tipo}-${poblacion.id}`} className="planner-perfil" aria-label={`${poblacion.etiqueta}, ${ETIQUETA_PERFIL[perfil.tipo]}`}>
                <h3>{poblacion.etiqueta}</h3>
                <span className="planner-tipo-detalle">{ETIQUETA_PERFIL[perfil.tipo]}</span>
                {rep ? (
                  <dl className="planner-modos">
                    <div><dt>Universo</dt><dd>{rep.universo?.etiqueta || rep.universo?.nivel || "Sin nombre"}</dd></div>
                    <div>
                      <dt>Población del universo</dt>
                      <dd>{rep.universo?.poblacion != null ? rep.universo.poblacion.toLocaleString("es-PE") : "Sin dato"}</dd>
                    </div>
                    <div>
                      <dt>Variables de cuota</dt>
                      <dd>
                        {variables.length
                          ? variables.map((v) => <span key={v.clave} className="planner-chip">{v.etiqueta || v.clave}</span>)
                          : "Ninguna"}
                      </dd>
                    </div>
                    <div><dt>La lee</dt><dd>{LA_LEE[perfil.tipo] ?? "Ningún módulo todavía"}</dd></div>
                  </dl>
                ) : (
                  <p className="planner-vacio">Sin universo ni variables de cuota declarados todavía.</p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
