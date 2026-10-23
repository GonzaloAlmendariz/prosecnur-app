import { Pencil, Plus } from "lucide-react";
import { Alert } from "../../../../../components/Alert";
import type { MonitoreoCuota, MonitoreoCuotaPublico } from "../../../../../api/monitoreoCuotas";
import { pctConEspacio } from "../../../core/formatoComun";
import { fmt } from "../formato";
import { useConfiguracionDeCuotas } from "../useConfiguracionDeCuotas";
import "../avance/avance.css";
import "../control/casos/personas.css";
import "./modelo.css";

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

export function CuotasVista({ publicos, cuotas, foco, onElegir, onEditar, onNueva, avisos = [] }: PropsDeVista) {
  const elegida = cuotas.find((cuota) => cuota.id === foco) ?? cuotas[0] ?? null;
  const sinCuota = variablesSinCuota(publicos, cuotas);
  const metaDelPublico = (actor: string) => publicos.find((publico) => publico.actor === actor)?.meta ?? null;
  return (
    <div className="acr-ps is-cuotas" data-qa-geometry-group="acreditacion-modelo-cuotas" data-qa-geometry-contract="intrinsic">
      <nav className="acr-av-panel acr-pr-filtros" aria-label="Cuotas del estudio">
        <header className="acr-av-panel-cabecera">
          <h3>Cuotas</h3>
          <button type="button" className="acr-av-boton" onClick={() => onNueva()}>
            <Plus size={14} aria-hidden="true" /> Nueva cuota
          </button>
        </header>
        <div className="acr-pr-filtros-cuerpo" data-qa-geometry-capacity="owned">
          <section className="acr-pr-grupo">
            <h3 className="acr-av-antetitulo">Declaradas <span className="acr-av-num">{fmt(cuotas.length)}</span></h3>
            {cuotas.length ? (
              <ul>
                {cuotas.map((cuota) => (
                  <li key={cuota.id}>
                    <button type="button" className={elegida?.id === cuota.id ? "is-activo" : undefined} aria-pressed={elegida?.id === cuota.id} onClick={() => onElegir(cuota.id)}>
                      <span>{`${cuota.actor}, ${cuota.variable}`}</span>
                      <b className="acr-av-num">{cuota.meta == null ? "—" : fmt(cuota.meta)}</b>
                    </button>
                  </li>
                ))}
              </ul>
            ) : <Alert kind="info">El estudio todavía no declara cuotas.</Alert>}
          </section>
          <section className="acr-pr-grupo">
            <h3 className="acr-av-antetitulo">Variables sin cuota <span className="acr-av-num">{fmt(sinCuota.length)}</span></h3>
            <ul>
              {sinCuota.map((item) => (
                <li key={`${item.actor}::${item.variable}`}>
                  <button type="button" onClick={() => onNueva(item.actor, item.variable)} title="Definir una cuota con esta variable">
                    <span>{`${item.actor}, ${item.variable}`}</span>
                    <span className="acr-av-tenue acr-av-num">{item.categorias == null ? "" : `${fmt(item.categorias)} categorías`}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </nav>
      {elegida ? (
        <section className="acr-av-panel acr-ps-tabla" aria-label={`Cuota de ${elegida.actor} por ${elegida.variable}`}>
          <header className="acr-av-panel-cabecera">
            <h3>
              {`${elegida.actor}, ${elegida.variable}`}
              <span className="acr-av-tenue">
                {elegida.cobertura == null ? "Metas escritas a mano" : `Cobertura de ${pctConEspacio(elegida.cobertura * 100)}`}
              </span>
            </h3>
            <button type="button" className="acr-av-boton is-primario" onClick={() => onEditar(elegida.id)}>
              <Pencil size={14} aria-hidden="true" /> Editar cuota
            </button>
          </header>
          {avisos.length ? <div className="acr-ct-cuerpo">{avisos.map((aviso) => <Alert key={aviso} kind="info">{aviso}</Alert>)}</div> : null}
          {(() => {
            const metaPublico = metaDelPublico(elegida.actor);
            const diferencia = metaPublico != null && elegida.meta != null ? elegida.meta - metaPublico : null;
            return diferencia ? (
              <div className="acr-ct-cuerpo">
                <Alert kind="warn">{`Las metas por categoría suman ${fmt(elegida.meta)} y la meta del público es ${fmt(metaPublico)}: ${diferencia > 0 ? "sobran" : "faltan"} ${fmt(Math.abs(diferencia))}.`}</Alert>
              </div>
            ) : null;
          })()}
          <div className="acr-pr-cola-marco" data-qa-geometry-capacity="owned">
            <table className="acr-pub-tabla">
              <thead>
                <tr>
                  <th scope="col">Categoría</th>
                  <th scope="col" className="is-num">Personas</th>
                  <th scope="col" className="is-num">Meta</th>
                  <th scope="col">La meta dentro de la categoría</th>
                </tr>
              </thead>
              <tbody>
                {elegida.categorias.map((categoria) => (
                  <tr key={categoria.categoria}>
                    <th scope="row">{categoria.categoria}</th>
                    <td className="is-num">{categoria.universo == null ? "—" : fmt(categoria.universo)}</td>
                    <td className="is-num">{categoria.meta == null ? "—" : fmt(categoria.meta)}</td>
                    <td>
                      <span className="acr-av-pista is-gruesa">
                        <i style={{ width: `${categoria.universo && categoria.meta != null ? Math.min(100, (categoria.meta / categoria.universo) * 100) : 0}%` }} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Total</th>
                  <td className="is-num">{elegida.universo == null ? "—" : fmt(elegida.universo)}</td>
                  <td className="is-num">{elegida.meta == null ? "—" : fmt(elegida.meta)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      ) : (
        <section className="acr-av-panel acr-ps-tabla" aria-label="Cuota elegida">
          <div className="acr-pr-cola-vacia" data-vacio data-qa-geometry-capacity="owned">
            <Alert kind="info">{sinCuota.length ? "Elige una variable sin cuota para definir sus metas por categoría." : "La base de los públicos no tiene variables con 2 a 150 categorías."}</Alert>
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
export function Cuotas() {
  const { s, foco, irA, cargar, abrirNueva, panelNode } = useConfiguracionDeCuotas();
  if (!s.estado) {
    return (
      <div className="acr-cr is-vacio" data-vacio>
        {s.error
          ? <Alert kind="error">{s.error}</Alert>
          : <Alert kind="info">Leyendo las cuotas del estudio.</Alert>}
        {s.error ? <button type="button" className="acr-av-boton" onClick={() => { void cargar(); }}>Reintentar</button> : null}
      </div>
    );
  }
  const avisos = [
    ...(s.estado.preparando ? ["El motor está preparando el cruce del padrón; las personas por categoría aparecen al terminar."] : []),
    ...(s.aviso ? [s.aviso] : []),
  ];
  return (
    <>
      <CuotasVista
        avisos={avisos}
        publicos={s.estado.publicos}
        cuotas={s.estado.cuotas}
        foco={foco}
        onElegir={(id) => irA({ panel: false, foco: id })}
        onEditar={(id) => irA({ panel: true, foco: id })}
        onNueva={abrirNueva}
      />
      {panelNode}
    </>
  );
}
