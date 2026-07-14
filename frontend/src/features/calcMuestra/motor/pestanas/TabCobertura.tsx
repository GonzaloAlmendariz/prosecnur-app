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
import { BarrasFacultad } from "../componentes/BarrasFacultad";

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
          menos un curso-horario incluido. Construye el marco desde tus fuentes (pestañas Población y Cursos-horario) o
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
        <section className="rec-bloque rec-cobertura">
          <header className="rec-cobertura-cabecera">
            <div>
              <h3>Población elegible por {perfil.etiquetaUnidad}</h3>
              <p>
                Distribución que entra al reparto. La fracción alcanzable se completa al cruzar
                estudiantes con los cursos-horario del marco.
              </p>
            </div>
            <dl className="rec-cobertura-resumen">
              <div>
                <dt>Elegibles</dt>
                <dd>{fmtInt(cob.totalElegibles)}</dd>
              </div>
              <div>
                <dt>{unidades === 1 ? "Unidad" : "Unidades"}</dt>
                <dd>{fmtInt(unidades)}</dd>
              </div>
              {perfil.marcoAulas != null && (
                <div>
                  <dt>Cursos-horario</dt>
                  <dd>{fmtInt(perfil.marcoAulas)}</dd>
                </div>
              )}
              <div data-pendiente>
                <dt>Alcanzables</dt>
                <dd>Por medir</dd>
              </div>
            </dl>
          </header>
          <BarrasFacultad
            ariaLabel={`Población elegible por ${perfil.etiquetaUnidad}`}
            variante="cobertura"
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
      </div>
    );
  }

  // --- Con alcanzables medidos: cobertura real + factibilidad ---------------
  const totalAlcanzables = cob.totalAlcanzables ?? 0;
  const noAlcanzables = cob.totalElegibles - totalAlcanzables;

  return (
    <div className="rec-cap">
      <section className="rec-bloque rec-cobertura">
        <header className="rec-cobertura-cabecera">
          <div>
            <h3>Elegibles y alcanzables por {perfil.etiquetaUnidad}</h3>
            <p>La franja sólida muestra los alcanzables; el estado final contrasta su sobremuestra.</p>
          </div>
          <dl className="rec-cobertura-resumen">
            <div>
              <dt>Cobertura</dt>
              <dd>{fmtPct(cob.pctGlobal)}</dd>
            </div>
            <div>
              <dt>Alcanzables</dt>
              <dd>{fmtInt(totalAlcanzables)}</dd>
            </div>
            <div>
              <dt>No alcanzables</dt>
              <dd>{fmtInt(noAlcanzables)}</dd>
            </div>
            <div data-alerta={cob.filas.some((fila) => fila.factible === false) || undefined}>
              <dt>Unidades factibles</dt>
              <dd>{cob.filas.filter((f) => f.factible === true).length} / {cob.filas.length}</dd>
            </div>
          </dl>
        </header>
        <BarrasFacultad
          ariaLabel={`Cobertura por ${perfil.etiquetaUnidad}`}
          variante="cobertura"
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
    </div>
  );
}
