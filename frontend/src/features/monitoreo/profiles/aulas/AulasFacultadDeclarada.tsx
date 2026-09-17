import { useMemo, useState } from "react";
import { Check, GraduationCap, Wand2 } from "../../../../vendor/lucide-react";
import { contar } from "../../fuentes/vocabulario";
import {
  codigosOrdenados, codigosSinMapear, etiquetasGuardables, propuestaPorOrden,
  veredictoDelCruce, type MapaFacultades,
} from "./facultadDeclarada";
import "./aulasFacultadDeclarada.css";

/**
 * Declarar QUÉ pregunta dice la facultad del alumno, y qué es cada código.
 *
 * Es el gemelo de la variable de sexo, y existe por lo mismo: la plataforma
 * manda «7», no «Ciencias y Artes de la Comunicación». Sin las dos cosas
 * declaradas no hay cruce entre la facultad de su curso-horario y la que el
 * alumno dice, y sin ese cruce no se puede saber si la cuota de una facultad
 * la está llenando gente de otra — que es de lo que avisa la hoja «Control de
 * facultad».
 *
 * **Propone, no supone.** El cuestionario lista las facultades en alfabético y
 * los códigos van del 1 en adelante, así que el emparejamiento por orden
 * acierta casi siempre; se ofrece con un botón, se ve entero y alguien lo
 * confirma. Y al guardar, el motor devuelve cuánto coincide: con el catálogo
 * bien, 95 %; corrido una sola posición, 1 %. Esa devolución es lo que
 * convierte quince desplegables en una decisión verificable.
 */

export type AulasFacultadDeclaradaProps = {
  /** Variables de la base, para elegir cuál es. */
  variables: ReadonlyArray<{ name: string; values?: ReadonlyArray<string> }>;
  /** Lo declarado hoy. */
  facultadVar?: string;
  etiquetas?: MapaFacultades;
  /** Las facultades que el plan conoce: son las que el desplegable ofrece. */
  facultadesDelPlan: ReadonlyArray<string>;
  /** El resumen del cruce que devuelve el motor, para decir si el mapeo sirve. */
  control?: { ok?: boolean; motivo?: string; comparables?: number; coinciden?: number } | null;
  onDeclarar: (variable: string, etiquetas: MapaFacultades) => void | Promise<void>;
  ocupado?: boolean;
};

export default function AulasFacultadDeclarada({
  variables, facultadVar = "", etiquetas = {}, facultadesDelPlan,
  control = null, onDeclarar, ocupado = false,
}: AulasFacultadDeclaradaProps) {
  // Mientras nadie toca nada, la pantalla ES lo declarado: sin estado que
  // sincronizar no pueden separarse, y se pinta sin ejecutar un efecto.
  const [editado, setEditado] = useState<{ variable: string; mapa: MapaFacultades } | null>(null);
  const variable = editado?.variable ?? facultadVar;
  const mapa = editado?.mapa ?? etiquetas;

  const valores = useMemo(
    () => variables.find((v) => v.name === variable)?.values ?? [],
    [variables, variable],
  );
  const codigos = useMemo(() => codigosOrdenados(valores.map(String)), [valores]);
  const faltan = useMemo(() => codigosSinMapear(codigos, mapa), [codigos, mapa]);
  const guardables = useMemo(() => etiquetasGuardables(mapa), [mapa]);
  const veredicto = useMemo(() => veredictoDelCruce(control), [control]);

  const propuesta = useMemo(
    () => propuestaPorOrden(codigos, facultadesDelPlan),
    [codigos, facultadesDelPlan],
  );
  const puedeProponer = Object.keys(propuesta).length > 0;

  const editar = (siguiente: Partial<{ variable: string; mapa: MapaFacultades }>) => {
    setEditado({ variable, mapa, ...siguiente });
  };

  return (
    <div className="aulas-facultad-declarada">
      <label className="aulas-facultad-selector">
        <span>Variable que dice la facultad del alumno</span>
        <select
          value={variable}
          onChange={(e) => editar({ variable: e.target.value, mapa: {} })}
        >
          <option value="">sin declarar</option>
          {variables.map((v) => <option key={v.name} value={v.name}>{v.name}</option>)}
        </select>
      </label>
      <em>
        {variable
          ? "Con ella, el libro trae la hoja «Control de facultad»: qué cuota está llenando gente de otra facultad."
          : "Sin ella no hay cruce entre la facultad de su curso-horario y la que el alumno declara: no se adivina qué columna es."}
      </em>

      {variable && codigos.length ? (
        <>
          <div className="aulas-facultad-mandos">
            <button
              type="button"
              disabled={!puedeProponer}
              title={puedeProponer
                ? "El cuestionario suele listar las facultades en alfabético; esto empareja por orden para que sólo tengas que revisarlo"
                : `No se puede proponer: la base trae ${contar(codigos.length, "código", "códigos")} y el plan conoce ${contar(facultadesDelPlan.length, "facultad", "facultades")}. Emparejar por posición correría el catálogo entero.`}
              onClick={() => editar({ mapa: propuesta })}
            >
              <Wand2 size={14} aria-hidden="true" /> Proponer por orden alfabético
            </button>
            {faltan.length ? (
              <span className="aulas-facultad-faltan">
                {contar(faltan.length, "código sin facultad", "códigos sin facultad")}: {faltan.join(", ")}
              </span>
            ) : null}
          </div>

          <ul className="aulas-facultad-mapa">
            {codigos.map((codigo) => (
              <li key={codigo}>
                <span className="aulas-facultad-codigo">{codigo}</span>
                <select
                  aria-label={`Facultad del código ${codigo}`}
                  value={mapa[codigo] ?? ""}
                  onChange={(e) => editar({ mapa: { ...mapa, [codigo]: e.target.value } })}
                >
                  <option value="">sin asignar</option>
                  {facultadesDelPlan.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </li>
            ))}
          </ul>

          <div className="aulas-facultad-acciones">
            <button
              type="button"
              className="aulas-facultad-guardar"
              disabled={ocupado || Object.keys(guardables).length === 0}
              onClick={() => {
                void Promise.resolve(onDeclarar(variable, guardables))
                  .then(() => setEditado(null));
              }}
            >
              {ocupado ? "Guardando…" : "Guardar la facultad declarada"}
            </button>
            {veredicto.texto ? (
              <span className={`aulas-facultad-veredicto es-${veredicto.tono}`}>
                {veredicto.tono === "ok" ? <Check size={13} aria-hidden="true" /> : null}
                {veredicto.texto}
              </span>
            ) : null}
          </div>
        </>
      ) : null}
      {variable && !codigos.length ? (
        <p className="aulas-facultad-vacio">
          <GraduationCap size={14} aria-hidden="true" />
          Esa variable no trae valores en la base sincronizada, así que no hay códigos que emparejar.
        </p>
      ) : null}
    </div>
  );
}
