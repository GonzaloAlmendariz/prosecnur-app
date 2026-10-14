import { useId, useState } from "react";
import { Eye, EyeOff, Search, SearchX, Undo2 } from "../../vendor/lucide-react";
import { EstadoVacio } from "../../components/EstadoVacio";
import { PulsoButton } from "../../components/PulsoButton";
import { formatoConteo } from "../../lib/formatoNumero";
import {
  ROTULO_MOTIVO_EXCLUSION,
  conVariable,
  filasExcluidas,
  rotuloExcluidas,
  rotuloIncluidas,
  sinVariable,
  variablesIncluidas,
  type MotivoExclusion,
  type VariableElegible,
} from "./variablesExcluidasModel";
import "./variablesExcluidas.css";

// Cuerpo del panel «Variables excluidas» (U5). Lo monta
// `PanelVariablesExcluidas`, que pone el marco, la dirección y los datos.
//
// Antes era una fila de chips y un selector dentro de «Definición global», que
// dejó de montarse en 0.2.7 cuando Datos pasó a decidir la inclusión con una
// casilla por variable. Esa casilla solo existe para las columnas presentes:
// una variable excluida que no está en los datos —la retira una base preparada
// fuera (ADR 0100)— quedaba excluida sin ningún lugar donde verla.
//
// Presentacional: recibe la lista y avisa cada cambio. Quien lo monta la lee y
// la escribe en el store, y el autosave de Analítica la persiste en la config
// de la base activa.

const EMPTY_MOTIVOS: ReadonlyMap<string, MotivoExclusion> = new Map();

export function VariablesExcluidas({
  variables,
  excluidas,
  onCambiar,
  motivos = EMPTY_MOTIVOS,
}: {
  variables: readonly VariableElegible[];
  excluidas: readonly string[];
  onCambiar: (excluidas: string[]) => void;
  motivos?: ReadonlyMap<string, MotivoExclusion>;
}) {
  const setExcluidas = onCambiar;
  const [busqueda, setBusqueda] = useState("");
  const idBusqueda = useId();
  const idExcluidas = useId();
  const idIncluidas = useId();

  const filas = filasExcluidas(excluidas, variables, motivos, busqueda);
  const incluidas = variablesIncluidas(variables, excluidas, busqueda);
  const totalIncluidas = variablesIncluidas(variables, excluidas).length;
  const totalExcluidas = new Set(excluidas).size;
  const filtrando = busqueda.trim() !== "";

  return (
    <div
      className="pulso-excluidas-contenido"
      data-qa-geometry-group="analitica/excluidas-bloques"
      data-qa-geometry-contract="intrinsic"
    >
      <div className="pulso-excluidas-buscador" role="search">
        <label htmlFor={idBusqueda} className="pulso-excluidas-buscador-rotulo">
          Buscar variable
        </label>
        <div className="pulso-excluidas-buscador-campo">
          <Search size={14} aria-hidden="true" />
          <input
            id={idBusqueda}
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Nombre o etiqueta"
            autoComplete="off"
          />
        </div>
      </div>

      <section className="pulso-excluidas-bloque" aria-labelledby={idExcluidas}>
        <header className="pulso-excluidas-bloque-cabecera">
          <h3 id={idExcluidas}>
            <EyeOff size={14} aria-hidden="true" />
            Excluidas
          </h3>
          <span className="pulso-excluidas-cuenta" aria-live="polite">
            {filtrando ? `${formatoConteo(filas.length)} de ${formatoConteo(totalExcluidas)}` : rotuloExcluidas(totalExcluidas)}
          </span>
        </header>
        {filas.length === 0 ? (
          totalExcluidas === 0 ? (
            <EstadoVacio
              icono={<Eye size={15} />}
              titulo="Ninguna variable excluida"
              descripcion="Todas salen en los entregables."
            />
          ) : (
            <EstadoVacio
              icono={<SearchX size={15} />}
              titulo="Ninguna excluida coincide con la búsqueda"
            />
          )
        ) : (
          <ul className="pulso-excluidas-lista" data-qa-geometry-group="analitica/excluidas-lista" data-qa-geometry-contract="intrinsic">
            {filas.map((fila) => (
              <li key={fila.name} className="pulso-excluidas-fila is-excluida">
                <div className="pulso-excluidas-fila-texto">
                  <code>{fila.name}</code>
                  {fila.label ? <span className="pulso-excluidas-fila-etiqueta">{fila.label}</span> : null}
                  {fila.motivo || !fila.enLosDatos ? (
                    <span className="pulso-excluidas-fila-marcas">
                      {fila.motivo ? (
                        <span
                          className="pulso-excluidas-marca is-motivo"
                          title={`Declarado en Carga, origen de la base ${fila.motivo.base}`}
                        >
                          {ROTULO_MOTIVO_EXCLUSION[fila.motivo.motivo]}
                        </span>
                      ) : null}
                      {!fila.enLosDatos ? (
                        <span className="pulso-excluidas-marca">No está en los datos</span>
                      ) : null}
                    </span>
                  ) : null}
                </div>
                <PulsoButton
                  variant="secondary"
                  size="sm"
                  className="pulso-excluidas-accion"
                  onClick={() => setExcluidas(sinVariable(excluidas, fila.name))}
                  aria-label={`Volver a incluir ${fila.name}`}
                >
                  <Undo2 size={13} aria-hidden="true" />
                  Incluir
                </PulsoButton>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="pulso-excluidas-bloque" aria-labelledby={idIncluidas}>
        <header className="pulso-excluidas-bloque-cabecera">
          <h3 id={idIncluidas}>Incluidas</h3>
          <span className="pulso-excluidas-cuenta" aria-live="polite">
            {filtrando ? `${formatoConteo(incluidas.length)} de ${formatoConteo(totalIncluidas)}` : rotuloIncluidas(totalIncluidas)}
          </span>
        </header>
        {incluidas.length === 0 ? (
          totalIncluidas === 0 ? (
            <EstadoVacio
              icono={<EyeOff size={15} />}
              titulo="No quedan variables incluidas en esta base"
              descripcion="Vuelve a incluir alguna desde la lista de excluidas."
            />
          ) : (
            <EstadoVacio
              icono={<SearchX size={15} />}
              titulo="Ninguna incluida coincide con la búsqueda"
            />
          )
        ) : (
          <ul className="pulso-excluidas-lista" data-qa-geometry-group="analitica/incluidas-lista" data-qa-geometry-contract="intrinsic">
            {incluidas.map((variable) => (
              <li key={variable.name} className="pulso-excluidas-fila">
                <div className="pulso-excluidas-fila-texto">
                  <code>{variable.name}</code>
                  {variable.label ? (
                    <span className="pulso-excluidas-fila-etiqueta">{variable.label}</span>
                  ) : null}
                </div>
                <PulsoButton
                  variant="secondary"
                  size="sm"
                  className="pulso-excluidas-accion"
                  onClick={() => setExcluidas(conVariable(excluidas, variable.name))}
                  aria-label={`Excluir ${variable.name}`}
                >
                  {/* Excluir quita la variable de los entregables: no lleva «+» (P-M3). */}
                  <EyeOff size={13} aria-hidden="true" />
                  Excluir
                </PulsoButton>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
