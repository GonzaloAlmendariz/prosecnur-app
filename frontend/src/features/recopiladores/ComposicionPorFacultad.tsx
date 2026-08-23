import { Panel } from "../../components/Panel";
import { Building2 } from "../../vendor/lucide-react";
import { composicionPorFacultad } from "./composicionDelPlan";
import { nombreCortoDeFacultad } from "./nombreDeFacultad";
import type { CollectionUnit } from "../../api/recopiladores";

/**
 * Qué facultades componen el plan que va a campo.
 *
 * El panel de resumen decía «193 cursos-horario», «Tipo», «Método» y
 * «Revisión»: tres metadatos técnicos y ningún dato con el que repartir gente.
 * Quien coordina el operativo reparte POR FACULTAD —Ciencias e Ingeniería lleva
 * 34 aulas y Letras y Ciencias Humanas 2— y esa proporción no estaba en ninguna
 * pantalla de Recopiladores, aunque `faculty` viaja en cada unidad del plan.
 *
 * La barra es el peso de la facultad dentro del plan. Se lee de un vistazo cuál
 * concentra el operativo, que es la pregunta con la que se abre esta pantalla.
 */

const miles = (n: number) => n.toLocaleString("es-PE");

export function ComposicionPorFacultad({ unidades }: { unidades: CollectionUnit[] }) {
  const c = composicionPorFacultad(unidades);
  if (!c.filas.length) {
    // C3: el vacío se queda dentro de la superficie y dice por qué está vacío,
    // en vez de desmontar el panel y dejar un hueco en la columna.
    return (
      <Panel
        className="rec-facultades-card"
        eyebrow="Composición"
        title={<><Building2 size={18} aria-hidden /> Por facultad</>}
      >
        <p className="rec-facultades-vacio">
          El plan no trae la facultad de sus aulas, así que no se puede repartir
          por facultad. Se reparte por cadena.
        </p>
      </Panel>
    );
  }

  const mayor = c.filas[0].titulares || 1;
  const respaldo = c.titulares > 0 ? c.reservas / c.titulares : 0;

  return (
    <Panel
      className="rec-facultades-card"
      eyebrow="Composición"
      title={<><Building2 size={18} aria-hidden /> Por facultad</>}
    >
      <p className="rec-facultades-lead">
        {c.filas.length} facultades · {miles(c.elegibles)} alumnos elegibles ·
        {" "}{respaldo.toFixed(1)} reservas por aula
      </p>
      <p className="rec-facultades-cabecera" aria-hidden>
        <span>aulas</span><span>elegibles</span>
      </p>
      <ol className="rec-facultades-lista">
        {c.filas.map((fila) => (
          <li key={fila.facultad} style={{ "--peso": `${(fila.titulares / mayor) * 100}%` } as React.CSSProperties}>
            <span className="rec-facultades-nombre" title={fila.facultad}>{nombreCortoDeFacultad(fila.facultad)}</span>
            <span className="rec-facultades-n">{fila.titulares}</span>
            <span className="rec-facultades-eleg">{miles(fila.elegibles)}</span>
          </li>
        ))}
      </ol>
      {c.sinFacultad > 0 ? (
        // Declararlo y no repartirlo: un titular sin facultad metido en la
        // primera fila descuadra el reparto de gente sin que nadie lo note.
        <p className="rec-facultades-aviso">
          {c.sinFacultad} {c.sinFacultad === 1 ? "aula no trae" : "aulas no traen"} facultad
          y {c.sinFacultad === 1 ? "queda" : "quedan"} fuera de este reparto.
        </p>
      ) : null}
    </Panel>
  );
}
