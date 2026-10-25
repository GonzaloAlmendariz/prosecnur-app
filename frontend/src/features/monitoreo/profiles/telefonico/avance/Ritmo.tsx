import { useMemo } from "react";
import { rotuloDelSegmento } from "../segmentoDeCuotas";
import { CalendarClock } from "../../../../../vendor/lucide-react";
import { EstadoVacio } from "../../../../../components/EstadoVacio";
import type { MonitoreoAcreditacionReports, MonitoreoState } from "../../../../../api/client";
import {
  FAMILIAS_DE_LLAMADA,
  estadosDeLaHoja,
  fechaCorta,
  motivoSinSerie,
  formatosDeFecha,
  resumenDeRitmo,
  notaSinCategoria,
  serieDiariaDelCorte,
  serieHoja,
  type FamiliaDeLlamada,
} from "./ritmoModel";
import { metaDelProyecto } from "./metaDelProyecto";
import { TrazadoDeBarras } from "./TrazadoDeBarras";
import { NotaDelModo } from "../../../core/NotaDelModo";
import { RotuloDePestana, useHayRotulo } from "../navegacion/RotuloDePestana";
import "./trazadoDeBarras.css";
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

/** El rótulo de la pestaña como primera línea de una tarjeta (sólo si la página lo publica). */
function RotuloDeTarjeta() {
  const hay = useHayRotulo();
  return hay ? <header className="mon-tel-rotulo-de-tarjeta"><RotuloDePestana /></header> : null;
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
  const { segmento, serie: kobo, sinCategoria, fueraDeCuota, sinFecha } = useMemo(() => serieDiariaDelCorte(reports), [reports]);
  const notaDeSerie = notaSinCategoria(sinCategoria, rotuloDelSegmento(segmento), fueraDeCuota, sinFecha);
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
  const ultimoKobo = kobo.fechas.at(-1) ?? null;
  const hojaSeDetiene = hoja.ultima && ultimoKobo && hoja.ultima < ultimoKobo ? hoja.ultima : null;
  const maximoCelda = Math.max(1, ...kobo.categorias.flatMap((categoria) => kobo.fechas.map((iso) => kobo.celdas[categoria.nombre]?.[iso] ?? 0)));
  const rotulo = rotuloDelSegmento(segmento);
  // Un día sin efectivas de Kobo conserva el acumulado del día anterior (RMS
  // ficticio mostraba «—» el 15/10 y el 16/10 entre 1 y 36).
  const acumuladoAl = (iso: string) => {
    const previos = Object.keys(resumen.acumulado).filter((dia) => dia <= iso).sort();
    return previos.length ? resumen.acumulado[previos[previos.length - 1]] : null;
  };
  const nombreDeSegmento = rotulo ? rotulo.toLocaleLowerCase("es") : "categoría";
  if (!kobo.total && !Object.keys(hoja.totalPorFecha).length) {
    return <RitmoSinSerie reports={reports} sinFecha={sinFecha} meta={meta} />;
  }

  return (
    <div className="mon-cadencia" data-qa-geometry-group="telefonico-avance-ritmo" data-qa-geometry-contract="intrinsic">
      <div className="mon-cadencia-columna">
        <section className="mon-ctl-panel mon-cadencia-grafico" aria-label={`Efectivas de Kobo por día y ${nombreDeSegmento}`}>
          {/* §2a-bis: el rótulo de la pestaña encabeza su primera tarjeta. */}
          <RotuloDeTarjeta />
          <header className="mon-cadencia-cabecera">
            <strong>Efectivas de Kobo por día{segmento ? ` y ${nombreDeSegmento}` : ""}</strong>
          </header>
          <TrazadoDeBarras
            tituloIzquierdo="Efectivas por día"
            columnas={fechas.map((iso) => ({
              fecha: iso,
              total: kobo.porFecha[iso] ?? 0,
              titulo: `${fechaCorta(iso)}: ${n(kobo.porFecha[iso] ?? 0)} efectivas, ${n(resumen.acumulado[iso] ?? 0)} acumuladas`,
              segmentos: series.map((serie, i) => ({ clase: `is-serie-${i}`, valor: valorDe(serie, iso) })),
            }))}
            derecho={{
              titulo: "Acumulado",
              valores: fechas.map((iso) => resumen.acumulado[iso] ?? null),
              referencia: meta ? { valor: meta, rotulo: `Meta ${n(meta)}` } : null,
              rotuloFinal: meta ? `${n(kobo.total)} de ${n(meta)}` : `${n(kobo.total)} acumuladas`,
            }}
          />
          {/* Leyenda de rótulos cortos, centrada en la tarjeta. El acumulado y la
            * meta ya van rotulados en el gráfico: no se repiten aquí. */}
          {series.length > 1 ? (
            <ul className="mon-cadencia-leyenda">
              {series.map((serie, i) => <li key={serie}><i className={`is-serie-${i}`} />{serie}</li>)}
            </ul>
          ) : null}
        </section>

        <section className="mon-ctl-panel mon-cadencia-grafico is-hoja" aria-label="Llamados registrados en la hoja de barrido">
          <header className="mon-cadencia-cabecera">
            <strong>Llamados registrados en la hoja de barrido</strong>
          </header>
          <TrazadoDeBarras
            bajo
            tituloIzquierdo="Llamados por día"
            banda={hojaSeDetiene ? { desde: fechas.findIndex((iso) => iso > hojaSeDetiene), rotulo: "Sin registro en la hoja" } : null}
            columnas={fechas.map((iso) => {
              const familias = hoja.porFecha[iso];
              const total = hoja.totalPorFecha[iso] ?? 0;
              return {
                fecha: iso,
                total,
                apagada: hojaSeDetiene != null && iso > hojaSeDetiene,
                titulo: `${fechaCorta(iso)}: ${n(total)} llamados en la hoja`,
                segmentos: FAMILIAS_DE_LLAMADA.map((familia) => ({ clase: `is-${familia}`, valor: familias?.[familia] ?? 0 })),
              };
            })}
          />
          <ul className="mon-cadencia-leyenda">
            {FAMILIAS_DE_LLAMADA.map((familia) => <li key={familia}><i className={`is-${familia}`} />{ETIQUETA_DE_FAMILIA[familia]}</li>)}
          </ul>
        </section>

        <section className="mon-ctl-panel mon-cadencia-calor" aria-label={`Efectivas por ${nombreDeSegmento} y día`} data-qa-geometry-capacity="owned">
          <header className="mon-cadencia-cabecera">
            <strong>Efectivas por {nombreDeSegmento} y día</strong>
          </header>
          <div className="mon-cadencia-calor-marco">
            <table className="mon-ctl-tabla mon-cadencia-calor-tabla">
              <thead>
                <tr>
                  <th scope="col">{rotulo || "Categoría"}</th>
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
          <p
            title={[
              kobo.fechas.length ? `Del ${fechaCorta(kobo.fechas[0])} al ${fechaCorta(ultimoKobo ?? kobo.fechas[0])}` : "",
              kobo.categorias.length > 1 ? `en ${n(kobo.categorias.length)} ${nombreDeSegmento === "categoría" ? "categorías" : "valores"}` : "",
            ].filter(Boolean).join(", ") || undefined}
          >
            {n(kobo.total)} en {n(resumen.dias)} {resumen.dias === 1 ? "día" : "días"}
          </p>
          {notaDeSerie ? <NotaDelModo tono="aviso">{notaDeSerie}.</NotaDelModo> : null}
        </section>

        <section className="mon-ctl-panel mon-cadencia-dia-a-dia" aria-label="Día a día" data-qa-geometry-capacity="owned">
          <header className="mon-cadencia-cabecera">
            {/* La meta cruzada ya va en la cabecera de la pestaña; aquí no se repite. */}
            <strong>Día a día</strong>
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
                    <td className="is-num">{acumuladoAl(iso) != null ? n(acumuladoAl(iso) ?? 0) : "—"}</td>
                    {/* Sin registro de la hoja ese día, la raya (como en Calendario), no un cero. */}
                    <td className="is-num">{hoja.totalPorFecha[iso] ? n(hoja.totalPorFecha[iso]) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mon-ctl-panel mon-insumos-tarjeta mon-cadencia-fechas" aria-label="Fecha de la hoja de barrido">
          <div className="mon-insumos-fila">
            <span className="mon-ctl-antetitulo">Fecha de la hoja de barrido</span>
            <span
              className="mon-insumos-estado"
              title={`La columna de fecha trae ${n(fechasDeLaHoja.columnas)} ${fechasDeLaHoja.columnas === 1 ? "valor distinto" : "valores distintos"}, que corresponden a ${n(fechasDeLaHoja.dias)} ${fechasDeLaHoja.dias === 1 ? "día" : "días"} de llamada.`}
            >
              {n(fechasDeLaHoja.columnas)} {fechasDeLaHoja.columnas === 1 ? "valor" : "valores"}
            </span>
          </div>
          <p className="mon-cadencia-secundaria">{n(fechasDeLaHoja.dias)} {fechasDeLaHoja.dias === 1 ? "día" : "días"} de llamada</p>
          <ul className="mon-cadencia-formatos">
            {fechasDeLaHoja.formatos.map((formato) => (
              <li key={formato.etiqueta}>
                <i className={`mon-cadencia-punto${formato.aviso ? " is-aviso" : ""}`} aria-hidden="true" />
                <span>{formato.etiqueta}</span>
                <strong className="is-num">{n(formato.casos)}</strong>
              </li>
            ))}
          </ul>
          <span className="mon-ctl-antetitulo">Valores en la columna</span>
          <ul className="mon-cadencia-valores">
            {fechasDeLaHoja.valores.map((item) => (
              <li key={item.valor}>
                <i className={`mon-cadencia-punto${item.aviso ? " is-aviso" : ""}`} aria-hidden="true" />
                <span>{item.valor}</span>
                <strong className="is-num">{n(item.casos)}</strong>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

/**
 * Sin efectivas ni llamados fechados (un barrido que todavía no empieza) el
 * marco se conserva en un solo panel que dice por qué está vacío y en qué
 * estado está la hoja.
 */
function RitmoSinSerie({
  reports,
  sinFecha,
  meta,
}: {
  reports: MonitoreoAcreditacionReports;
  sinFecha: number;
  meta: number | null;
}) {
  const hoja = useMemo(() => estadosDeLaHoja(reports), [reports]);
  // Un solo panel: con dos líneas de estado, una tarjeta lateral estirada al
  // alto de la columna era un vacío dentro de una tarjeta (chequeo f).
  return (
    <section className="mon-ctl-panel mon-cadencia-vacio mon-tel-vacio" aria-label="Efectivas y llamados por día" data-qa-geometry-capacity="owned">
      <RotuloDeTarjeta />
      <div className="mon-cadencia-vacio-cuerpo">
        <EstadoVacio
          tamano="normal"
          icono={<CalendarClock size={22} />}
          titulo="Todavía no hay días que graficar"
          descripcion={motivoSinSerie(hoja, sinFecha)}
        />
        {hoja.estados.length ? (
          <ul className="mon-cadencia-formatos mon-cadencia-vacio-estados" aria-label="Estado de la hoja de barrido">
            {hoja.estados.map((item) => (
              <li key={item.estado}>
                <i className="mon-cadencia-punto" aria-hidden="true" />
                <span>{item.estado}</span>
                <strong className="is-num">{n(item.casos)}</strong>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mon-cadencia-secundaria">{meta ? `Meta del estudio: ${n(meta)} efectivas.` : "Sin meta declarada."}</p>
      </div>
    </section>
  );
}
