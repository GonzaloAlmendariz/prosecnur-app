// Peso tomado de una columna de la base (contrato E4-E7, R2).
//
// Una medición anterior suele traer su peso ya calculado (`factor_ponderacion`
// en el .sav). Recalibrarla sería otro método; aquí se declara que el peso ES
// esa columna. La config vive en la de la base activa
// (`analitica_config_por_base[[base]].ponderacion`), así que cada base declara
// el suyo: se cambia de base con el selector de Analítica.

import type { VariableInstrumento } from "../../../api/client";
import type { LecturaVariables } from "./variablesDeLaBase";
import "./PesoPorColumna.css";

export type PesoPorColumnaProps = {
  modo: "calibracion" | "columna";
  pesoColumna: string;
  /** La lectura de las variables de la base activa: cargando, lista o error. */
  lectura: LecturaVariables;
  baseActiva: string | null;
  onModo: (modo: "calibracion" | "columna") => void;
  onColumna: (columna: string) => void;
};

/** Candidatas a peso: numéricas, con las que nombran un peso primero. */
export function columnasCandidatasAPeso(variables: readonly VariableInstrumento[]): VariableInstrumento[] {
  const pareceraPeso = (v: VariableInstrumento) => /pond|peso|weight|factor|wgt/i.test(v.name);
  return variables
    .filter((v) => v.numerica && !v.categorica)
    .sort((a, b) => Number(pareceraPeso(b)) - Number(pareceraPeso(a)) || a.name.localeCompare(b.name, "es"));
}

/**
 * Lo que el control dice en lugar del selector. «No tiene columnas numéricas»
 * sólo tras una respuesta real sin candidatas: mientras carga, o si la lectura
 * falló, no se sabe y no se afirma (F7). `null`: se muestra el selector.
 */
export function avisoColumnasDePeso(
  lectura: LecturaVariables,
  pesoColumna: string,
): { tipo: "cargando" | "error" | "sin-numericas"; texto: string } | null {
  if (lectura.tipo === "cargando") return { tipo: "cargando", texto: "Cargando las columnas de la base…" };
  if (lectura.tipo === "error") {
    return { tipo: "error", texto: "No se pudieron leer las columnas de la base. Vuelve a abrir Ponderación para reintentar." };
  }
  if (columnasCandidatasAPeso(lectura.variables).length === 0 && !pesoColumna) {
    return { tipo: "sin-numericas", texto: "Esta base no tiene columnas numéricas. Un peso tomado de una columna necesita una." };
  }
  return null;
}

export function PesoPorColumna({
  modo,
  pesoColumna,
  lectura,
  baseActiva,
  onModo,
  onColumna,
}: PesoPorColumnaProps) {
  const candidatas = columnasCandidatasAPeso(lectura.tipo === "lista" ? lectura.variables : []);
  const aviso = avisoColumnasDePeso(lectura, pesoColumna);
  // Sólo con la lista leída se sabe si la columna declarada falta en la base.
  const declarada = lectura.tipo === "lista" && pesoColumna && !candidatas.some((v) => v.name === pesoColumna);
  return (
    <section
      className="pulso-peso-columna"
      aria-labelledby="pulso-peso-columna-titulo"
      data-qa-geometry-group="analitica-peso-origen"
      data-qa-geometry-contract="intrinsic"
    >
      <div className="pulso-peso-columna-head" data-qa-geometry-member>
        <strong id="pulso-peso-columna-titulo">De dónde sale el peso</strong>
        {baseActiva && <small>Se guarda para la base {baseActiva}. Cada base declara el suyo.</small>}
      </div>
      <div className="analitica-segmented" role="radiogroup" aria-label="De dónde sale el peso" data-qa-geometry-member>
        <button
          type="button"
          role="radio"
          aria-checked={modo === "calibracion"}
          className={modo === "calibracion" ? "is-on" : ""}
          onClick={() => onModo("calibracion")}
        >
          Calcular pesos
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={modo === "columna"}
          className={modo === "columna" ? "is-on" : ""}
          onClick={() => onModo("columna")}
        >
          Usar una columna de la base como peso
        </button>
      </div>

      {modo === "columna" && (
        <div className="pulso-peso-columna-cuerpo" data-qa-geometry-member>
          {aviso ? (
            // C3/C5: el vacío es del control y dice cuál es: cargando, error
            // de lectura o vacío legítimo de la base tras una respuesta real.
            <p
              className="pulso-peso-columna-aviso"
              data-peso-columnas={aviso.tipo}
              role={aviso.tipo === "error" ? "alert" : "status"}
            >
              {aviso.texto}
              {pesoColumna && aviso.tipo !== "sin-numericas" ? ` Columna declarada: ${pesoColumna}.` : ""}
            </p>
          ) : (
            <label className="pulso-peso-columna-campo">
              <span>Columna de peso</span>
              <select value={pesoColumna} onChange={(e) => onColumna(e.target.value)}>
                <option value="">Elige una columna numérica</option>
                {declarada && <option value={pesoColumna}>{pesoColumna} (no está en la base)</option>}
                {candidatas.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.label && v.label !== v.name ? `${v.name}: ${v.label.slice(0, 60)}` : v.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {declarada && (
            <p className="pulso-peso-columna-aviso">
              La columna {pesoColumna} no está en esta base. Los reportes fallarán hasta que elijas otra.
            </p>
          )}
          <p className="pulso-peso-columna-nota">
            Frecuencias, cruces y dimensiones usan esa columna como peso. Los valores vacíos
            cuentan como cero. No hay diagnóstico previo: el efecto se ve en los reportes y en la
            ficha técnica.
          </p>
        </div>
      )}
    </section>
  );
}
