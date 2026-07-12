/**
 * Pestaña Criterios (sección Marco): criterios de inclusión de alumno y de
 * aula como controles reales sobre la configuración del proyecto, con su
 * porqué al alcance y los embudos universo → población / curso-horario →
 * marco. Cambiar un criterio y reconstruir el marco recalcula los conteos.
 */
import { Loader2, RefreshCw } from "lucide-react";
import type { PerfilInstitucional } from "../../dominio";
import { useMotorStore } from "../store";
import { EmbudoVivo } from "../componentes/EmbudoVivo";
import { EditorNivelesUnidad } from "../componentes/EditorNivelesUnidad";
import { NotaPorQue } from "../componentes/NotaPorQue";
import {
  PatronesExclusion,
  TableroCriterios,
  type ControlesCriterios,
} from "../componentes/TableroCriterios";

/** Controles reales del criterio de ALUMNO según su id. */
function ControlCriterioAlumno({
  id,
  controles,
}: {
  id: string;
  controles: ControlesCriterios;
}) {
  const { config, onConfig } = controles;
  if (id === "formacion") {
    return (
      <div className="rec-criterio-control">
        <label className="rec-criterio-switchrow">
          <button
            type="button"
            className="rec-switch"
            role="switch"
            aria-checked={config.require_undergraduate ?? true}
            aria-label="Restringir a pregrado"
            onClick={() => onConfig({ require_undergraduate: !(config.require_undergraduate ?? true) })}
          >
            <span className="rec-switch-knob" aria-hidden="true" />
          </button>
          <span>Restringir a pregrado</span>
        </label>
        {(config.require_undergraduate ?? true) && (
          <PatronesExclusion
            valores={config.exclude_level_patterns ?? []}
            onChange={(valores) => onConfig({ exclude_level_patterns: valores })}
            placeholder="nivel a excluir (p. ej. maestría)"
            ariaLabel="Niveles formativos excluidos"
          />
        )}
      </div>
    );
  }
  if (id === "edad") {
    return (
      <div className="rec-criterio-control">
        <label className="rec-criterio-switchrow">
          <button
            type="button"
            className="rec-switch"
            role="switch"
            aria-checked={config.require_adult ?? true}
            aria-label="Aplicar mayoría de edad"
            onClick={() => onConfig({ require_adult: !(config.require_adult ?? true) })}
          >
            <span className="rec-switch-knob" aria-hidden="true" />
          </button>
          <span>Exigir edad mínima</span>
        </label>
        {(config.require_adult ?? true) && (
          <label className="rec-criterio-numrow">
            <span>Edad mínima</span>
            <input
              type="number"
              min={0}
              value={config.min_age ?? 18}
              aria-label="Edad mínima"
              onChange={(e) => onConfig({ min_age: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
            />
          </label>
        )}
      </div>
    );
  }
  if (id === "condicion") {
    const condiciones = config.accepted_conditions?.length ? config.accepted_conditions : ["regular"];
    return (
      <div className="rec-criterio-control">
        <span className="rec-criterio-hint">
          Condiciones aceptadas: <strong>{condiciones.join(" · ")}</strong> — se editan en Datos →
          Elegibilidad, sobre los valores observados de la base.
        </span>
      </div>
    );
  }
  return null;
}

export function TabMarco({
  perfil,
  usaProyecto,
  controles,
  onReconstruir,
  puedeReconstruir,
  reconstruyendo,
}: {
  perfil: PerfilInstitucional;
  usaProyecto: boolean;
  /** Controles reales sobre workspace.aulas_config. */
  controles?: ControlesCriterios;
  /** Reconstruye el marco con los criterios vigentes (motor R). */
  onReconstruir?: () => void;
  puedeReconstruir?: boolean;
  reconstruyendo?: boolean;
}) {
  const opcionalesActivos = useMotorStore((s) => s.decisiones.opcionalesActivos);
  const toggleOpcional = useMotorStore((s) => s.toggleOpcional);

  return (
    <div className="rec-cap">
      {controles && onReconstruir && (
        <div className="rec-reconstruir" role="group" aria-label="Aplicar criterios al marco">
          <span>
            Los criterios modifican la configuración del proyecto; el marco se recalcula al
            reconstruirlo con el motor R.
          </span>
          <button
            type="button"
            className="rec-pie-nav"
            disabled={!puedeReconstruir || reconstruyendo}
            onClick={onReconstruir}
          >
            {reconstruyendo ? (
              <Loader2 size={14} className="pulso-spin" aria-hidden="true" />
            ) : (
              <RefreshCw size={14} aria-hidden="true" />
            )}
            Reconstruir marco
          </button>
        </div>
      )}

      <section className="rec-bloque">
        <h3>Población — criterios de alumno</h3>
        <div className="rec-criterios-grid">
          {perfil.criteriosAlumno.map((criterio) => (
            <article key={criterio.id} className="rec-criterio" data-tipo="base">
              <header>
                <strong>{criterio.etiqueta}</strong>
                <em className="rec-tag" data-capa={criterio.capa}>
                  {criterio.capa === "marco" ? "en la base" : criterio.capa === "instrumento" ? "en el instrumento" : "en procesamiento"}
                </em>
              </header>
              <p className="rec-criterio-regla">
                Incluye: {criterio.incluye}. Excluye: {criterio.excluye}.
              </p>
              <span className="rec-capa-var">variable: <code>{criterio.variable}</code>{criterio.rol === "estratifica" ? " · estratifica, no excluye" : ""}</span>
              {controles && <ControlCriterioAlumno id={criterio.id} controles={controles} />}
              <NotaPorQue>{criterio.porQue}</NotaPorQue>
            </article>
          ))}
        </div>
        {perfil.embudoAlumno ? (
          <EmbudoVivo pasos={perfil.embudoAlumno} unidad="alumnos" resultado="POBLACIÓN OBJETIVO" />
        ) : (
          <p className="rec-chip-ilustrativo">
            El embudo de alumnos se calcula sobre la base del proyecto.{" "}
            {usaProyecto
              ? "Reconstruye el marco para medirlo con los criterios vigentes."
              : "El caso de ejemplo incluye un embudo medido de referencia."}
          </p>
        )}
      </section>

      <section className="rec-bloque">
        <h3>Marco de aulas — criterios de aula</h3>
        <TableroCriterios
          criterios={perfil.criteriosAula}
          activos={opcionalesActivos}
          onToggle={toggleOpcional}
          marcoBase={perfil.marcoAulas}
          controles={controles}
        />
        {perfil.embudoAula && (
          <EmbudoVivo pasos={perfil.embudoAula} unidad="aulas" resultado="MARCO MUESTRAL" />
        )}
      </section>

      {(controles || perfil.mapaNivelPorFacultad) && perfil.facultades.length > 0 && (
        <section className="rec-bloque">
          <h3>Rango de nivel del curso por {perfil.etiquetaUnidad}</h3>
          {controles ? (
            <>
              <EditorNivelesUnidad perfil={perfil} controles={controles} />
              <span className="rec-criterio-hint">
                Los rangos se guardan en la configuración del proyecto por nombre de unidad; se
                aplican al reconstruir el marco. Sin entradas, el criterio no filtra.
              </span>
            </>
          ) : (
            <div className="rec-niveles" role="table" aria-label="Rango de nivel por unidad">
              <div className="rec-niveles-head" role="row">
                <span role="columnheader">{perfil.etiquetaUnidad}</span>
                <span role="columnheader">Niveles admitidos</span>
              </div>
              {perfil.facultades.map((f) => {
                const rangos = perfil.mapaNivelPorFacultad?.[f.id];
                if (!rangos) return null;
                return (
                  <div key={f.id} className="rec-niveles-fila" role="row">
                    <span role="rowheader">{f.nombre}</span>
                    <span role="cell" className="rec-niveles-rango">
                      {rangos.map((r) => (r.min === r.max ? `solo ${r.min}` : `${r.min} – ${r.max}`)).join(" · ")}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <NotaPorQue pregunta="Definición del mapa de niveles">
            El rango se define por unidad porque los primeros niveles pueden cursarse fuera de ella
            (p. ej. estudios generales). Un rango uniforme duplicaría aulas. El mapa se configura por
            proyecto.
          </NotaPorQue>
        </section>
      )}
    </div>
  );
}
