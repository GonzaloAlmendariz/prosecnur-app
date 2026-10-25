import { memo, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PlugZap } from "lucide-react";
import type { MonitoreoState, MonitoreoTerritorialDashboard, MonitoreoTerritorialPhase } from "../../../../../api/client";
import { construirConexiones, type TarjetaDeFuente } from "./conexionesModel";
import { RotuloDePestana } from "../navegacion/RotuloDePestana";
import "./insumos.css";

/**
 * Insumos › Conexiones (territorial.md §3.1): una tarjeta por fuente con su
 * estado, lo que trajo y sus lecturas, y al costado la muestra que llega de
 * Hojas de ruta. «Traer nuevas» y «Traer todo de nuevo» son las del modo;
 * releer la ficha, cambiar o conectar un formulario siguen en «Administrar
 * fuentes» (`panel=consola`).
 */
function ConexionesTabImpl({
  reports,
  avance = null,
  consultas = null,
  state,
  phase,
  ocupado,
  onTraerNuevas,
  onTraerTodo,
  onAdministrar,
}: {
  reports: MonitoreoTerritorialDashboard | null;
  avance?: MonitoreoTerritorialDashboard | null;
  consultas?: MonitoreoTerritorialDashboard | null;
  state: MonitoreoState | null;
  phase: MonitoreoTerritorialPhase;
  ocupado: boolean;
  onTraerNuevas?: () => void;
  onTraerTodo?: () => void;
  onAdministrar: () => void;
}) {
  const modelo = useMemo(() => construirConexiones(state, reports, phase, { avance, consultas }), [avance, consultas, phase, reports, state]);
  const navigate = useNavigate();

  if (!modelo.conFuenteDeCampo) {
    return (
      <section className="mon-ins mon-ins--vacio" data-audit-ready="vacio:sin-fuente" aria-label="Conexiones">
        <div className="mon-ins-panel mon-ins-vacio">
          <RotuloDePestana />
          <PlugZap size={20} aria-hidden="true" />
          <strong>Sin formulario de Kobo para la fase Campo</strong>
          <span>Conecta el formulario de Kobo de la fase para leer sus respuestas.</span>
          <button type="button" className="mon-ins-boton is-primario" onClick={onAdministrar}>Conectar Kobo</button>
        </div>
      </section>
    );
  }

  return (
    <section
      className="mon-ins mon-ins-conexiones"
      aria-label="Conexiones"
      data-audit-ready="monitoreo-territorial-insumos-conexiones"
      data-qa-geometry-group="territorial-insumos-conexiones"
      data-qa-geometry-contract="intrinsic"
    >
      <ul className="mon-ins-fuentes" data-qa-geometry-member="fuentes">
        {modelo.tarjetas.map((tarjeta, indice) => (
          <li key={tarjeta.clave}>
            <Fuente
              tarjeta={tarjeta}
              conRotulo={indice === 0}
              ocupado={ocupado}
              onTraerNuevas={tarjeta.activa ? onTraerNuevas : undefined}
              onTraerTodo={tarjeta.activa ? onTraerTodo : undefined}
              onAdministrar={onAdministrar}
            />
          </li>
        ))}
      </ul>
      <aside className="mon-ins-panel mon-ins-lateral" aria-labelledby="mon-ins-muestra" data-qa-geometry-member="muestra">
        <h3 id="mon-ins-muestra" className="mon-ins-titulo" title="Viene de Hojas de ruta">Muestra de campo</h3>
        <dl className="mon-ins-cifras">
          {modelo.muestra.map((cifra) => <div key={cifra.rotulo}><dt>{cifra.rotulo}</dt><dd>{cifra.valor}</dd></div>)}
        </dl>
        {modelo.ventanas.length ? (
          <ul className="mon-ins-lista">
            {modelo.ventanas.map((ventana) => <li key={ventana.fase}>{ventana.fase} desde {ventana.desde}</li>)}
          </ul>
        ) : null}
        <button type="button" className="mon-ins-boton" onClick={() => navigate("/hojas-ruta?seccion=muestra")}>Abrir Hojas de ruta</button>
      </aside>
    </section>
  );
}

function Fuente({
  tarjeta,
  conRotulo = false,
  ocupado,
  onTraerNuevas,
  onTraerTodo,
  onAdministrar,
}: {
  tarjeta: TarjetaDeFuente;
  conRotulo?: boolean;
  ocupado: boolean;
  onTraerNuevas?: () => void;
  onTraerTodo?: () => void;
  onAdministrar: () => void;
}) {
  const maximo = Math.max(1, ...tarjeta.serie);
  return (
    <article className={`mon-ins-panel mon-ins-fuente is-${tarjeta.tono}${tarjeta.activa ? " is-activa" : ""}`} aria-labelledby={`mon-ins-fuente-${tarjeta.clave}`}>
      <header className="mon-ins-fuente-cabecera">
        {conRotulo ? <RotuloDePestana /> : null}
        <div>
          <h3 id={`mon-ins-fuente-${tarjeta.clave}`}>{tarjeta.titulo}</h3>
          <span className="mon-ins-base">{tarjeta.formulario}</span>
        </div>
        <span className={`mon-ins-estado is-${tarjeta.tono}`}>{tarjeta.estado}</span>
      </header>
      <dl className="mon-ins-cifras is-fila">
        {tarjeta.cifras.map((cifra) => <div key={cifra.rotulo}><dt>{cifra.rotulo}</dt><dd>{cifra.valor}</dd></div>)}
      </dl>
      {tarjeta.serie.length > 1 ? (
        <figure className="mon-ins-serie">
          <svg viewBox={`0 0 ${tarjeta.serie.length * 10} 40`} preserveAspectRatio="none" role="img" aria-label={`Respuestas en cada lectura: de ${tarjeta.serie[0].toLocaleString("es-PE")} a ${tarjeta.serie.at(-1)?.toLocaleString("es-PE")} en ${tarjeta.serie.length} lecturas`}>
            {tarjeta.serie.map((valor, indice) => (
              <rect key={indice} x={indice * 10 + 1} width={8} y={40 - (valor / maximo) * 40} height={(valor / maximo) * 40} />
            ))}
          </svg>
          <figcaption className="mon-ins-base">Respuestas en cada una de las {tarjeta.serie.length} lecturas</figcaption>
        </figure>
      ) : null}
      <footer className="mon-ins-acciones">
        {onTraerNuevas ? <button type="button" className="mon-ins-boton is-primario" disabled={ocupado} onClick={onTraerNuevas}>Traer nuevas</button> : null}
        {onTraerTodo ? <button type="button" className="mon-ins-boton" disabled={ocupado} onClick={onTraerTodo}>Traer todo de nuevo</button> : null}
        {tarjeta.fase ? <button type="button" className="mon-ins-boton" onClick={onAdministrar}>Releer ficha o cambiar formulario…</button> : null}
      </footer>
    </article>
  );
}

export const ConexionesTab = memo(ConexionesTabImpl);
