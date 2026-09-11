import { useState, type ReactNode } from "react";

import { AulasMapaDeLaDeuda } from "./AulasMapaDeLaDeuda";
import { deudaPorFacultad, palabraDelVeredicto, repartoDeDeudas, type DeudaDeFacultad } from "./deudaPorFacultad";
import { fmt, pctPerfil } from "./kpisDeAulas";
import type { MonitoreoAulasEfectividadSeguimiento } from "../../../../api/monitoreo";
import "./aulasComoVaCadaFacultad.css";

/**
 * Cómo le va a cada facultad, y en qué sexo le va mal.
 *
 * Gonzalo, 2026-09-10: «¿qué tan bajo en comparación con qué, cómo va la
 * facultad? ¿Cuáles son las facultades a las que mejor les está yendo, a las
 * que peor? Puedo seleccionar una facultad a la que peor le está yendo y ver
 * por qué le está yendo tan mal […] ojo, no siempre es que le esté yendo mal a
 * nivel general, sino le puede estar yendo mal en un sexo en particular».
 *
 * Dos lecturas del mismo dato y las dos hacen falta: **el mapa** dice en qué
 * esquina está cada una —y cuáles deben de un solo sexo, que es lo que la cifra
 * global esconde—; **la lista** las ordena por lo que deben, que es la pregunta
 * con la que se entra. Pulsar un punto abre su fila: el mapa es el índice.
 */
export function AulasComoVaCadaFacultad({ bloque, porSexo, facultadEnFoco }: {
  bloque: MonitoreoAulasEfectividadSeguimiento | null | undefined;
  porSexo: ReadonlyArray<Record<string, unknown>> | null | undefined;
  /** La facultad de la cabecera abre su fila al entrar. */
  facultadEnFoco?: string;
}): ReactNode {
  // El hook va antes de cualquier salida temprana: uno bajo la guarda se llama
  // en unos renders y no en otros, y eso es el React #300 que ya tumbó esto.
  const [abierta, setAbierta] = useState<string>("");
  const filas = deudaPorFacultad(bloque, porSexo);

  if (!filas.length) {
    return (
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        El estudio todavía no publica la efectividad por facultad: sin ella no hay
        deuda que repartir.
      </p>
    );
  }

  const r = repartoDeDeudas(filas);
  const activa = abierta || facultadEnFoco || "";

  return (
    <div className="aulas-cvf" data-qa-geometry-capacity="owned" data-qa-geometry-member>
      <p className="aulas-cvf-lectura">
        {r.deben ? (
          <><strong>{fmt(r.deben)}</strong> {r.deben === 1 ? "facultad debe" : "facultades deben"} respuestas</>
        ) : (
          <>Ninguna facultad debe respuestas</>
        )}
        {/* El caso que la cifra global esconde, contado aparte. */}
        {r.deUnSoloSexo ? (
          <> · <strong>{fmt(r.deUnSoloSexo)}</strong> {r.deUnSoloSexo === 1 ? "sólo en un sexo" : "sólo en un sexo"}</>
        ) : null}
        {r.porEncima ? <> · <strong>{fmt(r.porEncima)}</strong> por encima de lo previsto</> : null}
        {r.sinCampo ? <> · <strong>{fmt(r.sinCampo)}</strong> sin campo todavía</> : null}
        . La deuda no se compensa entre facultades: cada una cierra la suya.
      </p>

      <AulasMapaDeLaDeuda
        filas={filas}
        onFacultad={(f) => setAbierta((antes) => (antes === f ? "" : f))}
      />

      <ul className="aulas-cvf-lista">
        {filas.map((f) => (
          <FilaDeFacultad
            key={f.clave || f.facultad}
            f={f}
            abierta={activa === f.facultad}
            onAbrir={() => setAbierta((antes) => (antes === f.facultad ? "" : f.facultad))}
          />
        ))}
      </ul>
    </div>
  );
}

/** El mayor desvío del corte fija la escala común a todas las barras. */
const TOPE_BARRA = 48;

function BarraDeSexo({ letra, valor }: { letra: string; valor: number }): ReactNode {
  const ancho = Math.min(100, (Math.abs(valor) / TOPE_BARRA) * 100) / 2;
  const clase = valor < 0 ? "es-debe" : valor > 0 ? "es-sobra" : "es-cero";
  return (
    <span className="aulas-cvf-barra">
      <span className="aulas-cvf-letra">{letra}</span>
      {/* El carril tiene el cero en el centro: a la izquierda lo que se debe, a
          la derecha lo que sobra. Cruzarlo es lo que separa deber de sobrar, y
          una barra que crece siempre hacia el mismo lado no lo dice. */}
      <span className="aulas-cvf-carril">
        {valor === 0 ? null : <i className={clase} style={{ width: `${ancho}%` }} />}
      </span>
      <b className={clase}>{valor > 0 ? `+${fmt(valor)}` : valor < 0 ? `−${fmt(Math.abs(valor))}` : "0"}</b>
    </span>
  );
}

function FilaDeFacultad({ f, abierta, onAbrir }: {
  f: DeudaDeFacultad; abierta: boolean; onAbrir: () => void;
}): ReactNode {
  const sinCampo = f.veredicto === "sin_campo";
  const pct = (v: number | null) => (v == null ? "—" : pctPerfil(v * 100));
  return (
    <li className={abierta ? "es-abierta" : ""}>
      <button type="button" className="aulas-cvf-fila" aria-expanded={abierta} onClick={onAbrir}>
        <span className="aulas-cvf-nombre">
          <b>{f.facultad}</b>
          <span>{sinCampo ? "sin cursos-horario aplicados" : `${fmt(f.aulas)} aplicados`}</span>
        </span>
        <span className={`aulas-cvf-deuda ${f.deuda < 0 ? "es-debe" : f.deuda > 0 ? "es-sobra" : "es-cero"}`}>
          {sinCampo ? "—" : f.deuda > 0 ? `+${fmt(f.deuda)}` : f.deuda < 0 ? `−${fmt(Math.abs(f.deuda))}` : "0"}
          <small>hasta ahora</small>
        </span>
        <span className="aulas-cvf-sexos">
          <BarraDeSexo letra="M" valor={f.mujeres} />
          <BarraDeSexo letra="H" valor={f.hombres} />
        </span>
        <span className="aulas-cvf-tasa">
          <b className={sinCampo ? "" : (f.observada ?? 0) >= (f.prevista ?? 0) ? "es-ok" : "es-bajo"}>
            {sinCampo ? "—" : pct(f.observada)}
          </b>
          <span>de {pct(f.prevista)} previsto</span>
        </span>
        <span className={`aulas-cvf-veredicto es-${f.veredicto}`}>{palabraDelVeredicto(f.veredicto)}</span>
      </button>
      {abierta ? (
        <div className="aulas-cvf-porque">
          <p>{f.frase}</p>
          {/* Qué hacer con eso, en el vocabulario del operativo. La lista de
              cursos-horario que la hundieron vive en Consultas › Brechas, que es
              donde además se puede actuar sobre cada uno: repetirla aquí daría
              dos sitios contando lo mismo. */}
          {f.veredicto === "debe_mujeres" || f.veredicto === "debe_hombres" ? (
            <p className="aulas-cvf-consejo">
              Un relevo aquí sólo sirve si trae {f.veredicto === "debe_mujeres" ? "mujeres" : "hombres"}:
              uno del otro sexo gasta una reserva y deja la deuda intacta.
            </p>
          ) : null}
          {f.veredicto === "debe_en_los_dos" ? (
            <p className="aulas-cvf-consejo">
              Debe en los dos sexos: cualquier relevo de su facultad mueve algo,
              y el que más cierre es el que más se acerque a las dos cifras.
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
