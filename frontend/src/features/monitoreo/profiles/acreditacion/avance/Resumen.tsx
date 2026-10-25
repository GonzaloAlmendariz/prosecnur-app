import { useMemo } from "react";
import { ArrowRight, CalendarDays } from "lucide-react";
import type { MonitoreoCorte } from "../../../corte/corteContract";
import { pctConEspacio } from "../../../core/formatoComun";
import { useFocoMonitoreo } from "../../../useMonitoreoDireccion";
import { AcreditacionEmbudoCorte } from "../AcreditacionEmbudoCorte";
import { fmt } from "../formato";
import { useResumenDelCorte } from "../navegacion/resumenDelCorte";
import { esperanPorPublico, type CasosDelCorte } from "../control/casos/tiposDeCaso";
import {
  diaDeMetaCumplida,
  proyeccion,
  rezagadosPrimero,
  serieDiaria,
  tieneMeta,
  totalesDeAvance,
  ultimosDias,
  type TotalesDeAvance,
} from "./avanceModelo";
import { BarrasPorDia, CurvaAcumulada, fechaCorta } from "./graficosDeAvance";
import { EstadoDelUniverso } from "./EstadoDelUniverso";
import type { AcreditacionAdvanceCard } from "./tarjetasDeAvance";
import "./avance.css";
import { CabeceraDeTarjeta } from "../navegacion/rotuloDePestana";
import { VacioDeBloque } from "../piezas/AvisoDeTarjeta";
import { clasePublico, paletaDePublicos, type PaletaDePublicos } from "../paletaPublicos";
import "../paletaPublicos.css";

function porcentaje(valor: number, total: number) {
  return total > 0 ? pctConEspacio((valor / total) * 100) : "—";
}

function porcentajeEntero(valor: number, total: number) {
  return total > 0 ? `${fmt(Math.round((valor / total) * 100))} %` : "—";
}

function ChipDeProyeccion({ serie, totales }: { serie: ReturnType<typeof serieDiaria>; totales: TotalesDeAvance }) {
  const lectura = proyeccion(serie, totales);
  if (lectura.tipo === "sin-meta") return <span className="acr-av-chip">Sin meta declarada</span>;
  if (lectura.tipo === "cumplida") {
    return <span className="acr-av-chip is-cumple">{lectura.fecha ? `Meta cumplida el ${fechaCorta(lectura.fecha)}` : "Meta cumplida"}</span>;
  }
  // El chip dice la cifra; el cálculo que la sostiene va en el tooltip.
  const ritmo = fmt(Math.round(lectura.ritmo));
  return (
    <span className="acr-res-chips-proyeccion">
      <span className="acr-av-chip is-falta">{`Faltan ${fmt(lectura.faltan)}`}</span>
      {lectura.dias != null ? (
        <span className="acr-av-chip" title={`Al ritmo de ${ritmo} efectivas diarias`}>{`≈ ${fmt(lectura.dias)} ${lectura.dias === 1 ? "día" : "días"}`}</span>
      ) : (
        <span className="acr-av-chip" title="Sin efectivas en los últimos siete días">Sin ritmo</span>
      )}
    </span>
  );
}

/**
 * Una tesela por público (L9): efectivas contra la meta con su marca. El color
 * del público (el mismo de Metas) va en el punto y en la barra; el estado
 * frente a la meta, en el borde lateral sólido y el chip. Debajo, solo la
 * cifra mínima («100 % de la meta»): el porcentaje del universo vive en el
 * tooltip y la serie de 14 días, en Avance › Por público. En densidad
 * compacta (más de seis públicos) la tesela es nombre, cifra y barra.
 */
function PublicoEnBarra({
  tarjeta,
  compacta,
  clase,
  onAbrir,
}: {
  tarjeta: AcreditacionAdvanceCard;
  compacta: boolean;
  clase: string;
  onAbrir: () => void;
}) {
  const conMeta = tieneMeta(tarjeta);
  const meta = tarjeta.meta ?? 0;
  const relleno = tarjeta.universe > 0 ? Math.min(100, (tarjeta.effective / tarjeta.universe) * 100) : 0;
  const marca = conMeta && tarjeta.universe > 0 ? Math.min(100, (meta / tarjeta.universe) * 100) : null;
  const faltan = Math.max(0, meta - tarjeta.effective);
  const delUniverso = `${porcentaje(tarjeta.effective, tarjeta.universe)} del universo (${fmt(tarjeta.universe)} personas)`;
  const pie = conMeta ? `${porcentajeEntero(tarjeta.effective, meta)} de la meta` : delUniverso;
  const ayuda = conMeta ? `${delUniverso}. La marca vertical es la meta.` : delUniverso;
  return (
    <li className={`acr-res-publico ${clase} ${conMeta ? (faltan > 0 ? "is-falta" : "is-cumple") : "is-sin-meta"}`} data-qa-geometry-member>
      <button type="button" className="acr-res-publico-boton" onClick={onAbrir} title={ayuda} aria-label={`Ver ${tarjeta.actor} en Por público`}>
        <span className="acr-res-publico-linea">
          <b className="acr-res-publico-nombre"><i className="mon-publico-punto" aria-hidden="true" />{tarjeta.actor}</b>
          {conMeta
            ? faltan > 0
              ? <span className="acr-av-chip is-falta">Faltan {fmt(faltan)}</span>
              : <span className="acr-av-chip is-cumple">Cumple</span>
            : <span className="acr-av-chip">Sin meta</span>}
          <span className="acr-res-publico-cifra">
            <b className="acr-av-num">{fmt(tarjeta.effective)}</b>
            <span className="acr-av-tenue">{`/ ${fmt(conMeta ? meta : tarjeta.universe)}`}</span>
          </span>
        </span>
        <span className="acr-res-publico-barra">
          <span className="acr-av-pista"><i style={{ width: `${relleno}%` }} /></span>
          {marca != null ? <span className="acr-av-marca-meta" style={{ left: `${marca}%` }} aria-hidden="true" /> : null}
        </span>
        {compacta ? null : <span className="acr-res-publico-pie acr-av-tenue">{pie}</span>}
      </button>
    </li>
  );
}

function PorResolver({ casos, porPublico, paleta }: { casos: CasosDelCorte | null; porPublico: Array<{ actor: string; esperan: number }>; paleta: PaletaDePublicos }) {
  const [, escribir] = useFocoMonitoreo();
  const abrir = () => escribir(null, { seccion: "control", pestana: "resolver", panel: null });
  const esperan = casos?.porTipo.filter((tipo) => tipo.grupo === "espera") ?? [];
  const resueltos = casos?.porTipo.filter((tipo) => tipo.grupo !== "espera") ?? [];
  return (
    <section className="acr-av-panel acr-res-resolver" aria-label="Por resolver">
      <header className="acr-av-panel-cabecera">
        <h3>Por resolver</h3>
        <button type="button" className="acr-av-boton" onClick={abrir}>
          Abrir bandeja <ArrowRight size={14} aria-hidden="true" />
        </button>
      </header>
      {casos ? (
        <div className="acr-res-resolver-cuerpo">
          <p className="acr-res-resolver-total">
            <b className="acr-av-num">{fmt(casos.esperan)}</b>
            <span>{casos.esperan === 1 ? "espera tu decisión" : "esperan tu decisión"}</span>
          </p>
          {esperan.length ? (
            <ul className="acr-res-resolver-lista">
              {esperan.map((tipo) => (
                <li key={tipo.tipo}>
                  <button type="button" onClick={abrir}>
                    <span className="acr-res-punto" aria-hidden="true" />
                    <span>{tipo.etiqueta}</span>
                    <b className="acr-av-num">{fmt(tipo.casos)}</b>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {porPublico.length ? (
            <div className="acr-res-resueltos">
              <span className="acr-av-antetitulo">Esperan decisión por público</span>
              <ul className="acr-res-chips is-publicos">
                {porPublico.map((item) => (
                  <li key={item.actor} className={clasePublico(paleta, item.actor)}>
                    <button type="button" className="acr-av-chip acr-res-chip-publico" onClick={abrir} aria-label={`${item.actor}: ${fmt(item.esperan)} esperan decisión`}>
                      <i className="mon-publico-punto" aria-hidden="true" />
                      {item.actor}
                      <b className="acr-av-num">{fmt(item.esperan)}</b>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {resueltos.length ? (
            <div className="acr-res-resueltos">
              <span className="acr-av-antetitulo">Ya resueltos</span>
              <div className="acr-res-chips">
                {resueltos.map((tipo) => (
                  <span key={tipo.tipo} className="acr-av-chip">{tipo.etiqueta} {fmt(tipo.casos)}</span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <VacioDeBloque vacio="cargando" icono={null} titulo="Los casos se están preparando con el cruce del padrón." descripcion="Aparecen aquí al terminar." />
      )}
    </section>
  );
}

/**
 * Avance › Resumen (ficha A1): ¿llegamos a la meta? Efectivas acumuladas con
 * la meta y el día en que se cumplió, el universo por estado, los últimos 14
 * días, cada público con su meta (rezagados primero), lo que espera decisión
 * y el embudo del corte, que vivía en la franja de lectura retirada.
 */
type PropsDelResumen = {
  tarjetas: readonly AcreditacionAdvanceCard[];
  diarioGeneral: ReadonlyArray<Record<string, unknown>>;
  diarioPorPublico: ReadonlyArray<Record<string, unknown>>;
  corte: MonitoreoCorte;
};

/** Lee del corte observado los casos por resolver, que llegan con Control. */
export function Resumen(props: PropsDelResumen) {
  const casos = useResumenDelCorte((estado) => estado.casos);
  const issues = useResumenDelCorte((estado) => estado.issues);
  return <ResumenVista {...props} casos={casos} casosPorPublico={issues ? esperanPorPublico(issues) : []} />;
}

export function ResumenVista({
  tarjetas,
  diarioGeneral,
  corte,
  casos,
  casosPorPublico = [],
}: PropsDelResumen & { casos: CasosDelCorte | null; casosPorPublico?: Array<{ actor: string; esperan: number }> }) {
  const [, escribir] = useFocoMonitoreo();
  const totales = useMemo(() => totalesDeAvance(tarjetas), [tarjetas]);
  const serie = useMemo(() => serieDiaria(diarioGeneral), [diarioGeneral]);
  const ultimos = useMemo(() => ultimosDias(serie), [serie]);
  const ordenadas = useMemo(() => rezagadosPrimero(tarjetas), [tarjetas]);
  const paleta = useMemo(() => paletaDePublicos(tarjetas.map((tarjeta) => tarjeta.actor)), [tarjetas]);
  // Densidad declarable (Meta B, L29): cómoda con pocos públicos, compacta con muchos.
  const compacta = tarjetas.length > 6;
  const avance = totales.meta > 0 ? totales.efectivas / totales.meta : null;

  return (
    <div className="acr-res" data-density={compacta ? "compacta" : "comoda"} data-qa-geometry-group="acreditacion-avance-resumen" data-qa-geometry-contract="intrinsic">
      <div className="acr-res-izquierda">
        <section className="acr-av-panel acr-res-principal" aria-label="Efectivas acumuladas">
          <CabeceraDeTarjeta primera>
            <h3>Efectivas acumuladas</h3>
            <ChipDeProyeccion serie={serie} totales={totales} />
          </CabeceraDeTarjeta>
          <div className="acr-res-kpis" data-qa-geometry-group="acreditacion-resumen-cifras" data-qa-geometry-contract="equal">
            <div className="acr-res-kpi-principal">
              <span className="acr-av-antetitulo">Efectivas</span>
              <span className="acr-res-kpi-linea">
                <b className="acr-res-kpi-grande acr-av-num">{fmt(totales.efectivas)}</b>
                {totales.meta > 0 ? <span className="acr-res-kpi-meta">de {fmt(totales.meta)} meta</span> : null}
                {avance != null ? <span className={`acr-av-chip ${avance >= 1 ? "is-cumple" : "is-avance"}`}>{pctConEspacio(avance * 100)}</span> : null}
              </span>
              <span className="acr-av-pista is-gruesa"><i style={{ width: `${Math.min(100, (avance ?? 0) * 100)}%` }} /></span>
            </div>
            <div className="acr-res-kpi" data-qa-geometry-member>
              <small>Del universo</small>
              <b className="acr-av-num">{porcentaje(totales.efectivas, totales.universo)}</b>
              <small>{fmt(totales.efectivas)} de {fmt(totales.universo)}</small>
            </div>
            <div className="acr-res-kpi" data-qa-geometry-member>
              <small>Parciales</small>
              <b className="acr-av-num">{fmt(totales.parciales)}</b>
              <small>no cuentan</small>
            </div>
            <div className="acr-res-kpi" data-qa-geometry-member>
              <small>Rechazos</small>
              <b className="acr-av-num">{fmt(totales.rechazos)}</b>
              <small>sin consentimiento</small>
            </div>
            <div className="acr-res-kpi" data-qa-geometry-member>
              <small>Sin respuesta</small>
              <b className="acr-av-num">{fmt(totales.sinRespuesta)}</b>
              <small>en el universo</small>
            </div>
          </div>
          <div className="acr-res-embudo" aria-label="Del registro a la efectiva">
            <AcreditacionEmbudoCorte corte={corte} />
          </div>
          <div className="acr-res-curva" data-qa-geometry-capacity="owned">
            {serie.length ? (
              <CurvaAcumulada serie={serie} meta={totales.meta} diaDeMeta={diaDeMetaCumplida(serie, totales.meta)} />
            ) : (
              <VacioDeBloque icono={<CalendarDays size={15} />} titulo="El corte todavía no trae efectivas con fecha." descripcion="La curva aparece cuando las encuestas devuelven respuestas completas." />
            )}
          </div>
        </section>
        <div className="acr-res-fila" data-qa-geometry-group="acreditacion-resumen-pie" data-qa-geometry-contract="equal">
          <section className="acr-av-panel" aria-label="Universo por estado" data-qa-geometry-member>
            <header className="acr-av-panel-cabecera">
              <h3>Universo por estado</h3>
              <span className="acr-av-tenue">{fmt(totales.universo)} personas</span>
            </header>
            <EstadoDelUniverso totales={totales} />
          </section>
          <section className="acr-av-panel" aria-label="Últimos 14 días" data-qa-geometry-member>
            <header className="acr-av-panel-cabecera"><h3>Últimos 14 días</h3></header>
            <div className="acr-res-ultimos">
              <BarrasPorDia dias={ultimos.dias} etiqueta="Efectivas por día en los últimos 14 días del corte" />
              <div className="acr-res-ultimos-cifras">
                <div className="acr-res-kpi"><small>Promedio de 7 días</small><b className="acr-av-num">{ultimos.promedio7.toLocaleString("es-PE", { maximumFractionDigits: 1 })}</b></div>
                <div className="acr-res-kpi"><small>Mejor día</small><b className="acr-av-num">{ultimos.mejor ? fmt(ultimos.mejor.efectivas) : "—"} <span className="acr-av-tenue">{ultimos.mejor ? fechaCorta(ultimos.mejor.fecha) : ""}</span></b></div>
                <div className="acr-res-kpi"><small>Días sin efectivas</small><b className="acr-av-num">{fmt(ultimos.sinEfectivas)}</b></div>
              </div>
            </div>
          </section>
        </div>
      </div>
      <div className="acr-res-derecha">
        <section className="acr-av-panel acr-res-publicos" aria-label="Por público">
          <header className="acr-av-panel-cabecera">
            <h3 title="Rezagados primero. La marca vertical de cada barra es la meta.">Por público</h3>
          </header>
          <ul className="acr-res-publicos-lista" data-qa-geometry-group="acreditacion-resumen-publicos" data-qa-geometry-contract="intrinsic" data-qa-geometry-capacity="owned">
            {ordenadas.map((tarjeta) => (
              <PublicoEnBarra
                key={tarjeta.id}
                tarjeta={tarjeta}
                compacta={compacta}
                clase={clasePublico(paleta, tarjeta.actor)}
                onAbrir={() => escribir(tarjeta.actor, { seccion: "avance", pestana: "publicos", panel: "publico" })}
              />
            ))}
          </ul>
        </section>
        <PorResolver casos={casos} porPublico={casosPorPublico} paleta={paleta} />
      </div>
    </div>
  );
}
