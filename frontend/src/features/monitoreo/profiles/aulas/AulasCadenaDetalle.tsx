import { useState, type ReactNode } from "react";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { ChipHora, ChipLugar } from "./AulasSistemaPabellon";
import { facultadCorta } from "./facultadEnPalabras";
import { historiaDeCadena, type EslabonDeCadena, type HistoriaDeCadena } from "./historiaDeCadena";
import { fmt } from "./kpisDeAulas";
import "./aulasCadenaDetalle.css";

/**
 * **Cada cadena, eslabón a eslabón — y qué toca con cada uno.**
 *
 * Sustituye a la `<Tabla>` genérica que cerraba esta pestaña. Aquélla enseñaba
 * siete columnas del payload —`sample_status`, `replacement_order`,
 * `sample_role`— y era la misma clase de tabla que Gonzalo rechazó en Brechas:
 * «esas tablas de la aplicación se ven mal». Ninguna de sus columnas contestaba
 * la pregunta con la que se entra aquí, que no es «qué dice el libro de esta
 * fila» sino **«¿esta cadena necesita algo de mí hoy?»**.
 *
 * Tres decisiones que la hacen distinta de un volcado:
 *
 * 1. **La unidad es la cadena, no la fila.** Con seis reservas del mismo
 *    titular, la tabla vieja repetía «reemplaza a CH 1» seis veces y había que
 *    reconstruir mentalmente a quién pertenecían. Aquí la cadena es la fila y
 *    sus eslabones van dentro, en orden.
 * 2. **Sólo lo que está en juego, y se dice qué se deja fuera.** Una cadena
 *    cerrada no pide nada; listar las 236 obliga a buscar las 130 que sí.
 * 3. **Cada cadena termina en un verbo**, no en un estado: a quién llamar, o
 *    por qué no hay nadie a quien llamar.
 */
export function AulasCadenaDetalle({ filas }: {
  filas: ReadonlyArray<MonitoreoAulasPlanRow> | null | undefined;
}): ReactNode {
  // El hook va antes de cualquier salida temprana: uno bajo la guarda se llama
  // en unos renders y no en otros, y eso es el React #310 que ya tumbó esto.
  const [todas, setTodas] = useState(false);
  const cadenas = historiaDeCadena((filas ?? []) as MonitoreoAulasPlanRow[]);

  const porCodigo = new Map<string, MonitoreoAulasPlanRow>();
  for (const f of filas ?? []) {
    const c = String(f.operational_code ?? f.classroom_id ?? "").trim();
    if (c) porCodigo.set(c, f);
  }

  if (!cadenas.historias.length) {
    return (
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        El plan todavía no trae ninguna cadena: sin reservas encadenadas no hay
        relevo que seguir.
      </p>
    );
  }

  const abiertas = cadenas.historias.filter((h) => h.desenlace === "abierta");
  const cerradas = cadenas.historias.length - abiertas.length;
  const vistas = todas ? cadenas.historias : abiertas.slice(0, 30);
  const ocultas = todas ? 0 : abiertas.length - vistas.length;

  return (
    <div className="aulas-cad" data-qa-geometry-capacity="owned" data-qa-geometry-member>
      <p className="aulas-cad-lectura">
        <strong>{fmt(abiertas.length)}</strong>{" "}
        {abiertas.length === 1 ? "cadena sigue abierta" : "cadenas siguen abiertas"}
        {cerradas ? (
          <> · <strong>{fmt(cerradas)}</strong> ya {cerradas === 1 ? "cerró" : "cerraron"}, y no piden nada</>
        ) : null}
        {ocultas ? <> · se listan las {fmt(vistas.length)} primeras</> : null}
      </p>

      <ul className="aulas-cad-lista">
        {vistas.map((h) => <Cadena key={h.titular} h={h} porCodigo={porCodigo} />)}
      </ul>

      {cerradas || ocultas ? (
        <button type="button" className="aulas-cad-mas" onClick={() => setTodas((x) => !x)}>
          {todas
            ? "Ver sólo las que siguen abiertas"
            : `Ver las ${fmt(cadenas.historias.length)} cadenas, cerradas incluidas`}
        </button>
      ) : null}
    </div>
  );
}

/** Qué toca con esta cadena, en un verbo. */
function queToca(h: HistoriaDeCadena, vivo: EslabonDeCadena | undefined) {
  if (h.desenlace === "titular") return { palabra: "cerrada por su titular", tono: "ok" as const };
  if (h.desenlace === "reemplazo") return { palabra: `cerrada por ${h.cerro}`, tono: "ok" as const };
  if (!vivo) return { palabra: "sin reserva por delante", tono: "grave" as const };
  if (vivo.orden === 0) return { palabra: "el titular sigue en pie", tono: "espera" as const };
  return { palabra: `toca ${vivo.codigo}`, tono: "toca" as const };
}

function Cadena({ h, porCodigo }: {
  h: HistoriaDeCadena;
  porCodigo: Map<string, MonitoreoAulasPlanRow>;
}): ReactNode {
  // El eslabón vivo es el primero que no se ha caído: es a quien hay que
  // llamar. La cadena es guía, no candado, pero el orden es la guía.
  const vivo = h.eslabones.find((e) => !/rechaz|caid|no_aplic/i.test(e.status));
  const t = queToca(h, vivo);
  const falta = Math.max(0, h.meta - h.validas);

  return (
    <li className={`aulas-cad-item es-${t.tono}`}>
      <div className="aulas-cad-cabeza">
        <span className="aulas-cad-titular">
          <b>{h.titular}</b>
          <em>{facultadCorta(h.facultad)}</em>
        </span>
        <span className="aulas-cad-marcador">
          <b>{fmt(h.validas)}</b>
          <i>de {fmt(h.meta)}</i>
          {falta ? <u>faltan {fmt(falta)}</u> : null}
        </span>
        <span className={`aulas-cad-verbo es-${t.tono}`}>{t.palabra}</span>
      </div>

      <ol className="aulas-cad-eslabones">
        {h.eslabones.map((e) => {
          const fila = porCodigo.get(e.codigo);
          const caido = /rechaz|caid|no_aplic/i.test(e.status);
          const esVivo = vivo?.codigo === e.codigo;
          return (
            <li
              key={e.codigo}
              className={`aulas-cad-eslabon${caido ? " es-caido" : ""}${esVivo ? " es-vivo" : ""}`}
            >
              <span className="aulas-cad-quien">
                <b>{e.codigo}</b>
                <i>{e.orden === 0 ? "titular" : `reserva ${e.orden}`}</i>
              </span>
              {fila?.venue || fila?.sesiones_dia_hora ? (
                <span className="aulas-chips-fila">
                  {fila?.venue ? <ChipLugar lugar={String(fila.venue)} /> : null}
                  {fila?.sesiones_dia_hora ? <ChipHora>{String(fila.sesiones_dia_hora)}</ChipHora> : null}
                </span>
              ) : null}
              {/* El estado en las palabras del libro, no traducido a una lista
                  cerrada: el vocabulario del operativo es suyo y una lista
                  cerrada se lo tragaría en silencio. */}
              <span className="aulas-cad-estado">{e.status || "sin estado"}</span>
              <span className="aulas-cad-cifra">
                {e.validas ? <b>{fmt(e.validas)}</b> : <b className="es-cero">0</b>}
                <i>de {fmt(e.meta)}</i>
              </span>
            </li>
          );
        })}
      </ol>
    </li>
  );
}
