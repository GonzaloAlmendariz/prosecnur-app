// «Qué caso cuenta» declarado a mano. Las sugerencias sólo cubren lo que el
// formulario ya exigía; un criterio que vive fuera de él —una marca de
// selección hecha en un script, una columna «válida» del equipo, un filtro de
// población— se declara aquí: variable, «es» / «no es» y sus valores, cada uno
// con sus casos. El efecto se ve antes de agregar la condición y, con las
// condiciones puestas, cuántos casos cuentan en total.

import { useEffect, useId, useState } from "react";
import {
  apiV2CasoValidoColumnas,
  apiV2CasoValidoEfecto,
  type CasoValidoColumna,
  type CasoValidoCondicion,
  type CasoValidoEfecto,
} from "../../../api/validacion";
import { PulsoButton } from "../../../components/PulsoButton";
import { formatoConteo, formatoConteoDe } from "../../../lib/formatoNumero";
import { Plus, X } from "../../../vendor/lucide-react";
import { casosQueCumplen, condicionDesdeBorrador, textoCondicion, textoEfecto, type Sentido } from "../casoValidoManualModel";

export function CasoValidoManual({
  baseNombre,
  condiciones,
  onCambiar,
  disabled,
}: {
  baseNombre?: string | null;
  condiciones: readonly CasoValidoCondicion[];
  onCambiar: (siguientes: CasoValidoCondicion[]) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const [columnas, setColumnas] = useState<CasoValidoColumna[] | null>(null);
  const [errorColumnas, setErrorColumnas] = useState("");
  const [nBase, setNBase] = useState(0);
  const [abierto, setAbierto] = useState(false);
  const [variable, setVariable] = useState("");
  const [sentido, setSentido] = useState<Sentido>("es");
  const [valores, setValores] = useState<string[]>([]);
  const [efecto, setEfecto] = useState<CasoValidoEfecto | null>(null);

  // Las columnas se leen al abrir el editor o si ya hay condiciones que rotular.
  const necesitaColumnas = abierto || condiciones.length > 0;
  useEffect(() => {
    if (!necesitaColumnas || columnas !== null) return;
    let vivo = true;
    apiV2CasoValidoColumnas(baseNombre)
      .then((r) => { if (vivo) { setColumnas(r.columnas); setNBase(r.nTotal); } })
      .catch((e: unknown) => { if (vivo) { setColumnas([]); setErrorColumnas(e instanceof Error ? e.message : "No se pudieron leer las columnas."); } });
    return () => { vivo = false; };
  }, [necesitaColumnas, columnas, baseNombre]);

  const clave = JSON.stringify(condiciones);
  useEffect(() => {
    if (!condiciones.length) { setEfecto(null); return; }
    let vivo = true;
    apiV2CasoValidoEfecto(baseNombre, [...condiciones])
      .then((e) => { if (vivo) setEfecto(e); })
      .catch(() => { if (vivo) setEfecto(null); });
    return () => { vivo = false; };
    // `clave` resume las condiciones: el arreglo cambia de identidad en cada render.
  }, [clave, baseNombre]);

  const col = columnas?.find((c) => c.variable === variable);
  const nTotal = efecto?.n_total || nBase;
  const borrador = condicionDesdeBorrador(variable, sentido, valores);
  const colDe = (v: string) => columnas?.find((c) => c.variable === v);

  const cerrar = () => { setAbierto(false); setVariable(""); setValores([]); setSentido("es"); };
  const agregar = () => {
    if (!borrador) return;
    onCambiar([...condiciones.filter((c) => c.variable !== borrador.variable), borrador]);
    cerrar();
  };

  return (
    <div className="pulso-cvm">
      {condiciones.length ? (
        <ul className="pulso-cvm-lista" aria-label="Condiciones declaradas">
          {condiciones.map((c) => (
            <li key={c.variable}>
              <span>Cuenta si {textoCondicion(c, colDe(c.variable))}</span>
              <button
                type="button"
                className="pulso-icon"
                aria-label={`Quitar la condición sobre ${c.variable}`}
                title="Quitar la condición"
                disabled={disabled}
                onClick={() => onCambiar(condiciones.filter((x) => x.variable !== c.variable))}
              >
                <X size={12} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {efecto ? (
        <p className="pulso-cvm-efecto" role="status">
          {textoEfecto(efecto)}
          {efecto.variables_ausentes.length ? ` La base no trae ${efecto.variables_ausentes.join(", ")}: esa condición no saca a nadie.` : ""}
        </p>
      ) : null}

      {abierto ? (
        <div className="pulso-cvm-editor" role="group" aria-labelledby={`${id}-t`}>
          <p id={`${id}-t`} className="pulso-cvm-titulo">Nueva condición</p>
          {columnas === null ? (
            <p className="pulso-cvm-ayuda">Leyendo las columnas de la base…</p>
          ) : !columnas.length ? (
            <p className="pulso-cvm-ayuda">{errorColumnas || "La base no tiene columnas de pocos valores con las que declarar una condición."}</p>
          ) : (
            <>
              <div className="pulso-cvm-fila">
                <label htmlFor={`${id}-var`}>Variable</label>
                <select id={`${id}-var`} value={variable} disabled={disabled} onChange={(e) => { setVariable(e.target.value); setValores([]); }}>
                  <option value="">Elige una variable</option>
                  {[
                    { rotulo: "Columnas que no son preguntas del formulario", cols: columnas.filter((c) => !c.del_formulario) },
                    { rotulo: "Preguntas del formulario", cols: columnas.filter((c) => c.del_formulario) },
                  ].filter((g) => g.cols.length).map((g) => (
                    <optgroup key={g.rotulo} label={g.rotulo}>
                      {g.cols.map((c) => (
                        <option key={c.variable} value={c.variable}>{c.etiqueta ? `${c.variable} — ${c.etiqueta}` : c.variable}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              {col ? (
                <>
                  <div className="pulso-cvm-fila" role="radiogroup" aria-label="Qué casos cuentan">
                    <span>Cuenta si</span>
                    <label><input type="radio" name={`${id}-sentido`} checked={sentido === "es"} onChange={() => setSentido("es")} /> es</label>
                    <label><input type="radio" name={`${id}-sentido`} checked={sentido === "no_es"} onChange={() => setSentido("no_es")} /> no es</label>
                  </div>
                  <ul className="pulso-cvm-valores" aria-label={`Valores de ${col.variable}`}>
                    {col.valores.map((v) => {
                      const elegido = valores.includes(v.valor);
                      return (
                        <li key={v.valor}>
                          <button
                            type="button"
                            aria-pressed={elegido}
                            className={elegido ? "is-elegido" : undefined}
                            onClick={() => setValores(elegido ? valores.filter((x) => x !== v.valor) : [...valores, v.valor])}
                          >
                            <span>{v.etiqueta && v.etiqueta !== v.valor ? v.etiqueta : v.valor}</span>
                            {v.etiqueta && v.etiqueta !== v.valor ? <code>{v.valor}</code> : null}
                            <small>{formatoConteoDe(v.n, "caso")}</small>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  {borrador ? (
                    <p className="pulso-cvm-ayuda">
                      Con esta condición sola cuentan {nTotal
                        ? `${formatoConteo(casosQueCumplen(col, sentido, valores, nTotal))} de ${formatoConteoDe(nTotal, "caso")}`
                        : formatoConteoDe(casosQueCumplen(col, sentido, valores, nTotal), "caso")}.
                    </p>
                  ) : (
                    <p className="pulso-cvm-ayuda">Elige uno o más valores.</p>
                  )}
                </>
              ) : null}
            </>
          )}
          <div className="pulso-cvm-acciones">
            <PulsoButton variant="primary" size="sm" disabled={disabled || !borrador} onClick={agregar}>Agregar condición</PulsoButton>
            <PulsoButton variant="ghost" size="sm" onClick={cerrar}>Cancelar</PulsoButton>
          </div>
        </div>
      ) : (
        <PulsoButton variant="secondary" size="sm" disabled={disabled} onClick={() => setAbierto(true)}>
          <Plus size={13} aria-hidden="true" />Agregar condición
        </PulsoButton>
      )}
    </div>
  );
}
