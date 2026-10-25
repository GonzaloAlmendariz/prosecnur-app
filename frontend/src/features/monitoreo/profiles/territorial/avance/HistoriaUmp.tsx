import { useState } from "react";
import { Info } from "lucide-react";
import { fmt } from "../rotulos";
import type { Jornada } from "./exploracionModel";
import type { CapituloDeUmp, HistoriaDeUmp, ResultadoDeFormulario } from "./historiaUmpModel";
import { JornadaDeFormularios } from "./JornadaDeFormularios";

const ROTULO_DE_RESULTADO: Record<ResultadoDeFormulario, string> = {
  cuenta: "Cuenta",
  observacion: "En observación",
  "no-cuenta": "No cuenta",
  "anulado-efectiva": "Anulado, había aceptado",
  "anulado-sin-consentimiento": "Anulado, sin consentimiento",
};

/**
 * «Historia de la UMP» (territorial.md §3.16b): curva escalonada de lo que
 * cuenta frente a la meta, con un día por paso a la misma distancia, y los
 * capítulos que la explican. Elegir un capítulo marca su día en la curva.
 */
export function HistoriaUmp({
  historia,
  jornadas = null,
  casoElegido = null,
  onElegirCapitulo,
  onElegirCaso,
}: {
  historia: HistoriaDeUmp;
  /** Con los casos de la UMP (GPS y hora) se puede ver cada formulario. */
  jornadas?: Jornada[] | null;
  casoElegido?: string | null;
  onElegirCapitulo?: (capitulo: CapituloDeUmp) => void;
  onElegirCaso?: (id: string) => void;
}) {
  const [elegido, setElegido] = useState<number | null>(null);
  const [cadaFormulario, setCadaFormulario] = useState(false);
  const { dias, capitulos, meta } = historia;
  if (!capitulos.length) {
    return (
      <section className="mon-ump-historia" aria-label={`Historia de la UMP ${historia.ump}`}>
        <h4 className="mon-ump-subtitulo">Historia de la UMP</h4>
        <p className="mon-ump-base">Sin formularios, anulaciones ni subsanaciones en el corte.</p>
      </section>
    );
  }
  const ancho = 520;
  const alto = 132;
  const margen = { arriba: 14, abajo: 22, lado: 12 };
  const tope = Math.max(meta, ...dias.map((dia) => dia.cuentan), 1);
  const paso = dias.length > 1 ? (ancho - margen.lado * 2) / (dias.length - 1) : 0;
  const x = (indice: number) => margen.lado + paso * indice;
  const y = (valor: number) => margen.arriba + (1 - valor / tope) * (alto - margen.arriba - margen.abajo);
  let trazo = `M${x(0)},${y(dias[0].cuentan)}`;
  dias.forEach((dia, indice) => {
    if (indice === 0) return;
    trazo += ` H${x(indice).toFixed(1)} V${y(dia.cuentan).toFixed(1)}`;
  });
  const cada = Math.max(1, Math.ceil(dias.length / 6));
  const diaElegido = elegido ? capitulos.find((capitulo) => capitulo.numero === elegido)?.dia : null;
  const jornada = jornadas?.length ? jornadas.find((item) => item.dia === diaElegido) ?? jornadas[0] : null;

  return (
    <section className="mon-ump-historia" aria-labelledby="mon-ump-historia-titulo">
      <header className="mon-ump-historia-cabecera">
        <h4 id="mon-ump-historia-titulo" className="mon-ump-subtitulo">Historia de la UMP</h4>
        <span className="mon-ump-base">Meta de {fmt(meta)}</span>
        {jornada ? (
          <button type="button" className="mon-ump-alternar" aria-pressed={cadaFormulario} onClick={() => setCadaFormulario((valor) => !valor)}>
            Ver cada formulario
          </button>
        ) : null}
      </header>
      <svg
        className="mon-ump-curva"
        viewBox={`0 0 ${ancho} ${alto}`}
        role="img"
        aria-label={`Historia de la UMP ${historia.ump}: ${fmt(capitulos.length)} momentos; hoy cuentan ${fmt(historia.cuentanHoy)} de ${fmt(meta)}.`}
      >
        <line className="mon-ump-curva-meta" x1={margen.lado} x2={ancho - margen.lado} y1={y(meta)} y2={y(meta)} />
        <path className="mon-ump-curva-trazo" d={trazo} />
        {dias.map((dia, indice) => (
          <g key={dia.dia}>
            {dia.dia === diaElegido ? <line className="mon-ump-curva-dia" x1={x(indice)} x2={x(indice)} y1={margen.arriba} y2={alto - margen.abajo} /> : null}
            {indice % cada === 0 || indice === dias.length - 1 ? (
              <text className="mon-ump-curva-eje" x={x(indice)} y={alto - 6} textAnchor="middle">{dia.rotulo}</text>
            ) : null}
            {dia.capitulo ? (
              <g className={`mon-ump-curva-hito${dia.capitulo === elegido ? " is-elegido" : ""}`}>
                <circle cx={x(indice)} cy={y(dia.cuentan)} r={8} />
                <text x={x(indice)} y={y(dia.cuentan) + 3.5} textAnchor="middle">{dia.capitulo}</text>
              </g>
            ) : null}
          </g>
        ))}
      </svg>
      {!historia.cuadra ? (
        <p className="mon-ump-nota">
          <Info size={14} aria-hidden="true" />
          <span title="Hay formularios sin fecha o fuera del corte">La curva termina en {fmt(capitulos.at(-1)?.cuentan ?? 0)} y el corte dice {fmt(historia.cuentanHoy)}</span>
        </p>
      ) : null}
      {cadaFormulario && jornada ? (
        <JornadaDeFormularios jornada={jornada} casoElegido={casoElegido} onElegirCaso={(id) => onElegirCaso?.(id)} />
      ) : (
      <ol className="mon-ump-capitulos" data-qa-geometry-group="territorial-ump-capitulos" data-qa-geometry-contract="equal">
        {capitulos.map((capitulo) => (
          <li key={capitulo.numero}>
            <button
              type="button"
              className={`mon-ump-capitulo is-${capitulo.tipo}`}
              aria-pressed={elegido === capitulo.numero}
              onClick={() => {
                const siguiente = elegido === capitulo.numero ? null : capitulo.numero;
                setElegido(siguiente);
                if (siguiente != null) onElegirCapitulo?.(capitulo);
              }}
            >
              <span className="mon-ump-capitulo-numero" aria-hidden="true">{capitulo.numero}</span>
              <span className="mon-ump-capitulo-texto">
                <small>{capitulo.fecha}</small>
                {capitulo.texto}
              </span>
              {capitulo.formularios.length ? (
                <span className="mon-ump-tira" role="img" aria-label={resumenDeLaTira(capitulo.formularios.map((item) => item.resultado))}>
                  {capitulo.formularios.map((formulario) => (
                    <span key={formulario.id} className={`is-${formulario.resultado}`} title={ROTULO_DE_RESULTADO[formulario.resultado]} />
                  ))}
                </span>
              ) : null}
              <b className="mon-ump-capitulo-cuota">{fmt(capitulo.cuentan)} / {fmt(meta)}</b>
            </button>
          </li>
        ))}
      </ol>
      )}
    </section>
  );
}

function resumenDeLaTira(resultados: readonly ResultadoDeFormulario[]): string {
  const conteo = new Map<ResultadoDeFormulario, number>();
  for (const resultado of resultados) conteo.set(resultado, (conteo.get(resultado) ?? 0) + 1);
  return [...conteo.entries()].map(([resultado, n]) => `${fmt(n)} ${ROTULO_DE_RESULTADO[resultado].toLowerCase()}`).join(", ");
}
