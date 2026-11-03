import type { ReactNode } from "react";
import { Eye, Pencil, Plus, Target } from "lucide-react";
import type { MonitoreoState } from "../../../../../api/client";
import type { MonitoreoCuota, MonitoreoCuotaPublico } from "../../../../../api/monitoreoCuotas";
import { pctConEspacio } from "../../../core/formatoComun";
import { fmt } from "../formato";
import { claveDeSeguida, useConfiguracionDeCuotas } from "../useConfiguracionDeCuotas";
import { clasePublico, paletaDePublicos } from "../paletaPublicos";
import { ColorDePublico } from "./ColorDePublico";
import "../paletaPublicos.css";
import "../avance/avance.css";
import "../control/casos/personas.css";
import "./modelo.css";
import "./cuotasLista.css";
import { CabeceraDeTarjeta } from "../navegacion/rotuloDePestana";
import { MarcaDeLectura } from "../navegacion/MarcaDeLectura";
import { AvisosDeTarjeta, PestanaSinContenido, VacioDeBloque } from "../piezas/AvisoDeTarjeta";

export type VariableSinCuota = { actor: string; variable: string; categorias: number | null };

/**
 * Una variable con tres cuartos o más de categorías que personas (código,
 * nombre, correo, teléfono) identifica a cada una: no sirve de cuota y no se ofrece.
 */
export function esIdentificador(categorias: number | null, personas: number | null) {
  return categorias != null && personas != null && personas > 0 && categorias >= personas * 0.75;
}

/** Variables elegibles de cada público que todavía no tienen cuota. */
export function variablesSinCuota(publicos: readonly MonitoreoCuotaPublico[], cuotas: readonly MonitoreoCuota[]): VariableSinCuota[] {
  const declaradas = new Set(cuotas.map((cuota) => `${cuota.actor}::${cuota.variable}`));
  return publicos.flatMap((publico) => publico.variables
    .filter((item) => !declaradas.has(`${publico.actor}::${item.variable}`) && !esIdentificador(item.categorias, publico.universo))
    .map((item) => ({ actor: publico.actor, variable: item.variable, categorias: item.categorias })));
}

type PropsDeVista = {
  publicos: readonly MonitoreoCuotaPublico[];
  cuotas: readonly MonitoreoCuota[];
  foco: string;
  onElegir: (id: string) => void;
  onEditar: (id: string) => void;
  onNueva: (actor?: string, variable?: string) => void;
  /** Avisos del estado de cuotas, dentro del marco de la cuota elegida. */
  avisos?: readonly string[];
};

export function CuotasVista({ publicos, cuotas, foco, onElegir, onEditar, onNueva, avisos = [], colorDe, seguidas }: PropsDeVista & { colorDe?: (actor: string) => ReactNode; seguidas?: ReadonlySet<string> }) {
  const elegida = cuotas.find((cuota) => cuota.id === foco) ?? cuotas[0] ?? null;
  const referencial = elegida?.caracter === "referencial";
  const totalEscrito = !elegida ? null : referencial
    ? elegida.categorias.reduce((suma, categoria) => suma + (categoria.referencia ?? 0), 0)
    : elegida.meta;
  const sinCuota = variablesSinCuota(publicos, cuotas);
  const metaDelPublico = (actor: string) => publicos.find((publico) => publico.actor === actor)?.meta ?? null;
  const paleta = paletaDePublicos(publicos.map((publico) => publico.actor));
  const actores = [...new Set([...publicos.map((publico) => publico.actor), ...cuotas.map((cuota) => cuota.actor)])];
  return (
    <div className="acr-ps is-cuotas" data-qa-geometry-group="acreditacion-modelo-cuotas" data-qa-geometry-contract="intrinsic">
      <nav className="acr-av-panel acr-pr-filtros" aria-label="Cuotas del estudio">
        <CabeceraDeTarjeta primera>
          <h3>Cuotas</h3>
          <button type="button" className="acr-av-boton" onClick={() => onNueva()}>
            <Plus size={14} aria-hidden="true" /> Nueva cuota
          </button>
        </CabeceraDeTarjeta>
        {/* Un contenedor por público (Gonzalo, 30/10: «separar cosas por comas cuando deberían ir
            en sus propios contenedores»): su color y su meta arriba, sus cuotas y, aparte, las
            variables que todavía no la tienen. */}
        <div className="acr-pr-filtros-cuerpo acr-cu-lista" data-qa-geometry-capacity="owned">
          {cuotas.length ? null : <VacioDeBloque icono={<Target size={15} />} titulo="El estudio todavía no declara cuotas." descripcion="Elige una variable sin cuota para definir la primera." />}
          {actores.map((actor) => {
            const propias = cuotas.filter((cuota) => cuota.actor === actor);
            const delPublico = sinCuota.filter((item) => item.actor === actor);
            // Las que sólo se siguen (sin metas) van aparte: ya tienen uso, no esperan cuota.
            const enSeguimiento = delPublico.filter((item) => seguidas?.has(claveDeSeguida(item.actor, item.variable)));
            const libres = delPublico.filter((item) => !enSeguimiento.includes(item));
            const meta = metaDelPublico(actor);
            return (
              <section key={actor} className={`acr-pr-grupo acr-cu-publico ${clasePublico(paleta, actor)}`} aria-label={`Cuotas de ${actor}`}>
                <header className="acr-cu-publico-cabecera">
                  <i className="mon-publico-punto" aria-hidden="true" />
                  <strong>{actor}</strong>
                  {meta == null ? null : <span className="acr-av-tenue acr-av-num">{`Meta ${fmt(meta)}`}</span>}
                </header>
                {propias.length ? (
                  <ul aria-label="Cuotas declaradas">
                    {propias.map((cuota) => (
                      <li key={cuota.id}>
                        <button type="button" className={elegida?.id === cuota.id ? "is-activo" : undefined} aria-pressed={elegida?.id === cuota.id} onClick={() => onElegir(cuota.id)}>
                          <span>{cuota.variable}</span>
                          <b className="acr-av-num">{cuota.meta == null ? "—" : fmt(cuota.meta)}</b>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : <p className="acr-cu-sin acr-av-tenue">Sin cuotas todavía.</p>}
                {enSeguimiento.length ? (
                  <>
                    <h4 className="acr-av-antetitulo acr-cu-sub">En seguimiento <span className="acr-av-num">{fmt(enSeguimiento.length)}</span></h4>
                    <ul aria-label="Variables en seguimiento">
                      {enSeguimiento.map((item) => (
                        <li key={item.variable}>
                          <button type="button" className="is-libre is-seguida" onClick={() => onNueva(item.actor, item.variable)} title="Se compara con el universo en Variables de control; clic para ponerle metas">
                            <Eye size={13} aria-hidden="true" />
                            <span>{item.variable}</span>
                            <span className="acr-av-tenue">Sin metas</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
                {libres.length ? (
                  <>
                    <h4 className="acr-av-antetitulo acr-cu-sub">Sin cuota <span className="acr-av-num">{fmt(libres.length)}</span></h4>
                    <ul aria-label="Variables sin cuota">
                      {libres.map((item) => (
                        <li key={item.variable}>
                          <button type="button" className="is-libre" onClick={() => onNueva(item.actor, item.variable)} title="Definir una cuota con esta variable">
                            <Plus size={13} aria-hidden="true" />
                            <span>{item.variable}</span>
                            <span className="acr-av-tenue acr-av-num">{item.categorias == null ? "" : `${fmt(item.categorias)} categorías`}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </section>
            );
          })}
        </div>
      </nav>
      {elegida ? (
        <section className="acr-av-panel acr-ps-tabla" aria-label={`Cuota de ${elegida.actor} por ${elegida.variable}`}>
          <header className="acr-av-panel-cabecera">
            <h3 className="acr-cu-encabezado">
              {colorDe ? colorDe(elegida.actor) : null}
              <span className="acr-cu-nombres">
                <small className="acr-av-antetitulo">{elegida.actor}</small>
                <span>{elegida.variable}</span>
              </span>
              <span className="acr-av-tenue">
                {elegida.caracter === "referencial"
                  ? "Referencial: se describe frente al universo, sin faltante"
                  : elegida.cobertura == null ? "Metas escritas a mano" : `Cobertura de ${pctConEspacio(elegida.cobertura * 100)}`}
              </span>
            </h3>
            <button type="button" className="acr-av-boton is-primario" onClick={() => onEditar(elegida.id)}>
              <Pencil size={14} aria-hidden="true" /> Editar cuota
            </button>
          </header>
          {(() => {
            const metaPublico = metaDelPublico(elegida.actor);
            const diferencia = !referencial && metaPublico != null && elegida.meta != null ? elegida.meta - metaPublico : null;
            return (
              <AvisosDeTarjeta avisos={[
                ...avisos.map((texto) => ({ texto })),
                ...(diferencia ? [{ kind: "warn" as const, texto: `Las metas por categoría suman ${fmt(elegida.meta)} y la meta del público es ${fmt(metaPublico)}: ${diferencia > 0 ? "sobran" : "faltan"} ${fmt(Math.abs(diferencia))}.` }] : []),
              ]} />
            );
          })()}
          <div className="acr-pr-cola-marco" data-qa-geometry-capacity="owned">
            <table className="acr-pub-tabla">
              <thead>
                <tr>
                  <th scope="col">Categoría</th>
                  <th scope="col" className="is-num">Personas</th>
                  <th scope="col" className="is-num">{referencial ? "Referencia" : "Meta"}</th>
                  <th scope="col">{referencial ? "Del universo" : "La meta dentro de la categoría"}</th>
                </tr>
              </thead>
              <tbody>
                {elegida.categorias.map((categoria) => {
                  // ADR 0126: en una referencial el número escrito viaja en `referencia`.
                  const numero = referencial ? categoria.referencia : categoria.meta;
                  return (
                    <tr key={categoria.categoria}>
                      <th scope="row">{categoria.categoria}</th>
                      <td className="is-num">{categoria.universo == null ? "—" : fmt(categoria.universo)}</td>
                      <td className="is-num">{numero == null ? "—" : fmt(numero)}</td>
                      <td>
                        {referencial ? (
                          // La referencia de una referencial es su peso en el universo (sin «Sin dato»).
                          <span className="acr-cu-peso">
                            <span className="acr-av-pista is-gruesa">
                              <i style={{ width: `${Math.min(100, (categoria.pct_universo ?? 0) * 100)}%` }} />
                            </span>
                            <span className="acr-av-num">{categoria.pct_universo == null ? "—" : pctConEspacio(categoria.pct_universo * 100)}</span>
                          </span>
                        ) : (
                          <span className="acr-av-pista is-gruesa">
                            <i style={{ width: `${categoria.universo && numero != null ? Math.min(100, (numero / categoria.universo) * 100) : 0}%` }} />
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Total</th>
                  <td className="is-num">{elegida.universo == null ? "—" : fmt(elegida.universo)}</td>
                  <td className="is-num">{totalEscrito == null ? "—" : fmt(totalEscrito)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      ) : (
        <section className="acr-av-panel acr-ps-tabla" aria-label="Cuota elegida">
          <header className="acr-av-panel-cabecera"><h3>Metas por categoría</h3></header>
          <AvisosDeTarjeta avisos={avisos.map((texto) => ({ texto }))} />
          <div data-qa-geometry-capacity="owned">
            <VacioDeBloque
              icono={<Target size={15} />}
              titulo={sinCuota.length ? "Todavía no hay una cuota que mostrar." : "La base de los públicos no tiene variables con 2 a 150 categorías."}
              descripcion={sinCuota.length ? "Elige una variable sin cuota a la izquierda para definir sus metas por categoría." : "Las variables salen del padrón de cada público, en Insumos › Públicos."}
            />
          </div>
        </section>
      )}
    </div>
  );
}

/**
 * Modelo › Cuotas (ficha M2): cuántas encuestas por categoría. La lista de
 * cuotas y de variables sin cuota a la izquierda; la cuota elegida con sus
 * metas a la derecha. Crear y editar abren el mismo panel de configuración de
 * siempre (`panel=cuota`, «Proponer metas» y guardar), que ahora vive aquí y no
 * en Avance.
 */
export function Cuotas({ state, onStateChange }: { state?: MonitoreoState | null; onStateChange?: (state: MonitoreoState) => void } = {}) {
  const { s, foco, irA, cargar, abrirNueva, panelNode, seguidas } = useConfiguracionDeCuotas({ state, onStateChange });
  if (!s.estado) {
    return (
      <>
        <MarcaDeLectura leyendo={!s.error} />
        <PestanaSinContenido
          vacio={s.error ? "error" : "cargando"}
          titulo="Cuotas"
          icono={<Target size={18} />}
          motivo={s.error || "Leyendo las cuotas del estudio."}
          accion={s.error ? <button type="button" className="acr-av-boton" onClick={() => { void cargar(); }}>Reintentar</button> : undefined}
        />
      </>
    );
  }
  const avisos = [
    ...(s.estado.preparando ? ["El motor está preparando el cruce del padrón; las personas por categoría aparecen al terminar."] : []),
    ...(s.aviso ? [s.aviso] : []),
  ];
  return (
    <>
      <MarcaDeLectura leyendo={s.estado.preparando} />
      <CuotasVista
        avisos={avisos}
        publicos={s.estado.publicos}
        cuotas={s.estado.cuotas}
        foco={foco}
        onElegir={(id) => irA({ panel: false, foco: id })}
        onEditar={(id) => irA({ panel: true, foco: id })}
        onNueva={abrirNueva}
        seguidas={seguidas}
        colorDe={state?.config ? (actor) => <ColorDePublico publico={actor} publicos={(s.estado?.publicos ?? []).map((publico) => publico.actor)} state={state} onStateChange={onStateChange} /> : undefined}
      />
      {panelNode}
    </>
  );
}
