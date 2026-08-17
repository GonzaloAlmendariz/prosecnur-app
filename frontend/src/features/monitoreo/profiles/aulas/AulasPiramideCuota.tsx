import { useMemo } from "react";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { COLOR_RESULTADO } from "../../coloresDeResultado";
import { piramideDeCuota, type LadoDeCuota } from "./piramideDeCuota";

/**
 * La cuota de sexo por facultad, enfrentada como una pirámide.
 *
 * Una fila por facultad, un sexo a cada lado, **cada lado contra su propia
 * meta**. Así se ve en un vistazo de qué lado va corta cada facultad, que es la
 * pregunta de campo; la lista ordenada por cumplimiento contestaba la otra
 * —qué celda se va a incumplir— y dejaba las dos celdas de una facultad lejos
 * una de otra.
 *
 * Barras en CSS, sin Plotly: son doce barras y esta pestaña ya carga bastante.
 */

const fmt = (n: number) => n.toLocaleString("es-PE");

function tono(lado: LadoDeCuota) {
  if (lado.cumple) return COLOR_RESULTADO.efectiva;
  return lado.avance >= 50 ? COLOR_RESULTADO.parcial : COLOR_RESULTADO.pendiente;
}

/** Un lado de la fila; `hacia` decide de qué borde crece la barra. */
function Lado({ lado, tope, hacia }: {
  lado: LadoDeCuota | null;
  tope: number;
  hacia: "izquierda" | "derecha";
}) {
  if (!lado) {
    // Una facultad sin esa celda no se dibuja vacía como si fuera un cero: el
    // plan no declaró esa cuota y decirlo es distinto de decir que va en cero.
    return <span className={`aulas-piramide-lado es-${hacia} es-sin-cuota`}>sin cuota</span>;
  }
  // El carril mide la META contra la meta más alta —así una facultad grande se
  // ve grande— y el relleno, lo observado dentro de su propia meta.
  const carril = tope ? Math.max(6, (100 * lado.meta) / tope) : 0;
  const relleno = Math.min(100, lado.avance);
  return (
    <span
      className={`aulas-piramide-lado es-${hacia}`}
      title={`${lado.sexo}: ${fmt(lado.observadas)} de ${fmt(lado.meta)} · ${lado.avance}%`}
    >
      <span className="aulas-piramide-cifra">
        {lado.faltan ? `${fmt(lado.faltan)} faltan` : "cumplida"}
      </span>
      <span className="aulas-piramide-carril" style={{ width: `${carril}%` }}>
        <i style={{ width: `${relleno}%`, background: tono(lado) }} />
      </span>
    </span>
  );
}

export function AulasPiramideCuota({ filas }: { filas: ReadonlyArray<MonitoreoRow> }) {
  const { facultades, izquierda, derecha, otros, tope, sinMeta } = useMemo(
    () => piramideDeCuota(filas),
    [filas],
  );

  if (!facultades.length || !izquierda) {
    return (
      <p className="mon-profile-muted">
        {sinMeta
          ? `Las ${fmt(sinMeta)} celdas de cuota del plan no declaran objetivo.`
          : "El plan no declara composición por sexo para estos cursos-horario."}
      </p>
    );
  }

  return (
    <div className="aulas-piramide">
      <p className="aulas-piramide-ejes">
        <span>{izquierda}</span>
        <em>cada lado contra su propia meta</em>
        <span>{derecha}</span>
      </p>
      <ol className="aulas-piramide-lista">
        {facultades.map((fila) => (
          <li key={fila.facultad}>
            <Lado lado={fila.izquierda} tope={tope} hacia="izquierda" />
            <span className="aulas-piramide-facultad">{fila.facultad}</span>
            <Lado lado={fila.derecha} tope={tope} hacia="derecha" />
          </li>
        ))}
      </ol>
      {otros.length ? (
        // Lista cerrada con salida declarada: una pirámide tiene dos lados y un
        // tercer valor de sexo no cabe. Se dice en vez de desaparecer.
        <p className="mon-profile-muted">
          El plan declara además {otros.join(", ")}; una pirámide sólo enfrenta dos
          lados, así que esas celdas se ven en la tabla de abajo.
        </p>
      ) : null}
      {sinMeta ? (
        <p className="mon-profile-muted">
          {fmt(sinMeta)} celdas del plan no declaran objetivo y quedan fuera.
        </p>
      ) : null}
    </div>
  );
}
