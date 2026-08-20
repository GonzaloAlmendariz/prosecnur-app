import { useMemo } from "react";

import { Clock, TriangleAlert } from "../../../../vendor/lucide-react";
import { tiemposDeRespuesta } from "./tiemposDeRespuesta";

/**
 * Cuánto duran las respuestas, para el analista.
 *
 * El Excel anterior tenía control de tiempos y la app no. Con una salvedad que
 * manda sobre el diseño: **la base de este estudio no trae marcas de inicio y
 * fin**, así que lo que se ve hoy es el estado que lo dice. No es un panel a
 * medio hacer: es la única forma de que se note que falta el dato, y de que el
 * día que llegue un XLSForm que lo declare esto funcione solo.
 *
 * La mediana va con su rango intercuartil y la cola se cuenta aparte: hay
 * entrevistas que quedan abiertas horas —en el estudio donde sí hay tiempos, el
 * máximo son siete días— y promediarlas movería la cifra sin decir nada.
 */

const fmt = (n: number) => n.toLocaleString("es-PE", { maximumFractionDigits: 1 });
const min = (n: number | null) => (n === null ? "—" : `${fmt(n)} min`);

export function AulasTiemposDeRespuesta({ tiempos }: { tiempos: unknown }) {
  const t = useMemo(() => tiemposDeRespuesta(tiempos), [tiempos]);

  if (!t.disponible) {
    return (
      <div className="aulas-tiempos" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
        <p className="aulas-cadenas-lectura">
          Este estudio <strong>no trae tiempos de respuesta</strong>.{" "}
          {t.motivo || "La base no declara inicio ni fin de la entrevista."}
        </p>
        <p className="mon-profile-muted">
          La marca de envío dice cuándo llegó cada respuesta, pero no cuánto duró
          contestarla. Se calcula solo en cuanto el formulario declare las
          columnas de inicio y fin, sin tocar nada aquí.
        </p>
      </div>
    );
  }

  const destacan = t.aulas.filter((a) => a.destaca);
  const r = t.resumen;

  return (
    <div className="aulas-tiempos" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
      <p className="aulas-cadenas-lectura">
        La mitad de las respuestas se contestó en{" "}
        <strong>{min(r?.mediana ?? null)}</strong> o menos
        {r && r.p25 !== null && r.p75 !== null && (
          <> (la mitad central, entre {min(r.p25)} y {min(r.p75)})</>
        )}
        .
      </p>

      <ul className="aulas-tiempos-cifras">
        <li>
          <span>{fmt(r?.n ?? 0)}</span>
          <small>respuestas con duración</small>
        </li>
        {r && r.colaLarga !== null && r.colaMin !== null && (
          <li>
            <span>{fmt(r.colaLarga)}</span>
            <small>pasan de {fmt(r.colaMin)} min</small>
          </li>
        )}
        {t.marcadas && (
          <li className={t.marcadas.n > 0 ? "is-alerta" : undefined}>
            <span>{fmt(t.marcadas.n)}</span>
            <small>bajo el umbral de {fmt(t.umbral.minutos ?? 0)} min</small>
          </li>
        )}
      </ul>

      {!t.umbral.declarado && (
        <p className="mon-profile-muted">
          <Clock size={13} aria-hidden="true" /> {t.umbral.leyenda} Mientras no se
          declare, aquí se describe cuánto se tarda y no se señala a nadie.
        </p>
      )}

      {destacan.length > 0 && (
        <>
          <p className="aulas-tiempos-titulo">
            <TriangleAlert size={13} aria-hidden="true" />
            {destacan.length === 1
              ? "Un aula se sale del resto"
              : `${fmt(destacan.length)} aulas se salen del resto`}
          </p>
          <ul className="aulas-tiempos-lista">
            {destacan.map((a) => (
              <li key={a.aula}>
                <span className="aulas-tiempos-aula">{a.aula}</span>
                <span className="aulas-tiempos-med">
                  <strong>{min(a.mediana)}</strong>
                  {a.bandaInf !== null && a.bandaSup !== null && (
                    <small> ({fmt(a.bandaInf)}–{fmt(a.bandaSup)})</small>
                  )}
                </span>
                <span className="aulas-tiempos-resto">
                  resto {min(a.medianaResto)} · {fmt(a.n)} resp.
                </span>
              </li>
            ))}
          </ul>
          <p className="mon-profile-muted">
            El rango entre paréntesis es hasta dónde puede moverse esa mediana con
            los casos que tiene. Se listan sólo las aulas cuyo rango no alcanza al
            resto del estudio: las demás difieren dentro de lo esperable.
          </p>
        </>
      )}
    </div>
  );
}
