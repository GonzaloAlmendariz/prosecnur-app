import type { ReactNode } from "react";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { ChipDato, ChipLugar } from "./AulasSistemaPabellon";
import { fmt } from "./kpisDeAulas";
import "./aulasPartesQueNoCuadran.css";

/**
 * **Los partes que no cuadran, dichos como una resta y no como diez columnas.**
 *
 * La pestaña existe para contestar «33 partes no cuadran», y para verlo había
 * que leer una tabla de catorce columnas —que además se corta por la derecha— y
 * restar de cabeza. Gonzalo, 2026-09-12: «en las otras pestañas priorizamos
 * vista de unidad por encima de tablas».
 *
 * La tabla se queda: noventa partes son un censo y para un censo sirve. Lo que
 * sube aquí son sólo los que piden mirada, con su aritmética resuelta.
 *
 * **No se calcula nada**: `cuadra` y `diferencia` los decide
 * `monitoreo_aulas_parte_descuadre()`, el mismo helper del aviso de Validación,
 * así que esta vista no puede discrepar de aquél.
 */

const numero = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const texto = (v: unknown) => (v == null ? "" : String(v).trim());

export function AulasPartesQueNoCuadran({ filas }: {
  /** Los partes YA ordenados por `parteDeCampo()`: los que no cuadran, primero. */
  filas: ReadonlyArray<MonitoreoRow>;
}): ReactNode {
  const noCuadran = filas.filter((f) => f.cuadra === false);
  if (!noCuadran.length) return null;

  return (
    <div className="aulas-descuadres" data-qa-geometry-capacity="owned" data-qa-geometry-member>
      {noCuadran.map((f) => {
        const codigo = texto(f.operational_code);
        const aula = texto(f.actual_room);
        const observados = numero(f.observed_students);
        const rechazos = numero(f.refusals);
        const duplicados = numero(f.duplicates);
        const declaradas = numero(f.effective_surveys);
        const esperado = numero(f.esperado);
        const diferencia = numero(f.diferencia);
        // **El signo es `efectivas − esperado`** (`monitoreo_aulas_reconciliacion.R:51`),
        // así que NEGATIVO significa que faltan: se declararon menos de las que
        // el aula daba. Lo escribí al revés y el test lo confirmó porque la
        // fixture llevaba mi suposición dentro; en pantalla decía «sobran 27»
        // con 50 en el aula y 23 declaradas.
        // Son dos problemas distintos: de menos, encuestas que no llegaron; de
        // más, encuestas sin quien las respondiera en esa aula.
        const faltan = diferencia != null && diferencia < 0;

        return (
          <article key={codigo || String(f.source_row ?? Math.random())} className="aulas-descuadre">
            <div className="aulas-descuadre-quien">
              <strong>{codigo || "Sin código"}</strong>
              <span className="aulas-chips-fila">
                {aula ? <ChipLugar lugar={aula} /> : null}
                {texto(f.applied_date) ? <ChipDato>{texto(f.applied_date)}</ChipDato> : null}
                {texto(f.applied_by) ? <ChipDato>{texto(f.applied_by)}</ChipDato> : null}
              </span>
            </div>

            {/* La resta, escrita como se hace: lo que había, lo que se cae, lo
                que debería quedar, y lo que el parte declaró. */}
            <p className="aulas-descuadre-cuenta">
              <b>{observados == null ? "—" : fmt(observados)}</b> en el aula
              {rechazos ? <> − <b>{fmt(rechazos)}</b> {rechazos === 1 ? "rechazo" : "rechazos"}</> : null}
              {duplicados ? <> − <b>{fmt(duplicados)}</b> {duplicados === 1 ? "duplicado" : "duplicados"}</> : null}
              {esperado == null ? null : <> = <b>{fmt(esperado)}</b></>}
              {" · declaró "}<b>{declaradas == null ? "—" : fmt(declaradas)}</b>
            </p>

            <span className={`aulas-descuadre-saldo${faltan ? " es-falta" : " es-sobra"}`}>
              {diferencia == null
                ? "sin comprobar"
                : `${faltan ? "faltan" : "sobran"} ${fmt(Math.abs(diferencia))}`}
            </span>
          </article>
        );
      })}
    </div>
  );
}
