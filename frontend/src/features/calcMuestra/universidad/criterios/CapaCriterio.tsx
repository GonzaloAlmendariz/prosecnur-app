/**
 * En qué CAPA actúa un criterio de alumno.
 *
 * El motor distingue tres y sólo la primera recorta el marco: `marco` saca del
 * universo a quien no cumple, `instrumento` se pregunta en el cuestionario y se
 * valida en campo, `procesamiento` se aplica al depurar la base. La distinción
 * está en el backend desde el principio —`defaultLayer` por variable,
 * `marco_ok <- marco_ok & flag` sólo cuando la capa es `marco`— y el catálogo la
 * publica al front, que ya tenía `capaDe` y `setLayer` en el dominio, con tests.
 *
 * Lo que faltaba era el mando. Nadie llamaba a `setLayer` desde producción, así
 * que la capa de cada criterio era la que trajera el proyecto y NO se podía
 * cambiar. En HSVG2026 eso se ve: «Ciclo o nivel curricular» nace en
 * `instrumento` por defecto, deja pasar 100.920 de 136.284 filas y no recorta
 * nada; si el estudio quisiera excluir del marco a los de primer ciclo —no
 * preguntarles y descartarlos después, sino no muestrearlos— no había forma de
 * decirlo desde la interfaz.
 *
 * La capa es de la variable, no de la facultad: mueve el criterio entero. Las
 * diferencias por facultad se declaran con las excepciones, que son otra cosa.
 */
import type { CriterioLayer, CriterioSeleccion, CriterioVariable } from "../../../../api/client";
import { capaDe, setLayer } from "../../dominio";

/**
 * Qué hace cada capa, en una línea. El orden importa: `marco` va primero porque
 * es la única que cambia el N, y la diferencia entre las otras dos es CUÁNDO se
 * comprueba, no si recorta.
 *
 * Cada línea dice qué HACE su capa, no lo que no hace. La de arriba —el recorte
 * medido— ya avisa «en capa instrumento no recorta el marco» cuando hay marco
 * construido; repetirlo aquí sería decir dos veces lo mismo en dos renglones
 * seguidos. Que sólo `marco` recorte se lee de que sólo `marco` lo menciona.
 */
export const CAPAS_CRITERIO: Array<{ id: CriterioLayer; label: string; efecto: string }> = [
  {
    id: "marco",
    label: "Marco",
    efecto: "Recorta el universo: quien no cumple queda fuera de la muestra.",
  },
  {
    id: "instrumento",
    label: "Instrumento",
    efecto: "Se pregunta en el cuestionario y se comprueba en campo.",
  },
  {
    id: "procesamiento",
    label: "Procesamiento",
    efecto: "Se aplica al depurar la base, después del campo.",
  },
];

export function CapaCriterio({
  variable,
  sel,
  onSel,
}: {
  variable: CriterioVariable;
  sel: CriterioSeleccion;
  onSel: (next: CriterioSeleccion) => void;
}) {
  // Sólo los criterios de alumno tienen capa: los de aula construyen el marco
  // de cursos-horario y no hay dónde más aplicarlos.
  if (variable.scope !== "alumno") return null;
  const actual = capaDe(sel, variable);
  const activa = CAPAS_CRITERIO.find((c) => c.id === actual) ?? CAPAS_CRITERIO[0];

  return (
    <div className="cmv2-crit-capa" data-capa={actual}>
      <div className="cmv2-crit-capa-head">
        <span className="cmv2-crit-capa-label" id={`capa-${variable.id}`}>
          Dónde se aplica
        </span>
        <div className="cmv2-crit-capa-opciones" role="radiogroup" aria-labelledby={`capa-${variable.id}`}>
          {CAPAS_CRITERIO.map((capa) => (
            <button
              key={capa.id}
              type="button"
              role="radio"
              aria-checked={capa.id === actual}
              className="cmv2-crit-capa-btn"
              data-activa={capa.id === actual ? "true" : "false"}
              title={capa.efecto}
              onClick={() => {
                if (capa.id === actual) return;
                onSel(setLayer(sel, capa.id));
              }}
            >
              {capa.label}
            </button>
          ))}
        </div>
      </div>
      <p className="cmv2-crit-capa-efecto">{activa.efecto}</p>
    </div>
  );
}
