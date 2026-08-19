import { useState } from "react";

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
}: {
  filtros: ReadonlyArray<FiltroDeEfectiva>;
  variables: ReadonlyArray<MonitoreoVariable>;
  /** La frase del motor: qué se está contando con lo que hay guardado. */
  criterio?: string;
  guardando?: boolean;
  onChange: (filtros: FiltroDeEfectiva[]) => void;
  onGuardar: () => void;
}) {
  const [abierto, setAbierto] = useState<number | null>(null);
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
        {filtros.length > 1
          ? `Una respuesta cuenta como efectiva si cumple las ${filtros.length} condiciones a la vez.`
          : "Una respuesta cuenta como efectiva si cumple la condición declarada."}
        {criterio ? <> Ahora mismo: {criterio}</> : null}
      </p>

      <ul className="aulas-efectiva-lista">
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
              <button type="button" onClick={() => setAbierto(abierto === i ? null : i)}
                disabled={!f.var}>
                {f.values.length
                  ? `${f.values.length} elegido${f.values.length === 1 ? "" : "s"}`
                  : "Elegir"}
              </button>
              {abierto === i ? (
                <ul className="aulas-efectiva-opciones">
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
