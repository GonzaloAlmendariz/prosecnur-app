// «Qué caso cuenta» declarado a mano. Las sugerencias sólo cubren lo que el
// formulario ya exigía; un criterio que vive fuera de él —una marca de
// selección hecha en un script, una columna «válida» del equipo, un filtro de
// población— se declara aquí: variable, «es» / «no es» y sus valores, cada uno
// con sus casos. El efecto se ve antes de agregar la condición y, con las
// condiciones puestas, cuántos casos cuentan en total.

import { useEffect, useId, useRef, useState } from "react";
import {
  apiV2CasoValidoColumnas,
  apiV2CasoValidoEfecto,
  apiV2CasoValidoGuardar,
  type CasoValidoColumna,
  type CasoValidoCondicion,
  type CasoValidoEfecto,
} from "../../../api/validacion";
import { PulsoButton } from "../../../components/PulsoButton";
import { formatoConteo, formatoConteoDe } from "../../../lib/formatoNumero";
import { Plus, X } from "../../../vendor/lucide-react";
import { casosQueCumplen, condicionDesdeBorrador, textoCondicion, type Sentido } from "../casoValidoManualModel";

export function CasoValidoManual({
  baseNombre,
  enabled,
  condiciones,
  onCambiar,
  disabled,
}: {
  baseNombre?: string | null;
  /** El interruptor «Declarado» del bloque: se guarda junto con las condiciones. */
  enabled: boolean;
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

  // Se guarda al cambiar (condición nueva, quitada, sugerencia adoptada o el
  // interruptor): antes sólo «Construir plan» lo guardaba y Analítica no lo veía.
  const [guardado, setGuardado] = useState<"" | "guardando" | "guardado" | "error">("");
  const claveGuardar = JSON.stringify([enabled, condiciones]);
  const ultimaGuardada = useRef(claveGuardar);
  useEffect(() => {
    if (claveGuardar === ultimaGuardada.current) return;
    let vivo = true;
    setGuardado("guardando");
    apiV2CasoValidoGuardar(baseNombre, enabled, [...condiciones])
      .then(() => { if (vivo) { ultimaGuardada.current = claveGuardar; setGuardado("guardado"); } })
      .catch(() => { if (vivo) setGuardado("error"); });
    return () => { vivo = false; };
    // `claveGuardar` resume enabled + condiciones.
  }, [claveGuardar, baseNombre]);

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
      {condiciones.length || !abierto ? (
        <div className="pulso-cvm-linea">
          {condiciones.map((c) => (
            <span key={c.variable} className="pulso-cvm-chip">
              {textoCondicion(c, colDe(c.variable))}
              <button
                type="button"
                aria-label={`Quitar la condición sobre ${c.variable}`}
                title="Quitar"
                disabled={disabled}
                onClick={() => onCambiar(condiciones.filter((x) => x.variable !== c.variable))}
              >
                <X size={11} aria-hidden="true" />
              </button>
            </span>
          ))}
          {!abierto ? (
            <PulsoButton variant="ghost" size="sm" disabled={disabled} onClick={() => setAbierto(true)}>
              <Plus size={13} aria-hidden="true" />{condiciones.length ? "Otra condición" : "Agregar condición"}
            </PulsoButton>
          ) : null}
        </div>
      ) : null}
      {efecto && efecto.n_total ? (
        <div className="pulso-cvm-efecto" role="status">
          <span><strong>{formatoConteo(efecto.n_validos)}</strong> de {formatoConteoDe(efecto.n_total, "caso")}</span>
          <span className="pulso-cvm-barra" aria-hidden="true">
            <span style={{ width: `${Math.round((100 * efecto.n_validos) / efecto.n_total)}%` }} />
          </span>
          {efecto.n_excluidos ? <span className="pulso-cvm-fuera">{formatoConteoDe(efecto.n_excluidos, "no considerado", "no considerados")}</span> : null}
          {efecto.variables_ausentes.length ? <span className="pulso-cvm-fuera">Falta en la base: {efecto.variables_ausentes.join(", ")}</span> : null}
          {guardado === "guardando" ? <span className="pulso-cvm-fuera">Guardando…</span> : null}
          {guardado === "guardado" ? <span className="pulso-cvm-fuera">Guardado</span> : null}
          {guardado === "error" ? <span className="pulso-cvm-error" role="alert">No se pudo guardar</span> : null}
        </div>
      ) : null}

      {abierto ? (
        <div className="pulso-cvm-editor" role="group" aria-labelledby={`${id}-t`}>
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
                      Cuentan {nTotal
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
            <PulsoButton variant="primary" size="sm" disabled={disabled || !borrador} onClick={agregar}>Agregar</PulsoButton>
            <PulsoButton variant="ghost" size="sm" onClick={cerrar}>Cancelar</PulsoButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}
