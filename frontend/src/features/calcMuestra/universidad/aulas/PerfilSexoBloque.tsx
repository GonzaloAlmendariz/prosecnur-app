/**
 * Bloque de sexo del perfil de la muestra (I5).
 *
 * «De qué está hecha la muestra» enseñaba tamaño, sesión y nivel — y callaba
 * el sexo, la dimensión que el estudio certifica por celda. Aquí: cuántas
 * mujeres y hombres elegibles alcanzan las aulas titulares de cada facultad,
 * con la composición del MARCO de esa facultad como marca de referencia (la
 * misma gramática visual que los demás bloques del perfil).
 */
import type { PerfilSexo } from "./perfilSexoModel";
import { fmtInt } from "../../sharedCore";
import "./perfilSexo.css";

function pctTxt(v: number): string {
  return `${Math.round(v * 100)}%`;
}

export function PerfilSexoBloque({ perfil }: { perfil: PerfilSexo | null }) {
  if (!perfil) return null;
  const { filas, totales } = perfil;
  const totalMuestra = totales.mujeres + totales.hombres;
  if (totalMuestra <= 0) return null;

  return (
    <div className="cmv2-perfil-bloque">
      <header className="cmv2-perfil-head">
        <span className="cmv2-eyebrow">Mujeres y hombres</span>
        <h4>A quiénes alcanza la muestra, por facultad</h4>
        <p>
          Elegibles de las aulas titulares, por sexo declarado en el marco. La
          marca vertical es la proporción de mujeres del marco completo de esa
          facultad: si la barra y la marca coinciden, la muestra se parece a su
          marco.
          {totales.aulasSinSexo > 0 ? (
            <>
              {" "}
              <strong>{fmtInt(totales.aulasSinSexo)}</strong>{" "}
              {totales.aulasSinSexo === 1 ? "aula titular no declara" : "aulas titulares no declaran"}{" "}
              sexo y no suman a ningún lado.
            </>
          ) : null}
        </p>
      </header>
      <ol className="cmv2-psx-lista">
        {filas.map((fila) => {
          const total = fila.mujeres + fila.hombres;
          const pctMujeres = total > 0 ? fila.mujeres / total : 0;
          return (
            <li key={fila.facultad}>
              <span className="cmv2-psx-nombre">{fila.facultad}</span>
              <span
                className="cmv2-psx-track"
                role="img"
                aria-label={`${fila.facultad}: ${fmtInt(fila.mujeres)} mujeres (${pctTxt(pctMujeres)}) y ${fmtInt(fila.hombres)} hombres elegibles${fila.refMujeres != null ? `; el marco tiene ${pctTxt(fila.refMujeres)} de mujeres` : ""}`}
              >
                <span className="cmv2-psx-mujeres" style={{ width: `${pctMujeres * 100}%` }} />
                {fila.refMujeres != null ? (
                  <i className="cmv2-psx-ref" style={{ left: `${fila.refMujeres * 100}%` }} />
                ) : null}
              </span>
              <span className="cmv2-psx-cifras">
                {fmtInt(fila.mujeres)} M · {fmtInt(fila.hombres)} H
              </span>
            </li>
          );
        })}
      </ol>
      <p className="cmv2-perfil-pie">
        En total la muestra alcanza <strong>{fmtInt(totales.mujeres)}</strong> mujeres y{" "}
        <strong>{fmtInt(totales.hombres)}</strong> hombres elegibles (
        {pctTxt(totales.mujeres / totalMuestra)} de mujeres).
      </p>
    </div>
  );
}
