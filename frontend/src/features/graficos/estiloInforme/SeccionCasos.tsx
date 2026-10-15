// Sección «Casos junto al porcentaje» de Estilo del informe: cuándo cada cifra lleva su número de casos.

import { useId } from "react";
import { CabeceraSeccion } from "./CabeceraSeccion";
import "./casos.css";
import { CASOS_POR_DEFECTO, fraseCasos, OPCIONES_CASOS, type CasosJunto } from "./casosJunto";
import { ExcepcionesRegla } from "./ExcepcionesRegla";
import type { Excepcion } from "./excepcionesPlan";

export function SeccionCasos({ casos, onCambiar, excepciones = [] }: { casos: CasosJunto; onCambiar: (c: CasosJunto) => void; excepciones?: readonly Excepcion[] }) {
  const tituloId = useId();
  const umbralId = useId();
  const modificado = casos.cuando !== CASOS_POR_DEFECTO.cuando || casos.umbral !== CASOS_POR_DEFECTO.umbral;
  return (
    <section className="pulso-f6-informe-seccion" aria-labelledby={tituloId} data-qa-geometry-member data-seccion="casos">
      <CabeceraSeccion
        id={tituloId}
        titulo="Casos junto al porcentaje"
        modificado={modificado}
        etiquetaVolver="Volver al valor por defecto de los casos"
        onVolver={() => onCambiar(CASOS_POR_DEFECTO)}
      />
      <div className="pulso-f6-informe-casos" role="radiogroup" aria-labelledby={tituloId}>
        {OPCIONES_CASOS.map((o) => (
          <label key={o.valor} className={`pulso-f6-casos-opcion${casos.cuando === o.valor ? " is-activa" : ""}`}>
            <input type="radio" className="pulso-sr-only" name={tituloId} value={o.valor}
              checked={casos.cuando === o.valor} onChange={() => onCambiar({ ...casos, cuando: o.valor })} />
            {o.rotulo}
          </label>
        ))}
        {casos.cuando === "menos" && (
          <label htmlFor={umbralId} className="pulso-f6-informe-umbral">
            menos de
            <input id={umbralId} type="number" min={1} max={999} className="pulso-f6-input" value={casos.umbral}
              onChange={(e) => { const n = Math.round(Number(e.target.value)); if (Number.isFinite(n) && n >= 1) onCambiar({ ...casos, umbral: n }); }} />
            casos
          </label>
        )}
      </div>
      <p className="pulso-f6-informe-ayuda">{fraseCasos(casos)} Vale para todos los gráficos del PowerPoint y del Word; un gráfico puede pedir otra cosa en su tarjeta.</p>
      {/* R5 (2026-10-15): los gráficos que piden otra cosa, a la vista y a un clic de su lámina. */}
      <ExcepcionesRegla excepciones={excepciones}
        ayuda="Se elige en la tarjeta del gráfico (barras agrupadas, torta y dona): «Como el informe», «Siempre» o «Nunca»." />
    </section>
  );
}
