import { useMemo } from "react";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { COLOR_RESULTADO } from "../../coloresDeResultado";
import { cuotasResumen, type CorteDeCuota } from "./cuotasResumen";
import { fmt } from "./kpisDeAulas";

/**
 * La cuota del estudio en personas, y sus dos desagregados.
 *
 * El tablero decía «2/12 celdas» y eso no contesta la pregunta del operativo:
 * doce celdas pueden estar a una respuesta o a doscientas y el contador se ve
 * igual. Aquí se lee **cuánta gente falta**, en total, por facultad y por sexo.
 */

/**
 * La barra del total, con su cifra al lado.
 *
 * Era genérica —servía para las tres listas— y llevaba `onElegir`, `activo` y
 * `conDesglose`. Al retirarse las listas por facultad y por sexo se queda sólo
 * el total, así que esos tres parámetros no tenían ya ningún uso: un componente
 * que conserva la forma de lo que ya no hace es deuda, no flexibilidad.
 */
function Barra({ corte }: { corte: CorteDeCuota }) {
  // Se recorta al 100 % sólo para pintar: la cifra sigue diciendo la verdad.
  const ancho = Math.min(100, corte.avance);
  const tono = corte.faltan === 0
    ? COLOR_RESULTADO.efectiva
    : corte.avance >= 50 ? COLOR_RESULTADO.parcial : COLOR_RESULTADO.pendiente;
  return (
    <div className="aulas-cuota-fila es-total">
      <span className="aulas-cuota-etiqueta"><span>{corte.etiqueta}</span></span>
      <span className="aulas-cuota-pista" role="img" aria-label={`${corte.avance}% de la cuota`}>
        <span style={{ width: `${ancho}%`, background: tono }} />
      </span>
      <span className="aulas-cuota-cifra">
        <strong>{corte.faltan.toLocaleString("es-PE")}</strong> por recoger
      </span>
    </div>
  );
}

/**
 * La entidad enfocada dentro de la sección.
 *
 * `facultad` y `sexo` acotan lo que se ve; **`aula` no acota nada: abre la ficha
 * de ese curso-horario**. Comparten parámetro porque la gramática declara `foco`
 * para la entidad seleccionada y no hay una sexta dimensión que inventar, y el
 * prefijo evita la ambigüedad de un valor suelto. Los consumidores que sólo
 * miran `facultad` siguen ignorando el resto, que es como estaba escrito.
 */
export type FocoDeCuota = { tipo: "facultad" | "sexo" | "aula"; valor: string } | null;

/** Serializa el foco para la URL: `facultad:Derecho`, `sexo:F`, `aula:CH 31`. */
export function focoDesdeTexto(bruto: string | null): FocoDeCuota {
  const [tipo, ...resto] = (bruto ?? "").split(":");
  const valor = resto.join(":").trim();
  if (!valor || (tipo !== "facultad" && tipo !== "sexo" && tipo !== "aula")) return null;
  return { tipo, valor };
}

export function textoDesdeFoco(foco: FocoDeCuota) {
  return foco ? `${foco.tipo}:${foco.valor}` : "";
}

export function AulasCuotasResumen({ filas }: { filas: ReadonlyArray<MonitoreoRow> }) {
  const { general, sinMeta } = useMemo(() => cuotasResumen(filas), [filas]);

  if (!general.celdas) {
    return (
      <p className="mon-profile-muted">
        {sinMeta
          ? `Las ${fmt(sinMeta)} celdas de cuota del plan no declaran objetivo.`
          : "El plan no declara composición por sexo para estos cursos-horario."}
      </p>
    );
  }

  return (
    <div className="aulas-cuotas-resumen">
      <Barra corte={{ ...general, etiqueta: "Cuota del estudio" }} />
      <p className="aulas-cuota-lectura">
        <strong>{general.logrado.toLocaleString("es-PE")}</strong> de{" "}
        <strong>{general.meta.toLocaleString("es-PE")}</strong> personas ·{" "}
        {general.celdasCumplidas} de {general.celdas} celdas cumplidas
        {sinMeta ? ` · ${sinMeta} sin objetivo declarado` : ""}
      </p>

      {/* La lista «Por facultad» se retiró: decía exactamente lo que la pirámide
          —las mismas seis facultades con el mismo desglose «F 230 · M 97»— y en
          la forma peor de las dos, porque separa los dos sexos de una facultad
          en vez de enfrentarlos. Dos gráficos del mismo cruce le quitaban el
          protagonismo justo al que contesta la pregunta. El foco por facultad se
          mudó a la pirámide, que ahora es quien lo controla.

          «Por sexo» tampoco vive aquí: es el marginal de los dos lados, y donde
          se lee es en el eje de la propia pirámide. */}
    </div>
  );
}
