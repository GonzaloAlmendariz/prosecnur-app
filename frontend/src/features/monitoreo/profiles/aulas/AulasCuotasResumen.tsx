import { useMemo } from "react";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { COLOR_RESULTADO } from "../../coloresDeResultado";
import { cuotasResumen, type CorteDeCuota } from "./cuotasResumen";

/**
 * La cuota del estudio en personas, y sus dos desagregados.
 *
 * El tablero decía «2/12 celdas» y eso no contesta la pregunta del operativo:
 * doce celdas pueden estar a una respuesta o a doscientas y el contador se ve
 * igual. Aquí se lee **cuánta gente falta**, en total, por facultad y por sexo.
 */

/** Una barra de cumplimiento con su cifra al lado. */
function Barra({ corte, destacado = false, onElegir, activo = false, conDesglose = false }: {
  corte: CorteDeCuota;
  destacado?: boolean;
  /** Si viene, la fila es un control: elegir ese corte enfoca el detalle. */
  onElegir?: () => void;
  activo?: boolean;
  /**
   * Si la fila muestra de qué sexo es lo que le falta. Sólo la lista por
   * facultad: en la lista por sexo el desglose sería la lista de facultades
   * entera, que ya está a la izquierda, escrita en una línea.
   */
  conDesglose?: boolean;
}) {
  // Se recorta al 100 % sólo para pintar: la cifra sigue diciendo la verdad.
  const ancho = Math.min(100, corte.avance);
  const tono = corte.faltan === 0
    ? COLOR_RESULTADO.efectiva
    : corte.avance >= 50 ? COLOR_RESULTADO.parcial : COLOR_RESULTADO.pendiente;
  // Cuánto de lo que falta es de cada sexo. La lista por facultad y la lista por
  // sexo son dos marginales —«faltan 167 en Gestión» y «faltan 584 mujeres»— y
  // ninguna dice cuántas de esas 167 son mujeres, que es lo que decide a quién
  // buscar en esa facultad.
  //
  // Se muestra aunque quede una sola parte: que las 130 que faltan en Letras
  // sean TODAS mujeres no es redundante, es la respuesta. Esconderlo por
  // «tener un solo elemento» borraba justo el caso más claro.
  const desglose = conDesglose ? (corte.desglose ?? []).filter((parte) => parte.faltan > 0) : [];
  const contenido = (
    <>
      <span className="aulas-cuota-etiqueta">
        {/* En su propio `span`: el nombre sí puede recortarse con elipsis y el
            desglose no, y para eso tienen que ser dos elementos. */}
        <span>{corte.etiqueta}</span>
        {desglose.length ? (
          <em className="aulas-cuota-desglose">
            {desglose.map((parte) => `${parte.etiqueta} ${parte.faltan.toLocaleString("es-PE")}`).join(" · ")}
            {desglose.length === 1 ? " — todo lo que falta" : ""}
          </em>
        ) : null}
      </span>
      <span className="aulas-cuota-pista" role="img" aria-label={`${corte.avance}% de la cuota`}>
        <span style={{ width: `${ancho}%`, background: tono }} />
      </span>
      <span className="aulas-cuota-cifra">
        {corte.faltan === 0
          ? "cumplida"
          : <><strong>{corte.faltan.toLocaleString("es-PE")}</strong> por recoger</>}
      </span>
    </>
  );
  const clase = `aulas-cuota-fila${destacado ? " es-total" : ""}${activo ? " es-activa" : ""}`;
  // Con `onElegir` la fila es un botón de verdad —foco, teclado y estado
  // anunciado—; sin él, un div. Un `div` con `onClick` no lo alcanza quien
  // navega con teclado.
  return onElegir ? (
    <button type="button" className={clase} onClick={onElegir} aria-pressed={activo}>
      {contenido}
    </button>
  ) : (
    <div className={clase}>{contenido}</div>
  );
}

export type FocoDeCuota = { tipo: "facultad" | "sexo"; valor: string } | null;

/** Serializa el foco para la URL: `facultad:Derecho`, `sexo:F`. */
export function focoDesdeTexto(bruto: string | null): FocoDeCuota {
  const [tipo, ...resto] = (bruto ?? "").split(":");
  const valor = resto.join(":").trim();
  if (!valor || (tipo !== "facultad" && tipo !== "sexo")) return null;
  return { tipo, valor };
}

export function textoDesdeFoco(foco: FocoDeCuota) {
  return foco ? `${foco.tipo}:${foco.valor}` : "";
}

export function AulasCuotasResumen({ filas, foco, onFoco }: {
  filas: ReadonlyArray<MonitoreoRow>;
  foco: FocoDeCuota;
  onFoco: (foco: FocoDeCuota) => void;
}) {
  const { general, porFacultad, porSexo, sinMeta } = useMemo(() => cuotasResumen(filas), [filas]);

  if (!general.celdas) {
    return (
      <p className="mon-profile-muted">
        {sinMeta
          ? `Las ${sinMeta} celdas de cuota del plan no declaran objetivo.`
          : "El plan no declara composición por sexo para estos cursos-horario."}
      </p>
    );
  }

  return (
    <div className="aulas-cuotas-resumen">
      <Barra corte={{ ...general, etiqueta: "Cuota del estudio" }} destacado />
      <p className="aulas-cuota-lectura">
        <strong>{general.logrado.toLocaleString("es-PE")}</strong> de{" "}
        <strong>{general.meta.toLocaleString("es-PE")}</strong> personas ·{" "}
        {general.celdasCumplidas} de {general.celdas} celdas cumplidas
        {sinMeta ? ` · ${sinMeta} sin objetivo declarado` : ""}
      </p>

      <div className="aulas-cuotas-cortes">
        <section>
          <h4>Por facultad</h4>
          {porFacultad.map((corte) => (
            <Barra
              key={corte.etiqueta}
              corte={corte}
              conDesglose
              activo={foco?.tipo === "facultad" && foco.valor === corte.etiqueta}
              onElegir={() => onFoco(
                foco?.tipo === "facultad" && foco.valor === corte.etiqueta
                  ? null
                  : { tipo: "facultad", valor: corte.etiqueta },
              )}
            />
          ))}
        </section>
        <section>
          <h4>Por sexo</h4>
          {porSexo.map((corte) => (
            <Barra
              key={corte.etiqueta}
              corte={corte}
              activo={foco?.tipo === "sexo" && foco.valor === corte.etiqueta}
              onElegir={() => onFoco(
                foco?.tipo === "sexo" && foco.valor === corte.etiqueta
                  ? null
                  : { tipo: "sexo", valor: corte.etiqueta },
              )}
            />
          ))}
        </section>
      </div>
    </div>
  );
}
