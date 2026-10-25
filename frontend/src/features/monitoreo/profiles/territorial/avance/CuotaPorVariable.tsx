import { fmt } from "../rotulos";
import type { VariableDeCuota } from "./faltanteModel";

/**
 * Una sub-tarjeta por variable de cuota (Sexo, Edad), como la tarjeta de UMP
 * de la antigua Validación › Cuotas que Gonzalo tomó de modelo (estándar
 * §2a-bis): cabecera con la suma, una fila por celda con su barra y su estado
 * en chip. Las sub-tarjetas hermanas van en rejilla de columnas iguales.
 */
export function CuotaPorVariable({ variables, titulo }: { variables: readonly VariableDeCuota[]; titulo?: string }) {
  if (!variables.length) return null;
  return (
    <div
      className="mon-ter-variables"
      role="group"
      aria-label={titulo ?? "Cuota por variable"}
      data-qa-geometry-group="territorial-cuota-variables"
      data-qa-geometry-contract="intrinsic"
    >
      {variables.map((variable) => (
        <section key={variable.nombre} className="mon-ter-variable" aria-label={`Cuota por ${variable.nombre.toLowerCase()}`} data-qa-geometry-member={variable.nombre}>
          <header>
            <h5>{variable.nombre}</h5>
            <b>{fmt(variable.logrado)} / {fmt(variable.meta)}</b>
          </header>
          <ul>
            {variable.celdas.map((celda) => {
              const ancho = celda.meta > 0 ? Math.min(100, (celda.logrado / celda.meta) * 100) : 0;
              return (
                <li key={celda.clave} className={celda.falta > 0 ? "is-falta" : ""}>
                  <span className="mon-ter-variable-rotulo">{celda.rotulo}</span>
                  <i className="mon-ter-variable-barra" aria-hidden="true"><b style={{ width: `${ancho}%` }} /></i>
                  <span className="mon-ter-variable-cifra">{fmt(celda.logrado)} / {fmt(celda.meta)}</span>
                  <span className={`mon-ter-chip ${celda.falta > 0 ? "is-falta" : "is-ok"}`}>
                    {celda.falta > 0 ? `Falta ${fmt(celda.falta)}` : "Completa"}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
