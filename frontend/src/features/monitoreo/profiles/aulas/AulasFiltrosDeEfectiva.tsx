import { useState } from "react";
import { AulasSexoYDescartes, type ValoresDeSexo } from "./AulasSexoYDescartes";

import type { MonitoreoVariable } from "../../../../api/monitoreo";
import { Plus, Trash2 } from "../../../../vendor/lucide-react";

/** Un filtro declarado: la variable y los valores que cuentan como efectiva. */
export type FiltroDeEfectiva = { var: string; values: string[] };

/** Cuántos caben. Gonzalo: «puede tener hasta 4». */
export const MAXIMO_DE_FILTROS = 4;

/**
 * Qué cuenta como una encuesta EFECTIVA en este estudio.
 *
 * Gonzalo: «la sección de fuentes no deja declarar las variables que definen a
 * una encuesta efectiva, que en algunos casos tiene más de un filtro, **puede
 * tener hasta 4**».
 *
 * Y era exacto por partida doble: los perfiles hermanos —telefónico y
 * acreditación— sí tienen dónde declarar la variable de estado, aulas no tenía
 * ninguna, y el motor sólo admitía **una** columna. Para un estudio real no
 * alcanza: «efectiva» suele ser completa **y** con consentimiento **y** del
 * público elegible, y esas condiciones no se podían declarar, así que el tablero
 * contaba de más sin decirlo.
 *
 * Tres cosas que esta superficie tiene que DECIR, no sólo dejar elegir:
 *
 * 1. que los filtros se cumplen **todos** —son una conjunción, no alternativas—;
 * 2. **qué está contando ahora mismo**, que es lo que devuelve el motor;
 * 3. si una variable declarada **no está en la base**, porque entonces esa
 *    condición no se aplica y un error de tipeo pasaría por criterio.
 *
 * Lo que NO hace: adelantar cuántas respuestas quedarían. Las variables llegan
 * con sus valores distintos pero **sin conteo por valor**, así que cualquier
 * cifra previa sería inventada; la de verdad la da el motor al guardar.
 */
export function AulasFiltrosDeEfectiva({
  filtros, variables, criterio, guardando, onChange, onGuardar,
  variableDeSexo = "", onVariableDeSexo = null,
  valoresDeSexo = null, onValoresDeSexo = null,
  descartes = [], onDescartes = null, sugerenciasDeDescarte = [],
}: {
  filtros: ReadonlyArray<FiltroDeEfectiva>;
  variables: ReadonlyArray<MonitoreoVariable>;
  /** La frase del motor: qué se está contando con lo que hay guardado. */
  criterio?: string;
  guardando?: boolean;
  onChange: (filtros: FiltroDeEfectiva[]) => void;
  onGuardar: () => void;
  /**
   * Qué variable de la base dice el SEXO de quien respondió (dictado
   * 2026-09-04: «poder mapear cuántas se esperaban en hombres y en mujeres y
   * cuánto obtuvimos»). Se declara aquí, junto al resto del criterio, porque es
   * la misma pregunta: qué columna de la base significa qué. Sin declararla, el
   * motor no cuenta por sexo y las celdas callan; adivinar cuál es sería el
   * error que ya costó una lectura en este estudio.
   */
  variableDeSexo?: string;
  /** `null` = sólo lectura; el selector no se pinta. */
  onVariableDeSexo?: ((variable: string) => void) | null;
  /**
   * A5 (2026-09-08): qué valor de la variable de sexo cuenta como mujeres y
   * cuál como hombres, y qué códigos de colector quedan fuera del operativo.
   * Se pintan bajo el selector de sexo cuando hay callbacks o valores.
   */
  valoresDeSexo?: ValoresDeSexo | null;
  onValoresDeSexo?: ((v: ValoresDeSexo) => void) | null;
  descartes?: ReadonlyArray<string>;
  onDescartes?: ((valores: string[]) => void) | null;
  sugerenciasDeDescarte?: ReadonlyArray<string>;
}) {
  const [abierto, setAbierto] = useState<number | null>(null);
  /**
   * Hacia dónde se abre la lista de valores.
   *
   * Se abría siempre hacia abajo, y con la CUARTA condición en un viewport de
   * 600 px eso la dejaba **251 px fuera de la ventana**: medido, `bottom: 851`.
   * Es el mismo molde que el globo del gráfico —un elemento anclado sin mirar el
   * borde—, aquí por abajo. Si no cabe debajo, se abre hacia arriba.
   */
  const [haciaArriba, setHaciaArriba] = useState(false);

  const alternar = (i: number, boton: HTMLElement | null) => {
    if (abierto === i) { setAbierto(null); return; }
    const r = boton?.getBoundingClientRect();
    // 240 es el alto máximo de la lista más su margen: si no caben debajo, se
    // abre hacia arriba. Se mide al ABRIR y no al montar porque el panel se
    // desplaza con el scroll de la sección.
    setHaciaArriba(Boolean(r && window.innerHeight - r.bottom < 240 && r.top > 240));
    setAbierto(i);
  };
  const nombres = variables.map((v) => v.name);
  const valoresDe = (nombre: string) =>
    variables.find((v) => v.name === nombre)?.values ?? [];

  const cambiar = (i: number, patch: Partial<FiltroDeEfectiva>) => {
    onChange(filtros.map((f, k) => (k === i ? { ...f, ...patch } : f)));
  };
  const quitar = (i: number) => onChange(filtros.filter((_, k) => k !== i));
  const añadir = () => onChange([...filtros, { var: "", values: [] }]);

  // Una variable declarada que la base no trae: el motor NO la aplica —descartar
  // por una columna ausente dejaría al estudio sin avance por un error de tipeo—
  // y aquí se dice, que es donde se puede corregir.
  const ausentes = filtros
    .map((f) => f.var)
    .filter((v) => v && !nombres.includes(v));

  return (
    <div className="aulas-efectiva">
      <p className="mon-profile-muted aulas-efectiva-lectura">
        {/* **Una sola vez cada cosa.** Esta linea decia «Una respuesta cuenta
            como efectiva si cumple las N condiciones a la vez» y a continuacion
            el motor decia «Una respuesta cuenta si su 'sexo' esta entre los
            valores declarados» —dos veces «una respuesta cuenta» en el mismo
            renglon— mientras la cabecera del panel ya dice «hasta cuatro
            condiciones, y se cumplen todas». **Tres veces la misma idea.**
            Gonzalo: «todos los elementos visuales siguen bastante verborreados
            en esta seccion».
            Se queda **la cifra**, que es lo unico que la cabecera no dice; y el
            caso de cero, que no es una repeticion sino un estado. */}
        {filtros.length === 0
          ? "Sin condiciones declaradas cuentan todas las respuestas."
          : criterio}
      </p>

      {/* **C1: se declara, o el gate no lo mide.** Con dos condiciones el runner
          no lo tomaba como coleccion candidata —ni siquiera lo marcaba como no
          declarado— asi que daba verde sin haber auditado la unica geometria que
          este panel tiene. Las condiciones son **variantes repetidas del mismo
          rol**, o sea `equal`: cambian de contenido, no de marco. */}
      <ul
        className="aulas-efectiva-lista"
        data-qa-geometry-group="monitoring-aulas-efectiva"
        data-qa-geometry-contract="equal"
        data-qa-geometry-capacity="owned"
      >
        {filtros.map((f, i) => (
          <li key={i}>
            <label>
              <span>Variable</span>
              <select value={f.var}
                onChange={(e) => cambiar(i, { var: e.target.value, values: [] })}>
                <option value="">Sin elegir</option>
                {nombres.map((n) => <option key={n} value={n}>{n}</option>)}
                {/* Una variable guardada que ya no está en la base sigue
                    visible: si desapareciera del desplegable, el usuario no
                    podría ni verla ni quitarla. */}
                {f.var && !nombres.includes(f.var)
                  ? <option value={f.var}>{f.var} (no está en la base)</option>
                  : null}
              </select>
            </label>
            <div className="aulas-efectiva-valores">
              <span>Valores que cuentan</span>
              <button type="button"
                onClick={(e) => alternar(i, e.currentTarget)}
                disabled={!f.var}>
                {f.values.length
                  ? `${f.values.length} elegido${f.values.length === 1 ? "" : "s"}`
                  : "Elegir"}
              </button>
              {abierto === i ? (
                <ul className={`aulas-efectiva-opciones${haciaArriba ? " es-arriba" : ""}`}>
                  {valoresDe(f.var).map((v) => (
                    <li key={v}>
                      <label>
                        <input type="checkbox" checked={f.values.includes(v)}
                          onChange={(e) => cambiar(i, {
                            values: e.target.checked
                              ? [...f.values, v]
                              : f.values.filter((x) => x !== v),
                          })} />
                        {v}
                      </label>
                    </li>
                  ))}
                  {!valoresDe(f.var).length ? (
                    <li className="mon-profile-muted">Esta variable no trae valores que elegir.</li>
                  ) : null}
                </ul>
              ) : null}
            </div>
            <button type="button" className="aulas-efectiva-quitar"
              onClick={() => quitar(i)} aria-label={`Quitar el filtro de ${f.var || "sin elegir"}`}>
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>

      {ausentes.length ? (
        <p className="aulas-efectiva-aviso">
          La base no trae {ausentes.map((v) => `«${v}»`).join(" ni ")}, así que{" "}
          {ausentes.length === 1 ? "esa condición no se aplica" : "esas condiciones no se aplican"}.
        </p>
      ) : null}

      {onVariableDeSexo ? (
        <div className="aulas-efectiva-sexo">
          <label>
            <span>Variable que dice el sexo</span>
            <select
              value={variableDeSexo}
              onChange={(e) => onVariableDeSexo(e.target.value)}
            >
              <option value="">sin declarar</option>
              {nombres.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <em>
            {variableDeSexo
              ? "Con ella, el Plan del día dice cuántas efectivas se obtuvieron de cada sexo."
              : "Sin ella, las cifras por sexo del Plan del día quedan vacías: no se adivina qué columna es."}
          </em>
          {/* A5: los valores de esa variable, repartidos en mujeres y hombres, y
              los descartes del colector. Sólo con alguien que los guarde o con
              algo ya declarado que enseñar. */}
          {onValoresDeSexo || onDescartes || valoresDeSexo || descartes.length ? (
            <AulasSexoYDescartes
              variableDeSexo={variableDeSexo}
              valoresDeLaVariable={valoresDe(variableDeSexo)}
              mujeres={valoresDeSexo?.mujeres ?? []}
              hombres={valoresDeSexo?.hombres ?? []}
              descartes={descartes}
              sugerencias={sugerenciasDeDescarte}
              onValoresDeSexo={onValoresDeSexo}
              onDescartes={onDescartes}
            />
          ) : null}
        </div>
      ) : null}

      <div className="aulas-efectiva-mando">
        <button type="button" onClick={añadir} disabled={filtros.length >= MAXIMO_DE_FILTROS}>
          <Plus size={14} /> Añadir condición
        </button>
        {filtros.length >= MAXIMO_DE_FILTROS ? (
          <span className="mon-profile-muted">Cuatro es el máximo.</span>
        ) : null}
        <button type="button" className="aulas-efectiva-guardar"
          onClick={onGuardar} disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar criterio"}
        </button>
      </div>
    </div>
  );
}
