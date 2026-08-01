/**
 * Pestaña Distribución (sección Cálculo): población y muestra por unidad
 * académica y sexo, y aulas por unidad. Salidas reactivas del cálculo, a ancho
 * completo (dos columnas Población | Cuotas) con barras apiladas por sexo. La
 * cobertura del marco vive en la sección Marco.
 */
import type { PerfilInstitucional, ResultadoEscenario1 } from "../../dominio";
import { sexSeriesDisplayLabel } from "../../sexoPalette";
import { fmtDec, fmtInt } from "../../sharedCore";
import { normalizeUniversityLabel } from "../../universidad/shared/format";
import { BarrasDistribucion } from "../componentes/BarrasDistribucion";
import { BarrasFacultad } from "../componentes/BarrasFacultad";
import { useMotorStore } from "../../store";

export function planCursosHorarioPublicable({
  confirmado,
  marcoDesactualizado,
  final,
}: {
  confirmado: boolean;
  marcoDesactualizado: boolean;
  final: Record<string, number>;
}) {
  return confirmado && !marcoDesactualizado ? final : null;
}

export function TabDistribucion({
  perfil,
  e1,
  marcoDesactualizado = false,
}: {
  perfil: PerfilInstitucional;
  e1: ResultadoEscenario1;
  marcoDesactualizado?: boolean;
}) {
  // Plan definitivo de cursos-horario por facultad (§5.3): cuando el usuario lo
  // confirma, este gráfico deja de estimar y muestra las cifras acordadas.
  const cursosHorarioConfirmado = useMotorStore((s) => s.decisiones.cursosHorarioConfirmado);
  const cursosHorarioFinal = useMotorStore((s) => s.decisiones.cursosHorarioFinal);
  if (e1.N === 0) {
    return (
      <div className="rec-cap">
        <p className="rec-chip-ilustrativo">
          Sin población definida no hay distribución que mostrar. Define unidades en la pestaña
          Datos o conecta el proyecto activo.
        </p>
      </div>
    );
  }

  const definitivos = planCursosHorarioPublicable({
    confirmado: cursosHorarioConfirmado,
    marcoDesactualizado,
    final: cursosHorarioFinal,
  });
  const finalPorFacultad = (nombre: string): number | null => {
    if (!definitivos) return null;
    if (definitivos[nombre] != null) return definitivos[nombre];
    const clave = normalizeUniversityLabel(nombre);
    const hit = Object.entries(definitivos).find(([k]) => normalizeUniversityLabel(k) === clave);
    return hit ? hit[1] : null;
  };
  const usaDefinitivos = definitivos != null && e1.cuotas.some((c) => finalPorFacultad(c.nombre) != null);
  const hayAulas = usaDefinitivos || e1.cuotas.some((c) => c.aulas != null);
  const totalAulasDefinitivos = usaDefinitivos
    ? e1.cuotas.reduce((acc, c) => acc + (finalPorFacultad(c.nombre) ?? c.aulas ?? 0), 0)
    : 0;

  return (
    <div className="rec-cap">
      <div className="rec-dist-cols">
        <section className="rec-bloque">
          <h3>Población por {perfil.etiquetaUnidad} y sexo</h3>
          <p className="rec-bloque-sub">
            Elegibles de cada unidad y su reparto por sexo — la base del reparto proporcional de la
            muestra.
          </p>
          <BarrasDistribucion
            ariaLabel={`Población por ${perfil.etiquetaUnidad} y sexo`}
            etiquetasSexo={perfil.etiquetasSexo}
            total={e1.N}
            totalLabel="N"
            filas={[...perfil.facultades]
              .sort((a, b) => b.N - a.N)
              .map((f) => ({
                id: f.id,
                nombre: f.nombre,
                total: f.N,
                segA: f.mujeres,
                segB: f.hombres,
                anotacion: `${fmtInt(f.mujeres)} · ${fmtInt(f.hombres)}`,
              }))}
          />
        </section>

        <section className="rec-bloque">
          <h3>Cuotas de muestra por {perfil.etiquetaUnidad} y sexo</h3>
          <p className="rec-bloque-sub">
            Afijación proporcional con cuadratura. {sexSeriesDisplayLabel(perfil.etiquetasSexo[0])}:{" "}
            <strong>{fmtInt(e1.totalMujeres)}</strong> · {sexSeriesDisplayLabel(perfil.etiquetasSexo[1])}:{" "}
            <strong>{fmtInt(e1.totalHombres)}</strong>.
          </p>
          <BarrasDistribucion
            ariaLabel={`Cuotas de muestra por ${perfil.etiquetaUnidad} y sexo`}
            etiquetasSexo={perfil.etiquetasSexo}
            total={e1.nDiseno}
            totalLabel="n"
            filas={[...e1.cuotas]
              .sort((a, b) => b.n - a.n)
              .map((c) => ({
                id: c.facultadId,
                nombre: c.nombre,
                total: c.n,
                segA: c.nMujeres,
                segB: c.nHombres,
                etiqueta: fmtInt(c.n),
                anotacion: `${fmtInt(c.nMujeres)} · ${fmtInt(c.nHombres)}${c.ajuste !== 0 ? ` · +${c.ajuste} cuadr.` : ""}`,
                resaltada: c.ajuste !== 0,
              }))}
          />
        </section>
      </div>

      {hayAulas && usaDefinitivos && (
        <section className="rec-bloque">
          <h3>Cursos-horario por {perfil.etiquetaUnidad}</h3>
          <BarrasFacultad
            ariaLabel={`Cursos-horario definitivos por ${perfil.etiquetaUnidad}`}
            leyenda={
              <span>
                Plan confirmado: <strong>{fmtInt(totalAulasDefinitivos)}</strong> cursos-horario definitivos ·
                cifras acordadas en «Cursos-horario por facultad»
              </span>
            }
            filas={[...e1.cuotas]
              .map((c) => ({ c, final: finalPorFacultad(c.nombre) ?? c.aulas ?? 0 }))
              .filter((x) => x.final > 0)
              .sort((a, b) => b.final - a.final)
              .map(({ c, final }) => ({
                id: c.facultadId,
                nombre: c.nombre,
                valor: final,
                etiqueta: fmtInt(final),
                anotacion: `cuota ${fmtInt(c.n)} · ${fmtDec(c.estAula, 1)} alumnos/curso-horario`,
              }))}
          />
        </section>
      )}
      {hayAulas && !usaDefinitivos && (
        <section className="rec-bloque">
          <h3>Cursos-horario por {perfil.etiquetaUnidad}</h3>
          <BarrasFacultad
            ariaLabel={`Cursos-horario por ${perfil.etiquetaUnidad}`}
            leyenda={
              <span>
                Estimación: <strong>{fmtInt(e1.aulasConBolsa)}</strong> cursos-horario · CEIL(sobremuestra ÷
                elegibles por curso-horario) + reserva. Confirma el plan en «Cursos-horario por facultad» para cifras definitivas.
              </span>
            }
            filas={[...e1.cuotas]
              .filter((c) => c.aulas != null)
              .sort((a, b) => (b.aulas ?? 0) - (a.aulas ?? 0))
              .map((c) => ({
                id: c.facultadId,
                nombre: c.nombre,
                valor: c.aulas ?? 0,
                etiqueta: fmtInt(c.aulas),
                anotacion: `${fmtInt(c.sobremuestra)} enc. ÷ ${fmtDec(c.estAula, 1)}/curso-horario`,
              }))}
          />
        </section>
      )}
      {!hayAulas && (
        <p className="rec-chip-ilustrativo">
          Para el cálculo de cursos-horario, define «elegibles por curso-horario» en cada unidad (pestaña Datos) o
          construye el marco del proyecto para medirlo.
        </p>
      )}
    </div>
  );
}
