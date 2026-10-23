import type { CSSProperties } from "react";
import { fmt } from "../formato";
import { pctConEspacio } from "../../../core/formatoComun";
import { FaltanteDiario } from "./FaltanteDiario";
import type { CadenaDeLaCifra, CuotasFaltante as Modelo, FilaDeCuota, PuntoAcumulado } from "./cuotasFaltanteModel";
import { llevaFaltanteDiario } from "./cuotasFaltanteModel";
import "./cuotasFaltante.css";

const ESTADO: Record<FilaDeCuota["estado"], string> = {
  cumple: "Cumple",
  "en-curso": "En curso",
  "sin-meta": "Sin meta",
};

function decimal(valor: number) {
  return new Intl.NumberFormat("es-PE", { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(valor);
}

/** «105.8 %»: un decimal y espacio antes del signo (estándar §2a, 5c). */
function porcentaje(valor: number | null) {
  return pctConEspacio(valor);
}

/** Barra de efectivas con la marca de la meta, a la escala del mayor de los dos. */
function BarraConMeta({ efectivas, meta, conRotulo }: { efectivas: number; meta: number | null; conRotulo: boolean }) {
  const tope = Math.max(meta ?? 0, efectivas, 1) * 1.08;
  return (
    <span className="mon-cuotas-barra" aria-hidden="true">
      <i className="mon-cuotas-barra-pista" />
      <i className="mon-cuotas-barra-valor" style={{ width: `${(efectivas / tope) * 100}%` }} />
      {meta != null ? (
        <>
          <i className="mon-cuotas-barra-meta" style={{ left: `${(meta / tope) * 100}%` }} />
          {conRotulo ? <em style={{ left: `${(meta / tope) * 100}%` }}>meta</em> : null}
        </>
      ) : null}
    </span>
  );
}

/** Acumulado diario frente a la meta (línea punteada), 150 × 40. */
function Acumulado({ puntos, meta, nombre }: { puntos: PuntoAcumulado[]; meta: number | null; nombre: string }) {
  if (puntos.length < 2) return <span className="mon-cuotas-sin-serie">Sin serie diaria</span>;
  const ancho = 150;
  const alto = 40;
  const ultimo = puntos.at(-1)?.valor ?? 0;
  const tope = Math.max(meta ?? 0, ultimo, 1) * 1.12;
  const xy = puntos.map((punto, i) => [
    3 + (i * (ancho - 6)) / (puntos.length - 1),
    alto - 3 - (punto.valor / tope) * (alto - 6),
  ] as const);
  const linea = `M${xy.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L")}`;
  const area = `${linea} L${xy.at(-1)?.[0].toFixed(1)} ${alto - 3} L3 ${alto - 3} Z`;
  const yMeta = meta != null ? alto - 3 - (meta / tope) * (alto - 6) : null;
  const alcanza = meta != null ? puntos.findIndex((punto) => punto.valor >= meta) : -1;
  const marca = xy[alcanza >= 0 ? alcanza : xy.length - 1];
  return (
    <svg
      className="mon-cuotas-acumulado"
      viewBox={`0 0 ${ancho} ${alto}`}
      role="img"
      aria-label={`${nombre}: acumulado diario frente a la meta`}
    >
      <path className="is-area" d={area} />
      {yMeta != null ? <line className="is-meta" x1="3" x2={ancho - 3} y1={yMeta} y2={yMeta} /> : null}
      <path className="is-linea" d={linea} />
      <circle className="is-marca" cx={marca[0]} cy={marca[1]} r="2.6" />
    </svg>
  );
}

function FilaDeLaTabla({ fila }: { fila: FilaDeCuota }) {
  return (
    <div className="mon-cuotas-fila" role="row">
      <span role="rowheader" className="mon-cuotas-categoria">
        <b>{fila.nombre}</b>
        <span className={`mon-cuotas-estado is-${fila.estado}`}>{ESTADO[fila.estado]}</span>
      </span>
      <span role="cell" className={`mon-cuotas-faltan is-num${fila.faltan ? " is-falta" : fila.faltan === 0 ? " is-cumple" : ""}`}>
        {fila.faltan == null ? "—" : fmt(fila.faltan)}
      </span>
      <span role="cell"><BarraConMeta efectivas={fila.efectivas} meta={fila.meta} conRotulo /></span>
      <span role="cell" className="mon-cuotas-sobre is-num">
        <b>{fmt(fila.efectivas)}</b>
        <span> / {fila.meta == null ? "—" : fmt(fila.meta)}</span>
      </span>
      <span role="cell" className={`mon-cuotas-pct is-num${fila.estado === "cumple" ? " is-cumple" : ""}`}>{porcentaje(fila.pct)}</span>
      <span role="cell"><Acumulado puntos={fila.acumulado} meta={fila.meta} nombre={fila.nombre} /></span>
      <span role="cell" className="is-num">{fila.cumplio ?? "—"}</span>
      <span role="cell" className="is-num">{fmt(fila.sinLlamar)}</span>
    </div>
  );
}

function Indicador({ etiqueta, valor, detalle }: { etiqueta: string; valor: string; detalle: string }) {
  return (
    <span className="mon-cuotas-indicador">
      <span className="mon-cuotas-antetitulo">{etiqueta}</span>
      <b>{valor}</b>
      <span>{detalle}</span>
    </span>
  );
}

const TRAMOS = [
  { clave: "efectivas", etiqueta: "Efectivas" },
  { clave: "rechazo", etiqueta: "Rechazo o parcial" },
  { clave: "llamado", etiqueta: "Llamado sin efectiva" },
  { clave: "sin-llamar", etiqueta: "Sin llamar" },
] as const;

function tramosDe(fila: FilaDeCuota) {
  const valores = [fila.efectivas, fila.rechazoOParcial, fila.llamadoSinEfectiva, fila.sinLlamar];
  const suma = valores.reduce((total, valor) => total + valor, 0) || 1;
  return TRAMOS.map((tramo, i) => ({ ...tramo, valor: valores[i], ancho: (valores[i] / suma) * 100 }));
}

function detalleDelReparto(fila: FilaDeCuota) {
  const plural = (n: number, uno: string, varios: string) => `${fmt(n)} ${n === 1 ? uno : varios}`;
  return `${plural(fila.efectivas, "efectiva", "efectivas")}, ${plural(fila.rechazoOParcial, "rechazo o parcial", "rechazos o parciales")}, `
    + `${plural(fila.llamadoSinEfectiva, "llamado sin efectiva", "llamados sin efectiva")} y ${fmt(fila.sinLlamar)} sin llamar`;
}

/**
 * Avance › Cuotas: el aterrizaje del modo telefónico. Cuánto falta por cuota,
 * primero; al lado, el número grande con sus cuatro indicadores, la base por
 * categoría y de dónde sale la cifra.
 */
export function CuotasFaltante({ modelo, cadena }: { modelo: Modelo; cadena: CadenaDeLaCifra }) {
  const { total, filas, segmento } = modelo;
  if (!filas.length) {
    return (
      <section className="mon-cuotas-vacio" aria-label="Cuotas">
        <span className="mon-cuotas-antetitulo">Avance por cuota</span>
        <strong>Sin cuotas declaradas</strong>
        <p>Declara la variable de cuota y sus metas en Modelo, Cuotas y calendario.</p>
      </section>
    );
  }
  const sinMetas = total.meta == null;
  const conDiario = llevaFaltanteDiario(modelo);
  const notaTotal = total.cumplio
    ? `cumplida el ${total.cumplio}`
    : total.desde && total.hasta ? `del ${total.desde} al ${total.hasta}` : "sin serie diaria";
  const segmentoMinuscula = segmento.toLocaleLowerCase("es");

  return (
    <div
      className={`mon-cuotas${conDiario ? " has-diario" : ""}`}
      data-qa-geometry-group="telefonico-avance-cuotas"
      data-qa-geometry-contract="intrinsic"
      style={{ "--mon-cuotas-filas": filas.length } as CSSProperties}
    >
      <section className="mon-cuotas-tabla-panel" aria-label={`Cuánto falta por ${segmentoMinuscula}`}>
        <div role="table" aria-label={`Cuotas por ${segmentoMinuscula}`} className="mon-cuotas-tabla">
          <div role="row" className="mon-cuotas-fila is-cabecera">
            <span role="columnheader">{segmento}</span>
            <span role="columnheader" className="is-num">Faltan</span>
            <span role="columnheader">Efectivas y meta</span>
            <span role="columnheader" className="is-num">Efect. / meta</span>
            <span role="columnheader" className="is-num">%</span>
            <span role="columnheader">Acumulado por día</span>
            <span role="columnheader" className="is-num">Cumplió</span>
            <span role="columnheader" className="is-num">Sin llamar</span>
          </div>
          <div role="rowgroup" className="mon-cuotas-cuerpo">
            {filas.map((fila) => <FilaDeLaTabla key={fila.clave} fila={fila} />)}
          </div>
          <div role="row" className="mon-cuotas-fila is-total">
            <span role="rowheader"><b>Total</b></span>
            <span role="cell" className={`mon-cuotas-faltan is-num${total.faltan ? " is-falta" : total.faltan === 0 ? " is-cumple" : ""}`}>
              {total.faltan == null ? "—" : fmt(total.faltan)}
            </span>
            <span role="cell"><BarraConMeta efectivas={total.efectivas} meta={total.meta} conRotulo={false} /></span>
            <span role="cell" className="mon-cuotas-sobre is-num">
              <b>{fmt(total.efectivas)}</b>
              <span> / {total.meta == null ? "—" : fmt(total.meta)}</span>
            </span>
            <span role="cell" className="mon-cuotas-pct is-num is-total">{porcentaje(total.pct)}</span>
            <span role="cell" className="mon-cuotas-rango">
              {total.desde && total.hasta ? `Del ${total.desde} al ${total.hasta}` : "—"}
            </span>
            <span role="cell" className="is-num">{total.cumplio ?? "—"}</span>
            <span role="cell" className="is-num"><b>{fmt(total.sinLlamar)}</b></span>
          </div>
        </div>
        {conDiario ? <FaltanteDiario modelo={modelo} /> : null}
      </section>

      <div className="mon-cuotas-lado">
        <section className="mon-cuotas-panel mon-cuotas-meta" aria-label="Faltan para la meta">
          <span className="mon-cuotas-antetitulo">{sinMetas ? "Efectivas" : "Faltan para la meta"}</span>
          {sinMetas ? (
            <strong className="mon-cuotas-grande is-num">{fmt(total.efectivas)}</strong>
          ) : (
            <strong className={`mon-cuotas-grande is-num${total.faltan ? " is-falta" : " is-cumple"}`}>
              {fmt(total.faltan)}
              <span> de {fmt(total.meta)}</span>
            </strong>
          )}
          <span className="mon-cuotas-meta-nota is-num">
            {sinMetas
              ? "Sin metas declaradas: Avance mide cobertura del listado"
              : `${fmt(total.efectivas)} efectivas, ${porcentaje(total.pct)}; ${notaTotal}`}
          </span>
          <div className="mon-cuotas-indicadores">
            <Indicador
              etiqueta="Ritmo"
              valor={modelo.ritmo ? `${decimal(modelo.ritmo.porDia)} por día` : "—"}
              detalle={modelo.ritmo ? `${fmt(total.efectivas)} en ${fmt(modelo.ritmo.dias)} días con envíos` : "Sin días con envíos"}
            />
            <Indicador
              etiqueta="Rendimiento"
              valor={modelo.rendimiento != null ? `${decimal(modelo.rendimiento)} registros` : "—"}
              detalle="de base por efectiva"
            />
            <Indicador etiqueta="Sin llamar" valor={fmt(total.sinLlamar)} detalle={`del listado de ${fmt(total.universo)}`} />
            <Indicador
              etiqueta="Sin asignar"
              valor={modelo.sinAsignar == null ? "—" : fmt(modelo.sinAsignar)}
              detalle={modelo.sinAsignar == null ? "la hoja no lo informa" : "sin llamar y sin responsable"}
            />
          </div>
        </section>

        <section className="mon-cuotas-panel mon-cuotas-reparto" aria-label={`Listado por ${segmentoMinuscula}`}>
          <span className="mon-cuotas-titulo">
            <span className="mon-cuotas-antetitulo">Listado por {segmentoMinuscula}</span>
            <span className="is-num">{fmt(total.universo)} casos</span>
          </span>
          <div className="mon-cuotas-reparto-lista">
            {filas.map((fila) => (
              <div key={fila.clave} className="mon-cuotas-reparto-fila is-num">
                <span className="mon-cuotas-reparto-rotulo">
                  <b>{fila.nombre}</b>
                  <span>{fmt(fila.universo)} casos</span>
                  <span className="is-derecha">{fmt(fila.sinLlamar)} sin llamar</span>
                </span>
                <span
                  className="mon-cuotas-reparto-barra"
                  role="img"
                  aria-label={tramosDe(fila).map((tramo) => `${tramo.etiqueta}: ${fmt(tramo.valor)}`).join(", ")}
                >
                  {tramosDe(fila).map((tramo) => (
                    <i key={tramo.clave} className={`is-${tramo.clave}`} style={{ width: `${tramo.ancho}%` }} />
                  ))}
                </span>
                {filas.length < 4 ? (
                  // Con pocas categorías hay alto para decir las cifras de la barra.
                  <span className="mon-cuotas-reparto-detalle">{detalleDelReparto(fila)}</span>
                ) : null}
              </div>
            ))}
          </div>
          <span className="mon-cuotas-leyenda">
            {TRAMOS.map((tramo) => (
              <span key={tramo.clave}><i className={`is-${tramo.clave}`} aria-hidden="true" />{tramo.etiqueta}</span>
            ))}
          </span>
        </section>

        <section className="mon-cuotas-panel mon-cuotas-cadena" aria-label="De dónde sale la cifra">
          <span className="mon-cuotas-antetitulo">De dónde sale la cifra</span>
          {cadena.map((paso) => (
            <div key={paso.nombre} className="mon-cuotas-cadena-paso is-num">
              <span>
                <b>{paso.nombre}</b>
                <span>{paso.detalle}</span>
              </span>
              <strong>{fmt(paso.valor)}</strong>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
