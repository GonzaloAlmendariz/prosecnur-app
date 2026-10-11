/**
 * Qué variables equilibra el sorteo, y con cuántos niveles cada una.
 *
 * `balance_vars` se leía del config y no se escribía desde ninguna pantalla:
 * sacar una variable del equilibrio había que hacerlo por API. Y es la decisión
 * con más consecuencia de las que no tenían control — `program` trae 1 049
 * niveles en HSVG2026, el aterrizaje del cubo cuesta 2^columnas, y con eso el
 * sorteo no terminaba.
 *
 * El motor tiene una cota que descarta por cardinalidad y la declara en su
 * aviso, así que el cuelgue ya no ocurre; esto da la otra mitad, que es poder
 * decidirlo. Los niveles se cuentan sobre el marco entero: el motor corta POR
 * ESTRATO, así que la cifra anticipa el riesgo y no predice el corte.
 */
import { PulsoSwitch } from "../../../../components/PulsoSwitch";
import { variablesDeBalance } from "./variablesBalance";
import "./variablesBalance.css";

/** Por encima de esto, el aterrizaje del cubo deja de ser instantáneo. */
const NIVELES_RIESGO = 16;

export function VariablesBalanceControl({
  filas,
  config,
  onChange,
}: {
  filas: ReadonlyArray<Record<string, unknown>> | null | undefined;
  config: { balance_vars?: unknown; spread_vars?: unknown } | null | undefined;
  onChange: (balanceVars: string[]) => void;
}) {
  const variables = variablesDeBalance(filas, config);
  if (!variables.length) return null;
  const enBalance = variables.filter((v) => v.enBalance).map((v) => v.nombre);

  return (
    <section className="cmv2-vbal" aria-label="Variables con las que el sorteo equilibra">
      <header>
        <strong>Con qué equilibra el sorteo</strong>
        <span>
          el cubo iguala la muestra al marco en estas variables; cuantos más niveles tiene una, más
          cuesta el sorteo, y el motor descarta las que no caben declarándolo en su aviso
        </span>
      </header>
      {/* K1 (L27): cada variable es un switch chico; la lista es de pares (C1). */}
      <ul data-qa-geometry-group="aulas-variables-balance" data-qa-geometry-contract="equal">
        {variables.map((v) => (
          <li key={v.nombre} data-riesgo={v.niveles > NIVELES_RIESGO ? "" : undefined}>
            <PulsoSwitch
              size="sm"
              label={v.nombre}
              ariaLabel={`Equilibrar el sorteo por ${v.nombre}`}
              checked={v.enBalance}
              onCheckedChange={(equilibra) =>
                onChange(equilibra ? [...enBalance, v.nombre] : enBalance.filter((n) => n !== v.nombre))
              }
            />
            <span className="cmv2-vbal-niveles">
              {v.niveles.toLocaleString("es-PE")} {v.niveles === 1 ? "nivel" : "niveles"}
            </span>
            {v.constante && <em title="Sin variación en el marco: no aporta equilibrio.">constante</em>}
            {v.niveles > NIVELES_RIESGO && !v.constante && (
              <em title={`Más de ${NIVELES_RIESGO} niveles: en los estratos donde no quepa, el motor la descartará y lo dirá en el aviso del sorteo.`}>
                se descartará en los estratos grandes
              </em>
            )}
            {v.enDispersion && <span className="cmv2-vbal-disp">también en dispersión</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
