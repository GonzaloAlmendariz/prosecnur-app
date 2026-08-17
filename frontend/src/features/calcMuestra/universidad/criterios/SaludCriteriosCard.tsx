/**
 * Qué criterios de aula NO pueden evaluarse sobre el marco vigente.
 *
 * El mismo defecto volvió cuatro veces y siempre igual: un criterio declarado
 * sobre una columna que no lleva lo que dice, y el motor sigue adelante y
 * publica un marco. `exclude_level_patterns` buscaba «posgrado» en un número de
 * ciclo y no excluía ni una aula; `session_type` llegaba vacío en las 5.263
 * aulas del proyecto real, así que el criterio que DEFINE el marco no podía
 * declararse; `teacher_type` publicó nombres propios como categorías. En los
 * cuatro casos nadie se enteró.
 *
 * La distinción que esta tarjeta existe para hacer: un criterio **sin señal**
 * deja pasar a todos porque no había con qué filtrar, y eso **no es lo mismo**
 * que un criterio que se midió y no dejó fuera a nadie.
 *
 * El desglose por facultad no es decorativo: una columna con señal global puede
 * venir vacía en una facultad concreta, y ahí el criterio tampoco filtra.
 */
import { useState } from "react";
import type {
  CalcMuestraSaludCriterioFila,
  CalcMuestraSaludCriterios,
} from "../../../../api/calcMuestra";
import { fmtInt } from "../../sharedCore";

/** Sólo estos estados piden acción; el resto se resume sin ocupar sitio. */
const PROBLEMA = new Set(["sin_senal", "sin_coincidencia", "sin_categorias", "parcial"]);

const ETIQUETA: Record<string, string> = {
  sin_senal: "sin señal",
  sin_coincidencia: "ninguna categoría existe",
  sin_categorias: "sin categorías",
  parcial: "categorías incompletas",
  ok: "evaluable",
  desconocido: "sin medir",
};

function FilaCriterio({ fila }: { fila: CalcMuestraSaludCriterioFila }) {
  const [abierto, setAbierto] = useState(false);
  // Las facultades vienen ordenadas de la peor cubierta a la mejor; sólo son
  // interesantes las que no llegan a todas sus aulas.
  const flojas = fila.por_facultad.filter((f) => f.con_valor < f.aulas);
  return (
    <li className="cmv2-salud-crit" data-estado={fila.estado}>
      <div className="cmv2-salud-crit-head">
        <strong>{fila.label}</strong>
        <span className="cmv2-salud-crit-estado">{ETIQUETA[fila.estado] ?? fila.estado}</span>
        <span className="cmv2-salud-crit-cifra">
          {fmtInt(fila.aulas_con_valor)} de {fmtInt(fila.aulas)} aulas con dato
          {fila.categorias_declaradas > 0 ? (
            <> · {fmtInt(fila.categorias_presentes)} de {fmtInt(fila.categorias_declaradas)} categorías</>
          ) : null}
        </span>
      </div>
      {fila.aviso ? <p className="cmv2-salud-crit-aviso">{fila.aviso}</p> : null}
      {fila.categorias_ausentes.length ? (
        <p className="cmv2-salud-crit-ausentes">
          No existen en la base: {fila.categorias_ausentes.join(", ")}
        </p>
      ) : null}
      {flojas.length ? (
        <>
          <button
            type="button"
            className="cmv2-salud-crit-mas"
            aria-expanded={abierto}
            onClick={() => setAbierto((v) => !v)}
          >
            {abierto ? "Ocultar" : "Ver"} las {fmtInt(flojas.length)} facultades donde falta dato
          </button>
          {abierto ? (
            <ul className="cmv2-salud-crit-facs">
              {flojas.map((f) => (
                <li key={f.facultad}>
                  <span>{f.facultad}</span>
                  <span>
                    {fmtInt(f.con_valor)} de {fmtInt(f.aulas)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </li>
  );
}

export function SaludCriteriosCard({ salud }: { salud: CalcMuestraSaludCriterios | null }) {
  if (!salud || !salud.filas.length) return null;
  const conProblema = salud.filas.filter((f) => PROBLEMA.has(f.estado));
  const sanos = salud.filas.length - conProblema.length;

  if (!conProblema.length) {
    // Decirlo con la cifra: «todo bien» sin número no distingue un marco sano
    // de una comprobación que no llegó a correr.
    return (
      <section className="cmv2-salud-card" data-estado="ok" aria-label="Salud de los criterios">
        <header>
          <strong>Los criterios de curso-horario se pueden evaluar</strong>
        </header>
        <p>
          Los <strong>{fmtInt(sanos)}</strong> criterios declarados encuentran su columna
          en el marco y sus categorías existen en la base.
        </p>
      </section>
    );
  }

  return (
    <section className="cmv2-salud-card" data-estado="alerta" aria-label="Salud de los criterios">
      <header>
        <strong>
          {conProblema.length === 1
            ? "Un criterio no se puede evaluar sobre este marco"
            : `${fmtInt(conProblema.length)} criterios no se pueden evaluar sobre este marco`}
        </strong>
        <span>
          {sanos > 0 ? `Los otros ${fmtInt(sanos)} sí.` : null} Reconstruye el marco
          después de corregir el mapeo.
        </span>
      </header>
      <ul className="cmv2-salud-lista">
        {conProblema.map((f) => (
          <FilaCriterio key={f.criterion_id} fila={f} />
        ))}
      </ul>
    </section>
  );
}
