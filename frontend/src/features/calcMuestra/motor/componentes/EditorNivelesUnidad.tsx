/**
 * Editor del mapa nivel-por-unidad (criterio "nivel del curso según la unidad")
 * cuando el proyecto está activo: una fila por unidad del perfil con inputs
 * min/max (0–20) que escriben workspace.aulas_config.nivel_por_unidad usando el
 * NOMBRE de la unidad como clave (el motor R matchea por nombre normalizado).
 * Prioridad de lectura: config del workspace → mapa del perfil manual/ejemplo.
 */
import { X } from "lucide-react";
import type { FacultadDatos, PerfilInstitucional, RangoNivel } from "../../dominio";
import type { ControlesCriterios } from "./TableroCriterios";

const NIVEL_MIN = 0;
const NIVEL_MAX = 20;

function clampNivel(valor: number): number {
  return Math.min(NIVEL_MAX, Math.max(NIVEL_MIN, Math.round(valor)));
}

export function EditorNivelesUnidad({
  perfil,
  controles,
}: {
  perfil: PerfilInstitucional;
  controles: ControlesCriterios;
}) {
  const { config, onConfig } = controles;
  const nivelConfig = config.nivel_por_unidad ?? {};

  /** Rango vigente de la unidad: config del workspace primero, perfil después. */
  const rangoDe = (f: FacultadDatos): RangoNivel | null =>
    nivelConfig[f.nombre]?.[0] ?? perfil.mapaNivelPorFacultad?.[f.id]?.[0] ?? null;

  const escribir = (f: FacultadDatos, patch: Partial<RangoNivel>) => {
    const base = rangoDe(f) ?? { min: NIVEL_MIN, max: NIVEL_MAX };
    const rango: RangoNivel = {
      min: clampNivel(patch.min ?? base.min),
      max: clampNivel(patch.max ?? base.max),
    };
    onConfig({ nivel_por_unidad: { ...nivelConfig, [f.nombre]: [rango] } });
  };

  const quitar = (f: FacultadDatos) => {
    if (!(f.nombre in nivelConfig)) return;
    const siguiente = { ...nivelConfig };
    delete siguiente[f.nombre];
    onConfig({ nivel_por_unidad: siguiente });
  };

  return (
    <div className="rec-niveles rec-niveles-editor" role="table" aria-label="Rango de nivel por unidad">
      <div className="rec-niveles-head" role="row">
        <span role="columnheader">{perfil.etiquetaUnidad}</span>
        <span role="columnheader">Niveles admitidos (mín – máx)</span>
        <span role="columnheader" className="pulso-sr-only">Acciones</span>
      </div>
      {perfil.facultades.map((f) => {
        const rango = rangoDe(f);
        const enConfig = f.nombre in nivelConfig;
        return (
          <div key={f.id} className="rec-niveles-fila" role="row">
            <span role="rowheader">{f.nombre}</span>
            <span role="cell" className="rec-niveles-inputs">
              <input
                type="number"
                min={NIVEL_MIN}
                max={NIVEL_MAX}
                value={rango?.min ?? ""}
                placeholder="mín"
                aria-label={`Nivel mínimo de ${f.nombre}`}
                onChange={(e) => escribir(f, { min: Number(e.target.value) || 0 })}
              />
              <span aria-hidden="true">–</span>
              <input
                type="number"
                min={NIVEL_MIN}
                max={NIVEL_MAX}
                value={rango?.max ?? ""}
                placeholder="máx"
                aria-label={`Nivel máximo de ${f.nombre}`}
                onChange={(e) => escribir(f, { max: Number(e.target.value) || 0 })}
              />
              {!rango && <em className="rec-niveles-sinregla">sin límite</em>}
            </span>
            <span role="cell" className="rec-niveles-accion">
              <button
                type="button"
                disabled={!enConfig}
                aria-label={`Quitar rango de ${f.nombre}`}
                onClick={() => quitar(f)}
              >
                <X size={11} aria-hidden="true" />
                Quitar
              </button>
            </span>
          </div>
        );
      })}
    </div>
  );
}
