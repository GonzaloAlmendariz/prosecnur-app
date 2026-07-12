/**
 * Pestaña Distribución (sección Cálculo): población y muestra por unidad
 * académica y sexo, y aulas por unidad. Salidas reactivas del cálculo; la
 * cobertura del marco vive en la sección Marco.
 */
import type { PerfilInstitucional, ResultadoEscenario1 } from "../../dominio";
import { fmtDec, fmtInt } from "../../sharedCore";
import { BarrasFacultad } from "../componentes/BarrasFacultad";

export function TabDistribucion({
  perfil,
  e1,
}: {
  perfil: PerfilInstitucional;
  e1: ResultadoEscenario1;
}) {
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

  const [segA, segB] = perfil.etiquetasSexo;
  const hayAulas = e1.cuotas.some((c) => c.aulas != null);

  return (
    <div className="rec-cap">
      <section className="rec-bloque">
        <h3>Población por {perfil.etiquetaUnidad} y sexo</h3>
        <BarrasFacultad
          ariaLabel={`Población por ${perfil.etiquetaUnidad} y sexo`}
          leyenda={
            <span>
              N = <strong>{fmtInt(e1.N)}</strong> · segmento oscuro: {segA} · claro: {segB}
            </span>
          }
          filas={[...perfil.facultades]
            .sort((a, b) => b.N - a.N)
            .map((f) => ({
              id: f.id,
              nombre: f.nombre,
              valor: f.N,
              segmentos: [f.mujeres, f.hombres] as [number, number],
              anotacion: `${fmtInt(f.mujeres)} · ${fmtInt(f.hombres)}`,
            }))}
        />
      </section>

      <section className="rec-bloque">
        <h3>Cuotas de muestra por {perfil.etiquetaUnidad} y sexo</h3>
        <BarrasFacultad
          ariaLabel={`Cuotas de muestra por ${perfil.etiquetaUnidad} y sexo`}
          leyenda={
            <span>
              n = <strong>{fmtInt(e1.nDiseno)}</strong> · {segA}: {fmtInt(e1.totalMujeres)} · {segB}:{" "}
              {fmtInt(e1.totalHombres)} · afijación proporcional con cuadratura
            </span>
          }
          filas={[...e1.cuotas]
            .sort((a, b) => b.n - a.n)
            .map((c) => ({
              id: c.facultadId,
              nombre: c.nombre,
              valor: c.n,
              segmentos: [c.nMujeres, c.nHombres] as [number, number],
              etiqueta: fmtInt(c.n),
              anotacion: `${fmtInt(c.nMujeres)} · ${fmtInt(c.nHombres)}${c.ajuste !== 0 ? ` · +${c.ajuste} cuadratura` : ""}`,
              resaltada: c.ajuste !== 0,
            }))}
        />
      </section>

      {hayAulas && (
        <section className="rec-bloque">
          <h3>Aulas por {perfil.etiquetaUnidad}</h3>
          <BarrasFacultad
            ariaLabel={`Aulas por ${perfil.etiquetaUnidad}`}
            leyenda={
              <span>
                Total: <strong>{fmtInt(e1.aulasConBolsa)}</strong> aulas · CEIL(sobremuestra ÷
                elegibles por aula) + bolsa
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
                anotacion: `${fmtInt(c.sobremuestra)} enc. ÷ ${fmtDec(c.estAula, 1)}/aula`,
              }))}
          />
        </section>
      )}
      {!hayAulas && (
        <p className="rec-chip-ilustrativo">
          Para el cálculo de aulas, define «elegibles por aula» en cada unidad (pestaña Datos) o
          construye el marco del proyecto para medirlo.
        </p>
      )}

    </div>
  );
}
