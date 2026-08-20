import { useMemo } from "react";

import { Filter, TriangleAlert } from "../../../../vendor/lucide-react";
import { cadenaDeFiltros } from "./cadenaDeFiltros";

/**
 * Cuántas respuestas descarta cada filtro declarado.
 *
 * Antes sólo viajaba el total de válidas, y con un total no se puede saber si
 * el criterio está trabajando. El caso que este panel existe para hacer visible
 * es el de un filtro que **no descarta nada**: declararlo da la apariencia de
 * control sin ejercerlo, y el total sale idéntico al de no tener criterio.
 */

const fmt = (n: number) => n.toLocaleString("es-PE");

export function AulasCadenaDeFiltros({ bloque }: { bloque: unknown }) {
  const c = useMemo(() => cadenaDeFiltros(bloque), [bloque]);

  if (!c.pasos.length) {
    return (
      <div className="aulas-cadena-filtros" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
        <p className="aulas-cadenas-lectura">
          Este estudio <strong>no declara filtros de respuesta válida</strong>,
          así que cuentan todas las respuestas que llegan.
        </p>
        <p className="mon-profile-muted">
          Los filtros se declaran en Fuentes, junto al resto del mapeo de la base.
        </p>
      </div>
    );
  }

  return (
    <div className="aulas-cadena-filtros" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
      {c.nadieDescarta ? (
        // El hallazgo, no una nota al pie: un criterio que no descarta nada da
        // el mismo total que no tener criterio, y eso hay que verlo.
        <p className="aulas-cadena-alarma">
          <TriangleAlert size={14} aria-hidden="true" />
          Los filtros declarados no descartan ni una respuesta: aceptan todos los
          valores que trae la base, así que el total es el mismo que sin criterio.
        </p>
      ) : (
        <p className="aulas-cadenas-lectura">
          De <strong>{fmt(c.entran)}</strong> respuestas, la cadena deja{" "}
          <strong>{fmt(c.quedan)}</strong>.
        </p>
      )}

      <ol className="aulas-cadena-pasos">
        {c.pasos.map((p) => (
          <li key={`${p.orden}-${p.variable}`}>
            <span className="aulas-cadena-var">
              {p.variable}
              <small>{p.valores.join(" · ")}</small>
            </span>
            <span className="aulas-cadena-flujo">
              {fmt(p.entran)} → <strong>{fmt(p.quedan)}</strong>
            </span>
            <span className={p.caen > 0 ? "aulas-cadena-caen is-activo" : "aulas-cadena-caen"}>
              {p.caen > 0 ? `−${fmt(p.caen)}` : "no descarta"}
              {/* Sólo cuando difiere de lo que cae: si coinciden, repetir el
                  número dos veces con nombres distintos confunde en vez de
                  informar. */}
              {p.caen > 0 && p.caenSoloAqui !== p.caen && (
                <small>{fmt(p.caenSoloAqui)} sólo por éste</small>
              )}
            </span>
          </li>
        ))}
      </ol>

      {c.sinColumna.length > 0 && (
        <p className="mon-profile-muted">
          <Filter size={13} aria-hidden="true" />
          {c.sinColumna.length === 1
            ? `El filtro «${c.sinColumna[0]}» no se aplicó: la base no trae esa columna.`
            : `${fmt(c.sinColumna.length)} filtros no se aplicaron porque la base no trae su columna: ${c.sinColumna.join(", ")}.`}
        </p>
      )}
    </div>
  );
}
