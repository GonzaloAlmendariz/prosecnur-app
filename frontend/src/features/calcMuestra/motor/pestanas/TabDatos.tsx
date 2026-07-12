/**
 * Pestaña Datos: fuente (proyecto activo / manual), configuración de la
 * institución y editor de unidades académicas. El motor no trae datos fijos:
 * aquí se define o se conecta la instancia del proyecto.
 */
import { useState } from "react";
import { Database, Plus, Trash2 } from "lucide-react";
import { fmtInt } from "../../sharedCore";
import { PERFIL_EJEMPLO, PLANTILLA_ESCUELA, PLANTILLA_UNIVERSIDAD, poblacionTotal, type FacultadDatos, type PerfilInstitucional } from "../../dominio";
import { useMotorStore } from "../store";
import { NotaPorQue } from "../componentes/NotaPorQue";

const ETIQUETAS_UNIDAD = ["facultad", "escuela", "grado", "carrera"];

function slugNombre(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || `unidad-${Date.now()}`;
}

function FilaUnidad({
  unidad,
  editable,
  onPatch,
  onRemove,
}: {
  unidad: FacultadDatos;
  editable: boolean;
  onPatch: (patch: Partial<FacultadDatos>) => void;
  onRemove: () => void;
}) {
  const num = (value: string) => Math.max(0, Math.round(Number(value) || 0));
  if (!editable) {
    return (
      <div className="rec-editor-fila" role="row">
        <span role="cell">{unidad.nombre}</span>
        <span role="cell">{fmtInt(unidad.N)}</span>
        <span role="cell">{fmtInt(unidad.mujeres)}</span>
        <span role="cell">{fmtInt(unidad.hombres)}</span>
        <span role="cell">{unidad.estAulaMediana ?? "—"}</span>
        <span role="cell" />
      </div>
    );
  }
  return (
    <div className="rec-editor-fila" role="row">
      <input
        role="cell"
        type="text"
        value={unidad.nombre}
        aria-label="Nombre de la unidad"
        onChange={(e) => onPatch({ nombre: e.target.value })}
      />
      <span role="cell" className="rec-editor-n">{fmtInt(unidad.N)}</span>
      <input
        role="cell"
        type="number"
        min={0}
        value={unidad.mujeres}
        aria-label="Población del segmento A"
        onChange={(e) => {
          const mujeres = num(e.target.value);
          onPatch({ mujeres, N: mujeres + unidad.hombres });
        }}
      />
      <input
        role="cell"
        type="number"
        min={0}
        value={unidad.hombres}
        aria-label="Población del segmento B"
        onChange={(e) => {
          const hombres = num(e.target.value);
          onPatch({ hombres, N: unidad.mujeres + hombres });
        }}
      />
      <input
        role="cell"
        type="number"
        min={1}
        step={0.5}
        value={unidad.estAulaMediana ?? ""}
        placeholder="—"
        aria-label="Estudiantes elegibles por aula"
        onChange={(e) => {
          const valor = Number(e.target.value);
          const est = Number.isFinite(valor) && valor > 0 ? valor : null;
          onPatch({ estAulaMediana: est, estAulaMedia: est });
        }}
      />
      <button type="button" role="cell" className="rec-editor-borrar" aria-label={`Quitar ${unidad.nombre}`} onClick={onRemove}>
        <Trash2 size={13} aria-hidden="true" />
      </button>
    </div>
  );
}

export function TabDatos({
  perfilEfectivo,
  usaProyecto,
  hayDatosProyecto,
  onIrAFuentes,
}: {
  perfilEfectivo: PerfilInstitucional;
  usaProyecto: boolean;
  hayDatosProyecto: boolean;
  /** Navega a la pestaña Fuentes de esta misma sección. */
  onIrAFuentes: () => void;
}) {
  const fuente = useMotorStore((s) => s.fuente);
  const setFuente = useMotorStore((s) => s.setFuente);
  const cargarPerfil = useMotorStore((s) => s.cargarPerfil);
  const setInstitucion = useMotorStore((s) => s.setInstitucion);
  const setModeloBases = useMotorStore((s) => s.setModeloBases);
  const upsertUnidad = useMotorStore((s) => s.upsertUnidad);
  const eliminarUnidad = useMotorStore((s) => s.eliminarUnidad);
  const [nuevaUnidad, setNuevaUnidad] = useState("");

  const editable = !usaProyecto;
  const unidades = perfilEfectivo.facultades;
  const etiquetas = perfilEfectivo.etiquetasSexo;

  function agregarUnidad() {
    const nombre = nuevaUnidad.trim();
    if (!nombre) return;
    upsertUnidad({
      id: slugNombre(nombre),
      nombre,
      N: 0,
      mujeres: 0,
      hombres: 0,
      estAulaMediana: null,
      estAulaMedia: null,
      alcanzables: null,
      pExito: null,
    });
    setNuevaUnidad("");
  }

  return (
    <div className="rec-cap">
      <section className="rec-bloque">
        <h3>Fuente de datos</h3>
        <div className="rec-segmented" role="radiogroup" aria-label="Fuente de datos">
          <button
            type="button"
            role="radio"
            aria-checked={fuente === "proyecto"}
            data-activo={fuente === "proyecto" || undefined}
            disabled={!hayDatosProyecto}
            onClick={() => setFuente("proyecto")}
          >
            Proyecto activo
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={fuente === "manual"}
            data-activo={fuente === "manual" || undefined}
            onClick={() => setFuente("manual")}
          >
            Manual
          </button>
        </div>
        {fuente === "proyecto" && !hayDatosProyecto && (
          <p className="rec-chip-ilustrativo">
            El proyecto aún no tiene estratos con población. Carga la base en la pestaña Fuentes o
            trabaja en modo manual.{" "}
            <button type="button" className="rec-link" onClick={onIrAFuentes}>
              Ir a Fuentes →
            </button>
          </p>
        )}
        {usaProyecto && (
          <p className="rec-chip-real">
            <Database size={12} aria-hidden="true" /> Unidades, población y marco provienen del
            proyecto abierto. Los criterios y parámetros de esta sección se aplican sobre esos datos.
          </p>
        )}
        {editable && (
          <div className="rec-plantillas">
            <span>Iniciar desde:</span>
            <button type="button" className="rec-link" onClick={() => cargarPerfil(PLANTILLA_UNIVERSIDAD.id)}>
              Plantilla universidad (2 bases)
            </button>
            <button type="button" className="rec-link" onClick={() => cargarPerfil(PLANTILLA_ESCUELA.id)}>
              Plantilla base plana
            </button>
            <button type="button" className="rec-link" onClick={() => cargarPerfil(PERFIL_EJEMPLO.id)}>
              Caso de ejemplo
            </button>
          </div>
        )}
      </section>

      <section className="rec-bloque">
        <h3>Institución</h3>
        <div className="rec-institucion">
          <label>
            <span>Nombre</span>
            <input
              type="text"
              value={editable ? perfilEfectivo.nombre : perfilEfectivo.nombre}
              disabled={!editable}
              onChange={(e) => setInstitucion({ nombre: e.target.value })}
            />
          </label>
          <label>
            <span>Unidad de estratificación</span>
            <select
              value={perfilEfectivo.etiquetaUnidad}
              onChange={(e) => setInstitucion({ etiquetaUnidad: e.target.value })}
            >
              {ETIQUETAS_UNIDAD.map((opcion) => (
                <option key={opcion} value={opcion}>{opcion}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Etapa</span>
            <select
              value={perfilEfectivo.etapa}
              onChange={(e) => setInstitucion({ etapa: e.target.value as PerfilInstitucional["etapa"] })}
            >
              <option value="propuesta">Propuesta (data del periodo anterior)</option>
              <option value="campo">Campo (base del periodo de aplicación)</option>
            </select>
          </label>
          <label>
            <span>Modelo de datos</span>
            <div className="rec-segmented" role="radiogroup" aria-label="Modelo de datos">
              <button
                type="button"
                role="radio"
                aria-checked={perfilEfectivo.modeloDatos.bases === 2}
                data-activo={perfilEfectivo.modeloDatos.bases === 2 || undefined}
                disabled={!editable}
                onClick={() => setModeloBases(2)}
              >
                2 bases relacionadas
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={perfilEfectivo.modeloDatos.bases === 1}
                data-activo={perfilEfectivo.modeloDatos.bases === 1 || undefined}
                disabled={!editable}
                onClick={() => setModeloBases(1)}
              >
                1 base plana
              </button>
            </div>
          </label>
        </div>
        <NotaPorQue pregunta="Requisitos del modelo de datos">
          {perfilEfectivo.modeloDatos.descripcion} Riesgo a controlar: {perfilEfectivo.modeloDatos.riesgo}
        </NotaPorQue>
      </section>

      <section className="rec-bloque">
        <h3>
          Unidades académicas
          {unidades.length > 0 && (
            <span className="rec-bloque-contador">
              {unidades.length} · N = {fmtInt(poblacionTotal(unidades))}
            </span>
          )}
        </h3>
        {unidades.length === 0 ? (
          <p className="rec-chip-ilustrativo">
            Sin unidades definidas. Agrega las unidades con su población por segmento, o carga el
            caso de ejemplo para operar el motor con datos de referencia.
          </p>
        ) : (
          <div className="rec-editor" role="table" aria-label="Unidades académicas">
            <div className="rec-editor-fila rec-editor-head" role="row">
              <span role="columnheader">{perfilEfectivo.etiquetaUnidad}</span>
              <span role="columnheader">N</span>
              <span role="columnheader">{etiquetas[0]}</span>
              <span role="columnheader">{etiquetas[1]}</span>
              <span role="columnheader">Elegibles/aula</span>
              <span role="columnheader" />
            </div>
            {unidades.map((unidad) => (
              <FilaUnidad
                key={unidad.id}
                unidad={unidad}
                editable={editable}
                onPatch={(patch) => upsertUnidad({ ...unidad, ...patch })}
                onRemove={() => eliminarUnidad(unidad.id)}
              />
            ))}
          </div>
        )}
        {editable && (
          <div className="rec-editor-agregar">
            <input
              type="text"
              placeholder={`Nueva ${perfilEfectivo.etiquetaUnidad}…`}
              value={nuevaUnidad}
              aria-label="Nombre de la nueva unidad"
              onChange={(e) => setNuevaUnidad(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") agregarUnidad();
              }}
            />
            <button type="button" className="rec-pie-nav" onClick={agregarUnidad} disabled={!nuevaUnidad.trim()}>
              <Plus size={14} aria-hidden="true" /> Agregar
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
