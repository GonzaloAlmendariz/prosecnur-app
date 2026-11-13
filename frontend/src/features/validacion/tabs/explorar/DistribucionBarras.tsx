import { useState, type CSSProperties } from "react";
import { Popover } from "../../../../components/Popover";
import type { ExploradorDist, ExploradorDistFila } from "../../../../api/validacionExplorar";
import { estiloConVariables } from "./estiloConVariables";
import { divergente, esFueraDeLista, esResidual, fmtN, fmtPct, ordenarFilas, type Divergente, type LadoDivergente } from "./explorarModelo";
import { formatoConteo } from "../../../../lib/formatoNumero";
import type { LecturaDeDistribucion } from "./lecturaDeDistribucion";
import { resumenDeLaDivergente, textoDelTramo, tramosLeidos, type CifraDelResumen, type TramoLeido } from "./cifrasDeLaDivergente";

const VISIBLES = 15;

/**
 * E6 — única y múltiple: barras horizontales propias (no Plotly), ordenadas
 * por frecuencia con "Otro" y "No sabe" al final y "Sin respuesta" aparte,
 * fuera de la base del porcentaje. La pista es la escala de 0 a 100 % y todas
 * las barras van del mismo color, como el prototipo. Una lista
 * ordinal respeta su orden y suma arriba la barra divergente; una múltiple
 * suma abajo cuántas opciones marca cada caso. Con `valor = "casos"` la cifra
 * fuerte de cada barra es el conteo y el porcentaje pasa al costado.
 */
export default function DistribucionBarras({
  dist,
  sinRespuesta,
  declarados = null,
  valor = "porcentaje",
}: {
  dist: ExploradorDist;
  sinRespuesta: number | null;
  valor?: LecturaDeDistribucion["valor"];
  /** Códigos de la lista según la ficha; sin ella, se infieren de la cola. */
  declarados?: ReadonlySet<string> | null;
}) {
  const [todas, setTodas] = useState(false);
  const fuera = esFueraDeLista(dist.filas ?? [], declarados);
  const filas = ordenarFilas(dist.filas ?? [], dist.ordinal, declarados);
  const visibles = todas ? filas : filas.slice(0, VISIBLES);
  const div = dist.ordinal && dist.tipo === "so" ? divergente(filas.filter((f) => !fuera(f))) : null;

  // Una escala se lee en su barra divergente, con la cifra en cada tramo y la leyenda debajo: repetirla en cinco
  // barras sueltas decía lo mismo dos veces.
  // "No sabe", "Sin información" y los códigos fuera de la lista no son parte de la escala, pero tampoco se
  // esconden: cierran la barra en gris, después de un corte, y la leyenda los nombra.
  if (div) return <BarraDivergente div={div} aparte={filas.filter((f) => esResidual(f.etiqueta) || fuera(f))} valor={valor} />;
  const casos = valor === "casos";

  return (
    <div className="vx-barras" data-qa-geometry-group="validacion/explorar-barras" data-qa-geometry-contract="intrinsic">
      {visibles.map((f) => (
        <div
          key={`${f.codigo}-${f.etiqueta}`}
          className={`vx-barra-fila${esResidual(f.etiqueta) || fuera(f) ? " is-residual" : ""}`}
        >
          <span className="vx-barra-etq">
            {fuera(f) ? <><span className="vx-mono">{f.etiqueta}</span> (fuera de la lista)</> : f.etiqueta}
          </span>
          <span className="vx-pista" aria-hidden>
            <span className="vx-relleno" style={{ width: `${Math.max(f.n > 0 ? 0.6 : 0, Math.min(100, f.pct))}%` }} />
          </span>
          <span className="vx-barra-pct">{casos ? fmtN(f.n) : fmtPct(f.pct)}</span>
          <span className="vx-barra-n">{casos ? fmtPct(f.pct) : fmtN(f.n)}</span>
        </div>
      ))}
      {filas.length > VISIBLES && (
        <button type="button" className="vx-ver-mas" aria-expanded={todas} onClick={() => setTodas((t) => !t)}>
          {todas ? "Ver menos" : `Ver las ${formatoConteo(filas.length)} opciones`}
        </button>
      )}
      {sinRespuesta !== null && (
        <div className="vx-barra-fila is-sin">
          <span className="vx-barra-etq">Sin respuesta</span>
          <span className="vx-pista">fuera de la base del porcentaje</span>
          {/* Sin respuesta no tiene porcentaje: queda fuera de la base. */}
          <span className="vx-barra-pct">{casos ? fmtN(sinRespuesta) : ""}</span>
          <span className="vx-barra-n">{casos ? "" : fmtN(sinRespuesta)}</span>
        </div>
      )}
      {dist.tipo === "sm" && dist.cuantas_marca && dist.cuantas_marca.length > 0 && (
        <div className="vx-cuantas" aria-label="Cuántas opciones marca cada caso">
          {dist.cuantas_marca.map((c) => (
            <span key={c.k}>
              {c.k === "1" ? "1 opción" : c.k === "2" ? "2 opciones" : "3 o más"}: {fmtPct(c.pct)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function BarraDivergente({
  div,
  aparte,
  valor,
}: {
  div: Divergente;
  aparte: readonly ExploradorDistFila[];
  valor: LecturaDeDistribucion["valor"];
}) {
  // Con "Casos", el resumen y cada tramo dicen el conteo; con "Porcentaje", el porcentaje (ítem 39). La cifra
  // que no entra en su tramo va junto a su opción en la leyenda, y cada tramo dice su opción, casos y
  // porcentaje al pasar el mouse o al enfocarlo con el teclado.
  const resumen = resumenDeLaDivergente(div, valor);
  const escala = tramosLeidos(div.segmentos.map((s) => s.fila), valor);
  const resto = tramosLeidos(aparte, valor);
  const fuera = (t: TramoLeido) => (!t.dentro && t.fila.n > 0 ? <b className="vx-leyenda-cifra">{t.cifra}</b> : null);
  const intensidad = (x: number) => estiloConVariables({ "--vx-int": `${Math.round(35 + 60 * x)}%` });
  // Las muestras de color de las opciones que suma cada lado: así se ve que el resumen agrupa.
  const muestras = (lado: LadoDivergente) => (
    <span className="vx-div-muestras" aria-hidden>
      {div.segmentos.filter((s) => s.lado === lado).map((s) => (
        <i key={`${s.fila.codigo}-${s.fila.etiqueta}`} className={`vx-div-seg is-${s.lado}`} style={intensidad(s.intensidad)} />
      ))}
    </span>
  );
  const ladoDelResumen = (lado: LadoDivergente, r: { etiqueta: string } & CifraDelResumen) => (
    <span className={`is-${lado}`}>
      <CifraResumen c={r} />
      <span className="vx-div-grupo">{muestras(lado)}{r.etiqueta}</span>
    </span>
  );
  return (
    <div className="vx-div">
      <div className="vx-div-resumen">
        {ladoDelResumen("baja", resumen.baja)}
        {resumen.centro && ladoDelResumen("centro", resumen.centro)}
        {ladoDelResumen("alta", resumen.alta)}
      </div>
      <div className="vx-div-barra" role="group" aria-label="Respuestas de la escala">
        {div.segmentos.map((s, i) => (
          <Tramo
            key={`${s.fila.codigo}-${s.fila.etiqueta}`}
            tramo={escala[i]}
            clase={`vx-div-seg is-${s.lado}`}
            style={estiloConVariables({ "--vx-int": `${Math.round(35 + 60 * s.intensidad)}%` }, { flexBasis: `${s.fila.pct}%`, flexGrow: 0 })}
          />
        ))}
        {resto.map((t, i) => (
          <Tramo
            key={`aparte-${t.fila.codigo}-${t.fila.etiqueta}`}
            tramo={t}
            clase={`vx-div-seg is-aparte${i === 0 ? " is-corte" : ""}`}
            style={{ flexBasis: `${t.fila.pct}%`, flexGrow: 0 }}
          />
        ))}
      </div>
      <div className="vx-leyenda">
        {div.segmentos.map((s, i) => (
          <span key={`${s.fila.codigo}-${s.fila.etiqueta}`}>
            <i className={`vx-div-seg is-${s.lado}`} aria-hidden style={intensidad(s.intensidad)} />
            {s.fila.etiqueta}
            {fuera(escala[i])}
          </span>
        ))}
        {resto.map((t) => (
          <span key={`aparte-${t.fila.codigo}-${t.fila.etiqueta}`}>
            <i className="vx-div-seg is-aparte" aria-hidden />
            {t.fila.etiqueta}
            {fuera(t)}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Un tramo de la barra: enfocable, con su opción, casos y porcentaje en el globo del kit. */
function Tramo({ tramo, clase, style }: { tramo: TramoLeido; clase: string; style: CSSProperties }) {
  const texto = textoDelTramo(tramo.fila);
  return (
    <Popover
      openOn="hover"
      side="top"
      maxWidth={280}
      hoverCloseDelay={0}
      className="vx-div-globo"
      ariaLabel={texto}
      trigger={(
        <span className={clase} style={style} tabIndex={0} role="img" aria-label={texto}>
          {tramo.dentro ? tramo.cifra : ""}
        </span>
      )}
    >
      {texto}
    </Popover>
  );
}

function CifraResumen({ c }: { c: CifraDelResumen }) {
  return (
    <span className="vx-div-cifra">
      <b>{c.fuerte}</b>
      {c.aparte && <em>{c.aparte}</em>}
    </span>
  );
}
