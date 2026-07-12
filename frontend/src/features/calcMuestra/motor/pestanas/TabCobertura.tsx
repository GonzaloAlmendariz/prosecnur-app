/**
 * Pestaña Cobertura (sección Marco): el cierre del cruce población × marco.
 *
 * Cuando el proyecto expone los elegibles ALCANZABLES por el marco (caso de
 * referencia o motor que emite el cruce), muestra la cobertura real por unidad
 * y la prueba de factibilidad. Cuando aún no —los proyectos reales no traen
 * el conteo de alcanzables por unidad en el frame— no deja la vista vacía:
 * muestra la población elegible por unidad (dato duro) y explica con claridad
 * qué falta para medir la fracción alcanzable, en vez de una tira suelta.
 */
import { CheckCircle2, TriangleAlert } from "lucide-react";
import type { FilaCobertura, PerfilInstitucional } from "../../dominio";
import { fmtInt, fmtPct } from "../../sharedCore";
import { CifraFila, CifraMotor } from "../../universidad/ui";
import { BarrasFacultad } from "../componentes/BarrasFacultad";
import { NotaPorQue } from "../componentes/NotaPorQue";

export function TabCobertura({
  perfil,
  cob,
}: {
  perfil: PerfilInstitucional;
  cob: { filas: FilaCobertura[]; totalElegibles: number; totalAlcanzables: number | null; pctGlobal: number | null };
}) {
  // Sin población medida no hay nada que cruzar: estado vacío limpio.
  if (!cob.filas.length || cob.totalElegibles <= 0) {
    return (
      <div className="rec-cap">
        <p className="rec-chip-ilustrativo">
          La cobertura cruza población y marco: qué parte de los elegibles está matriculada en al
          menos un aula incluida. Construye el marco desde tus fuentes (pestañas Población y Aulas) o
          usa el caso de ejemplo para verla.
        </p>
      </div>
    );
  }

  const medida = cob.totalAlcanzables != null;
  const unidades = cob.filas.length;

  // --- Sin alcanzables por unidad: población elegible + qué falta -----------
  if (!medida) {
    return (
      <div className="rec-cap">
        <CifraFila>
          <CifraMotor
            label="Población elegible"
            value={fmtInt(cob.totalElegibles)}
            detalle={`en ${fmtInt(unidades)} ${unidades === 1 ? "unidad" : "unidades"}`}
            hero
          />
          {perfil.marcoAulas != null && (
            <CifraMotor
              label="Marco de aulas"
              value={fmtInt(perfil.marcoAulas)}
              detalle="aulas incluidas en el marco"
            />
          )}
          <CifraMotor
            label="Fracción alcanzable"
            value="por medir"
            detalle="requiere el cruce población × aulas por unidad"
          />
        </CifraFila>

        <section className="rec-bloque">
          <h3>Población elegible por {perfil.etiquetaUnidad}</h3>
          <p className="rec-bloque-sub">
            Elegibles de cada unidad tras aplicar los criterios. La <strong>fracción alcanzable</strong>{" "}
            —los que están matriculados en al menos un aula del marco— se mide al cruzar población y
            aulas; este proyecto aún no expone ese cruce por unidad, así que aquí ves la población
            elegible que entra al reparto.
          </p>
          <BarrasFacultad
            ariaLabel={`Población elegible por ${perfil.etiquetaUnidad}`}
            filas={[...cob.filas]
              .sort((a, b) => b.elegibles - a.elegibles)
              .map((fila) => ({
                id: fila.facultadId,
                nombre: fila.nombre,
                valor: fila.elegibles,
                etiqueta: fmtInt(fila.elegibles),
              }))}
          />
        </section>

        <NotaPorQue pregunta="¿Cómo se mide la fracción alcanzable?">
          Se cruza cada estudiante elegible con las aulas incluidas en el marco: quien no aparece en
          ninguna aula del marco no es alcanzable en campo, aunque cuente para N. Ese cruce por unidad
          lo produce el motor al construir el marco con población y catálogo de aulas relacionados; el
          caso de ejemplo ya lo trae medido.
        </NotaPorQue>
      </div>
    );
  }

  // --- Con alcanzables medidos: cobertura real + factibilidad ---------------
  const totalAlcanzables = cob.totalAlcanzables ?? 0;
  const noAlcanzables = cob.totalElegibles - totalAlcanzables;

  return (
    <div className="rec-cap">
      <CifraFila>
        <CifraMotor
          label="Cobertura del marco"
          value={fmtPct(cob.pctGlobal)}
          detalle={`${fmtInt(totalAlcanzables)} de ${fmtInt(cob.totalElegibles)} elegibles alcanzables`}
          hero
          tono="ok"
        />
        <CifraMotor
          label="No alcanzables"
          value={fmtInt(noAlcanzables)}
          detalle="solo aparecen en aulas excluidas del marco"
        />
        <CifraMotor
          label="Factibilidad"
          value={`${cob.filas.filter((f) => f.factible === true).length} / ${cob.filas.length}`}
          detalle="unidades con alcanzables ≥ sobremuestra"
          tono={cob.filas.every((f) => f.factible !== false) ? "ok" : "alerta"}
        />
      </CifraFila>

      <section className="rec-bloque">
        <h3>Elegibles y alcanzables por {perfil.etiquetaUnidad}</h3>
        <p className="rec-bloque-sub">
          Barra completa: elegibles. Franja sólida: alcanzables por el marco. A la derecha, la
          prueba de factibilidad frente a la sobremuestra de cada unidad.
        </p>
        <BarrasFacultad
          ariaLabel={`Cobertura por ${perfil.etiquetaUnidad}`}
          filas={[...cob.filas]
            .sort((a, b) => b.elegibles - a.elegibles)
            .map((fila) => ({
              id: fila.facultadId,
              nombre: fila.nombre,
              valor: fila.elegibles,
              overlay: fila.alcanzables ?? undefined,
              etiqueta: `${fmtPct(fila.pct)} · ${fmtInt(fila.alcanzables)}`,
              anotacion:
                fila.factible == null ? null : fila.factible ? (
                  <span className="rec-factible" data-ok>
                    <CheckCircle2 size={13} aria-hidden="true" /> cubre {fmtInt(fila.sobremuestra)}
                  </span>
                ) : (
                  <span className="rec-factible">
                    <TriangleAlert size={13} aria-hidden="true" /> no llega a {fmtInt(fila.sobremuestra)}
                  </span>
                ),
            }))}
        />
      </section>

      <NotaPorQue pregunta="Lectura de la factibilidad">
        Una cobertura global alta no basta: cada unidad debe conservar población alcanzable
        suficiente para llenar su sobremuestra. Si una unidad no llega, el diseño requiere ajustar
        criterios del marco o el reparto antes de ir a campo.
      </NotaPorQue>
    </div>
  );
}
