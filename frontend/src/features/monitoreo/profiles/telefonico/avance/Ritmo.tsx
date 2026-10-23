import { useMemo } from "react";
import type { MonitoreoAcreditacionReports, MonitoreoState } from "../../../../../api/client";
import {
  FAMILIAS_DE_LLAMADA,
  fechaCorta,
  formatosDeFecha,
  resumenDeRitmo,
  notaSinCategoria,
  serieDiariaDelCorte,
  serieHoja,
  type FamiliaDeLlamada,
} from "./ritmoModel";
import { metaDelProyecto } from "./metaDelProyecto";
import "../control/controlTelefonico.css";
import "../insumos/insumosTelefonico.css";
import "./ritmoTelefonico.css";

const ETIQUETA_DE_FAMILIA: Record<FamiliaDeLlamada, string> = {
  efectiva: "Efectiva",
  parcial: "Parcial",
  rechazo: "Rechazo",
  reintentable: "Reintentable",
  terminal: "Terminal",
};

/** Cuántas categorías llevan color propio; el resto se suma en «Otras». */
const SERIES = 6;

function n(valor: number) {
  return valor.toLocaleString("es-PE");
}

function decimal(valor: number) {
  return valor.toLocaleString("es-PE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/**
 * Avance › Ritmo: las efectivas de Kobo por día y categoría con su acumulado
 * y la meta, los llamados que registra la hoja en el mismo eje de fechas (así
 * se ve el día en que la hoja deja de registrar), el mapa de calor categoría
 * por día y cómo vienen escritas las fechas de la hoja. Sólo lectura.
 */
export function Ritmo({
  reports,
  state,
}: {
  reports: MonitoreoAcreditacionReports;
  state: MonitoreoState | null | undefined;
}) {
  const reglas = state?.config?.operational_model?.state_rules;
  // La misma serie que leen el calendario de Cuotas, la vista del PDF y los chips.
  const { segmento, serie: kobo, sinCategoria, fueraDeCuota } = useMemo(() => serieDiariaDelCorte(reports), [reports]);
  const notaDeSerie = notaSinCategoria(sinCategoria, segmento, fueraDeCuota);
  const hoja = useMemo(() => serieHoja(reports, reglas ?? []), [reports, reglas]);
  const fechasDeLaHoja = useMemo(() => formatosDeFecha(reports), [reports]);
  const meta = metaDelProyecto(state);
  const resumen = resumenDeRitmo(kobo, meta);

  const fechas = useMemo(
    () => [...new Set([...kobo.fechas, ...Object.keys(hoja.totalPorFecha)])].sort(),
    [kobo.fechas, hoja.totalPorFecha],
  );
  const conColor = kobo.categorias.slice(0, SERIES - 1).map((categoria) => categoria.nombre);
  const series = kobo.categorias.length > SERIES
    ? [...conColor, "Otras"]
    : kobo.categorias.map((categoria) => categoria.nombre);
  const valorDe = (serie: string, iso: string) => (
    serie === "Otras"
      ? kobo.categorias.slice(SERIES - 1).reduce((suma, categoria) => suma + (kobo.celdas[categoria.nombre]?.[iso] ?? 0), 0)
      : kobo.celdas[serie]?.[iso] ?? 0
  );
  const maximoKobo = Math.max(1, ...fechas.map((iso) => kobo.porFecha[iso] ?? 0));
  const maximoHoja = Math.max(1, ...fechas.map((iso) => hoja.totalPorFecha[iso] ?? 0));
  const tope = Math.max(1, meta ?? 0, kobo.total);
  const ultimoKobo = kobo.fechas.at(-1) ?? null;
  const hojaSeDetiene = hoja.ultima && ultimoKobo && hoja.ultima < ultimoKobo ? hoja.ultima : null;
  const maximoCelda = Math.max(1, ...kobo.categorias.flatMap((categoria) => kobo.fechas.map((iso) => kobo.celdas[categoria.nombre]?.[iso] ?? 0)));
  const nombreDeSegmento = segmento ? segmento.toLocaleLowerCase("es") : "categoría";
  const puntos = fechas.map((iso, i) => {
    const x = ((i + 0.5) / Math.max(1, fechas.length)) * 100;
    const y = 100 - ((resumen.acumulado[iso] ?? 0) / tope) * 100;
    return `${x},${y}`;
  }).filter((_, i) => resumen.acumulado[fechas[i]] != null);

  const ultimaFechaKobo = [...fechas].reverse().find((iso) => resumen.acumulado[iso] != null);
  const ultimoPunto = ultimaFechaKobo
    ? {
      x: ((fechas.indexOf(ultimaFechaKobo) + 0.5) / Math.max(1, fechas.length)) * 100,
      y: 100 - ((resumen.acumulado[ultimaFechaKobo] ?? 0) / tope) * 100,
    }
    : null;

  if (!kobo.total && !Object.keys(hoja.totalPorFecha).length) {
    return (
      <section className="mon-ctl-panel mon-cadencia-vacio" aria-label="Ritmo">
        <span className="mon-ctl-antetitulo">Ritmo</span>
        <strong>Sin efectivas ni llamados fechados</strong>
        <p>El corte no trae efectivas de Kobo con fecha ni llamados fechados en la hoja.</p>
      </section>
    );
  }

  return (
    <div className="mon-cadencia" data-qa-geometry-group="telefonico-avance-ritmo" data-qa-geometry-contract="intrinsic">
      <div className="mon-cadencia-columna">
        <section className="mon-ctl-panel mon-cadencia-grafico" aria-label={`Efectivas de Kobo por día y ${nombreDeSegmento}`}>
          <header className="mon-cadencia-cabecera">
            <strong>Efectivas de Kobo por día{segmento ? ` y ${nombreDeSegmento}` : ""}</strong>
            <ul className="mon-cadencia-leyenda">
              {series.map((serie, i) => <li key={serie}><i className={`is-serie-${i}`} />{serie}</li>)}
              <li><i className="is-acumulado" />Acumulado</li>
            </ul>
          </header>
          <div className="mon-cadencia-lienzo" style={{ gridTemplateColumns: `repeat(${fechas.length}, minmax(0, 1fr))` }}>
            {meta ? (
              <span className="mon-cadencia-meta" style={{ bottom: `${(meta / tope) * 100}%` }}>
                <em>Meta {n(meta)}</em>
              </span>
            ) : null}
            {ultimoPunto ? (
              <span className={`mon-cadencia-acumulado-rotulo${ultimoPunto.y < 18 ? " is-debajo" : ""}`} style={{ left: `${ultimoPunto.x}%`, top: `${ultimoPunto.y}%` }}>
                {meta ? `${n(kobo.total)} de ${n(meta)}` : `${n(kobo.total)} acumuladas`}
              </span>
            ) : null}
            <svg className="mon-cadencia-acumulado" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polyline points={puntos.join(" ")} vectorEffect="non-scaling-stroke" />
            </svg>
            {fechas.map((iso) => {
              const total = kobo.porFecha[iso] ?? 0;
              return (
                <div key={iso} className="mon-cadencia-dia" title={`${fechaCorta(iso)}: ${n(total)} efectivas, ${n(resumen.acumulado[iso] ?? 0)} acumuladas`}>
                  <span className="mon-cadencia-cifra">{total ? n(total) : ""}</span>
                  <div className="mon-cadencia-pila" style={{ height: `${(total / maximoKobo) * 100}%` }}>
                    {series.map((serie, i) => {
                      const valor = valorDe(serie, iso);
                      return valor ? <i key={serie} className={`is-serie-${i}`} style={{ flexGrow: valor }} /> : null;
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mon-cadencia-eje" style={{ gridTemplateColumns: `repeat(${fechas.length}, minmax(0, 1fr))` }}>
            {fechas.map((iso) => <span key={iso}>{fechaCorta(iso)}</span>)}
          </div>
        </section>

        <section className="mon-ctl-panel mon-cadencia-grafico is-hoja" aria-label="Llamados registrados en la hoja de barrido">
          <header className="mon-cadencia-cabecera">
            <strong>Llamados registrados en la hoja de barrido</strong>
            <ul className="mon-cadencia-leyenda">
              {FAMILIAS_DE_LLAMADA.map((familia) => <li key={familia}><i className={`is-${familia}`} />{ETIQUETA_DE_FAMILIA[familia]}</li>)}
            </ul>
          </header>
          <div className="mon-cadencia-lienzo is-bajo" style={{ gridTemplateColumns: `repeat(${fechas.length}, minmax(0, 1fr))` }}>
            {fechas.map((iso) => {
              const total = hoja.totalPorFecha[iso] ?? 0;
              const familias = hoja.porFecha[iso];
              const detenida = hojaSeDetiene != null && iso > hojaSeDetiene;
              return (
                <div key={iso} className={`mon-cadencia-dia${detenida ? " is-sin-registro" : ""}`} title={`${fechaCorta(iso)}: ${n(total)} llamados en la hoja`}>
                  <span className="mon-cadencia-cifra">{n(total)}</span>
                  <div className="mon-cadencia-pila" style={{ height: `${(total / maximoHoja) * 100}%` }}>
                    {familias ? FAMILIAS_DE_LLAMADA.map((familia) => (
                      familias[familia] ? <i key={familia} className={`is-${familia}`} style={{ flexGrow: familias[familia] }} /> : null
                    )) : null}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mon-cadencia-eje" style={{ gridTemplateColumns: `repeat(${fechas.length}, minmax(0, 1fr))` }}>
            {fechas.map((iso) => <span key={iso}>{fechaCorta(iso)}</span>)}
          </div>
          {hojaSeDetiene ? (
            <p className="mon-cadencia-nota">La hoja no registra llamados después del {fechaCorta(hojaSeDetiene)}; Kobo sigue hasta el {fechaCorta(ultimoKobo ?? hojaSeDetiene)}.</p>
          ) : null}
        </section>

        <section className="mon-ctl-panel mon-cadencia-calor" aria-label={`Efectivas por ${nombreDeSegmento} y día`} data-qa-geometry-capacity="owned">
          <header className="mon-cadencia-cabecera">
            <strong>Efectivas por {nombreDeSegmento} y día</strong>
          </header>
          <div className="mon-cadencia-calor-marco">
            <table className="mon-ctl-tabla mon-cadencia-calor-tabla">
              <thead>
                <tr>
                  <th scope="col">{segmento || "Categoría"}</th>
                  {kobo.fechas.map((iso) => <th key={iso} scope="col" className="is-num">{fechaCorta(iso)}</th>)}
                  <th scope="col" className="is-num">Total</th>
                </tr>
              </thead>
              <tbody>
                {kobo.categorias.map((categoria) => (
                  <tr key={categoria.nombre}>
                    <th scope="row">{categoria.nombre}</th>
                    {kobo.fechas.map((iso) => {
                      const valor = kobo.celdas[categoria.nombre]?.[iso] ?? 0;
                      const nivel = valor ? Math.min(5, Math.ceil((valor / maximoCelda) * 5)) : 0;
                      return <td key={iso} className={`is-num mon-cadencia-celda is-nivel-${nivel}`}>{valor ? n(valor) : ""}</td>;
                    })}
                    <td className="is-num"><b>{n(categoria.total)}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="mon-cadencia-lateral">
        <section className="mon-ctl-panel mon-insumos-tarjeta" aria-label="Promedio">
          <span className="mon-ctl-antetitulo">Promedio</span>
          <p className="mon-cadencia-grande"><strong>{resumen.promedio == null ? "—" : decimal(resumen.promedio)}</strong> efectivas por día</p>
          <p>{n(kobo.total)} en {n(resumen.dias)} {resumen.dias === 1 ? "día" : "días"}{kobo.fechas.length ? ` (${fechaCorta(kobo.fechas[0])} a ${fechaCorta(ultimoKobo ?? kobo.fechas[0])})` : ""}{kobo.categorias.length > 1 ? `, en ${n(kobo.categorias.length)} ${nombreDeSegmento === "categoría" ? "categorías" : "valores"}` : ""}.</p>
          {kobo.sinFecha ? <p>{n(kobo.sinFecha)} efectivas sin fecha en Kobo no entran al gráfico.</p> : null}
          {notaDeSerie ? <p className="mon-cadencia-aviso">{notaDeSerie}.</p> : null}
        </section>

        <section className="mon-ctl-panel mon-cadencia-dia-a-dia" aria-label="Día a día" data-qa-geometry-capacity="owned">
          <header className="mon-cadencia-cabecera">
            <strong>Día a día</strong>
            <span>{meta ? (resumen.metaCruzada ? `meta ${n(meta)} cruzada el ${fechaCorta(resumen.metaCruzada)}` : `meta ${n(meta)} sin cruzar`) : "sin meta declarada"}</span>
          </header>
          <div className="mon-cadencia-dia-a-dia-marco">
            <table className="mon-ctl-tabla">
              <thead>
                <tr>
                  <th scope="col">Día</th>
                  <th scope="col" className="is-num">Kobo</th>
                  <th scope="col" className="is-num">Acumulado</th>
                  <th scope="col" className="is-num">Hoja</th>
                </tr>
              </thead>
              <tbody>
                {fechas.map((iso) => (
                  <tr key={iso} className={resumen.pico?.fecha === iso ? "is-pico" : undefined}>
                    <th scope="row">{fechaCorta(iso)}</th>
                    <td className="is-num">{n(kobo.porFecha[iso] ?? 0)}</td>
                    <td className="is-num">{resumen.acumulado[iso] != null ? n(resumen.acumulado[iso]) : "—"}</td>
                    <td className="is-num">{n(hoja.totalPorFecha[iso] ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mon-ctl-panel mon-insumos-tarjeta mon-cadencia-fechas" aria-label="Fecha de la hoja de barrido">
          <div className="mon-insumos-fila">
            <span className="mon-ctl-antetitulo">Fecha de la hoja de barrido</span>
            <span className="mon-insumos-estado">{n(fechasDeLaHoja.columnas)} {fechasDeLaHoja.columnas === 1 ? "valor" : "valores"}</span>
          </div>
          <ul>
            {fechasDeLaHoja.formatos.map((formato) => (
              <li key={formato.etiqueta} className={formato.aviso ? "is-aviso" : undefined}>
                <span>{formato.etiqueta}</span>
                <strong className="is-num">{n(formato.casos)}</strong>
              </li>
            ))}
          </ul>
          <p>
            Corresponden a {n(fechasDeLaHoja.dias)} {fechasDeLaHoja.dias === 1 ? "día" : "días"} de llamada; la hoja trae
            {" "}{n(fechasDeLaHoja.columnas)} {fechasDeLaHoja.columnas === 1 ? "valor distinto" : "valores distintos"} en su columna de fecha.
          </p>
          <span className="mon-ctl-antetitulo">Valores en la columna de fecha</span>
          <ul className="mon-cadencia-valores">
            {fechasDeLaHoja.valores.map((item) => (
              <li key={item.valor} className={item.aviso ? "is-aviso" : undefined}>
                <code>{item.valor}</code>
                <strong className="is-num">{n(item.casos)}</strong>
              </li>
            ))}
          </ul>

        </section>
      </div>
    </div>
  );
}
