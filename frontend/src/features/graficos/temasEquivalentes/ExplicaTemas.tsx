// P21: qué hace cada gráfico que compara públicos por tema, en el estilo de «Qué compara» de las multiapiladas
// (multiapiladas/QueCompara.tsx): una línea, «Cómo sale» y un ejemplo de acreditación, con un boceto mínimo. Gonzalo
// pidió explicar mejor qué hace cada gráfico; esto no es un párrafo más.

export type TipoTemas = "radar" | "brecha" | "serie";

type Explicacion = { descripcion: string; comoSale: string; ejemplo: string };

export const EXPLICACION_TEMAS: Readonly<Record<TipoTemas, Explicacion>> = {
  radar: {
    descripcion: "Un eje por tema y una línea por público: se ve de un vistazo en qué temas un público queda por encima o por debajo de los demás.",
    comoSale: "cada vértice es un tema; cada línea, un público; más lejos del centro, más % marcó las respuestas del indicador.",
    ejemplo: "biblioteca, laboratorios, tutoría y bienestar (ejes) para docentes, estudiantes y administrativos (líneas), con el % de satisfechos.",
  },
  brecha: {
    descripcion: "Por cada tema, un punto por base y la distancia entre los dos: la brecha es la primera base menos la segunda.",
    comoSale: "una fila por tema con dos puntos unidos y, al margen, la diferencia en puntos.",
    ejemplo: "% de satisfechos con la infraestructura: docentes 72 % y estudiantes 66 % dan una brecha de +6 pts.",
  },
  serie: {
    descripcion: "Un indicador a lo largo de las mediciones: una base por periodo, en el orden declarado en Carga.",
    comoSale: "una línea por tema; cada punto es el % del indicador en una medición. Un periodo sin la pregunta no se inventa.",
    ejemplo: "% de satisfechos con la carrera en la acreditación 2023, 2024 y 2025: una línea por tema con tres puntos.",
  },
};

function Boceto({ tipo }: { tipo: TipoTemas }) {
  if (tipo === "radar") {
    return (
      <svg className="pulso-teq-boceto" viewBox="0 0 64 48" aria-hidden="true">
        <polygon className="is-guia" points="32,4 58,20 48,44 16,44 6,20" />
        <polygon className="is-serie-1" points="32,10 52,21 44,38 20,40 12,21" />
        <polygon className="is-serie-2" points="32,16 46,22 40,34 22,36 16,22" />
      </svg>
    );
  }
  if (tipo === "brecha") {
    return (
      <svg className="pulso-teq-boceto" viewBox="0 0 64 48" aria-hidden="true">
        {[10, 24, 38].map((y, i) => {
          const [a, b] = [[18, 44], [24, 36], [14, 50]][i];
          return (
            <g key={y}>
              <line className="is-guia" x1={a} y1={y} x2={b} y2={y} />
              <circle className="is-serie-1" cx={b} cy={y} r="3" />
              <circle className="is-serie-2" cx={a} cy={y} r="3" />
            </g>
          );
        })}
      </svg>
    );
  }
  return (
    <svg className="pulso-teq-boceto" viewBox="0 0 64 48" aria-hidden="true">
      <line className="is-guia" x1="4" y1="44" x2="60" y2="44" />
      <polyline className="is-serie-1" points="8,30 32,20 56,12" />
      <polyline className="is-serie-2" points="8,38 32,34 56,26" />
    </svg>
  );
}

export function ExplicaTemas({ tipo }: { tipo: TipoTemas }) {
  const e = EXPLICACION_TEMAS[tipo];
  return (
    <div className="pulso-teq-explica">
      <Boceto tipo={tipo} />
      <div className="pulso-teq-explica-texto">
        <p className="pulso-teq-explica-desc">{e.descripcion}</p>
        <p className="pulso-teq-explica-linea"><strong>Cómo sale:</strong> {e.comoSale}</p>
        <p className="pulso-teq-explica-linea"><strong>Ejemplo:</strong> {e.ejemplo}</p>
      </div>
    </div>
  );
}
