// Planner › Muestra: universo y variables de cuota de cada población
// (ADR 0122 §3). En esta etapa es de lectura: la declaración la escribe la F4
// del ADR 0121 por la puerta del Planner. Las celdas con cuota no viven aquí:
// son del diseñador (Cálculo de muestra u Hojas de ruta).

import { PlannerCabecera } from "./PlannerCabecera";
import { ETIQUETA_PERFIL } from "./plannerCopia";
import type { ControlPlanner } from "./usePlanner";

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
