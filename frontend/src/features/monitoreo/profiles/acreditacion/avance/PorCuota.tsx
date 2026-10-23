import { useMemo } from "react";
import { Pencil } from "lucide-react";
import { Alert } from "../../../../../components/Alert";
import type { MonitoreoCuota, MonitoreoCuotaPublico } from "../../../../../api/monitoreoCuotas";
import { useFocoMonitoreo } from "../../../useMonitoreoDireccion";
import { pctConEspacio } from "../../../core/formatoComun";
import { fmt } from "../formato";
import { AvanceCuotasDetalle } from "../AvanceCuotasDetalle";
import { resumenCuota } from "../avanceCuotasModelo";
import { paletaDePublicos } from "../paletaPublicos";
import { useEstadoDeCuotas } from "../insumos/useEstadoDeCuotas";
import { PesasDeComposicion } from "./PesasDeComposicion";
import { franjaDeCuota, variablesDeControl, type VariableDeControl } from "./composicionModelo";
import "../paletaPublicos.css";
import "../AvanceCuotas.css";
import "./avance.css";
import "../control/casos/porResolver.css";
import "../control/casos/personas.css";
import "../modelo/modelo.css";
import "../insumos/insumos.css";

type PropsDeVista = {
  publicos: readonly MonitoreoCuotaPublico[];
  cuotas: readonly MonitoreoCuota[];
  controles: readonly VariableDeControl[];
  foco: string | null;
  onElegir: (id: string) => void;
  onEditarEnModelo: (id: string) => void;
  onDefinirEnModelo: () => void;
  avisos?: readonly string[];
};

export function PorCuotaVista({ publicos, cuotas, controles, foco, onElegir, onEditarEnModelo, onDefinirEnModelo, avisos = [] }: PropsDeVista) {
  const paleta = useMemo(() => paletaDePublicos([...publicos.map((publico) => publico.actor), ...cuotas.map((cuota) => cuota.actor)]), [publicos, cuotas]);
  const cuota = cuotas.find((item) => item.id === foco) ?? null;
  const control = controles.find((item) => item.id === foco) ?? null;
  const elegidaCuota = cuota ?? (control ? null : cuotas[0] ?? null);
  const elegidoControl = control ?? (elegidaCuota ? null : controles[0] ?? null);
  const franja = elegidaCuota ? franjaDeCuota(elegidaCuota, publicos) : null;
  if (!cuotas.length && !controles.length) {
    return (
      <div className="acr-cr is-vacio" data-vacio>
        <Alert kind="info">El estudio no tiene cuotas ni variables de control. Las cuotas se declaran en Modelo › Cuotas.</Alert>
        <button type="button" className="acr-av-boton" onClick={onDefinirEnModelo}>Ir a Modelo › Cuotas</button>
      </div>
    );
  }
  return (
    <div className="acr-ps acr-pc" data-qa-geometry-group="acreditacion-avance-cuotas" data-qa-geometry-contract="intrinsic">
      <nav className="acr-av-panel acr-pr-filtros" aria-label="Variables">
        <header className="acr-av-panel-cabecera"><h3>Variables</h3></header>
        <div className="acr-pr-filtros-cuerpo" data-qa-geometry-capacity="owned">
          {cuotas.length ? (
            <section className="acr-pr-grupo">
              <h3 className="acr-av-antetitulo">Con meta <span className="acr-av-num">{fmt(cuotas.length)}</span></h3>
              <ul>
                {cuotas.map((item) => {
                  const resumen = resumenCuota(item);
                  const activa = elegidaCuota?.id === item.id;
                  return (
                    <li key={item.id}>
                      <button type="button" className={`acr-in-fuente${activa ? " is-activo" : ""}`} aria-pressed={activa} onClick={() => onElegir(item.id)}>
                        <span className="acr-in-fuente-nombre">
                          <span>{`${item.actor}, ${item.variable}`}</span>
                          <small className="acr-av-tenue">{resumen.cumplidas}</small>
                        </span>
                        <b className="acr-av-num">{resumen.meta > 0 && resumen.avance != null ? pctConEspacio(resumen.avance * 100) : "—"}</b>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
          {controles.length ? (
            <section className="acr-pr-grupo">
              <h3 className="acr-av-antetitulo">Variables de control, sin meta <span className="acr-av-num">{fmt(controles.length)}</span></h3>
              <ul>
                {controles.map((item) => {
                  const activa = elegidoControl?.id === item.id;
                  return (
                    <li key={item.id}>
                      <button type="button" className={`acr-in-fuente${activa ? " is-activo" : ""}`} aria-pressed={activa} onClick={() => onElegir(item.id)}>
                        <span className="acr-in-fuente-nombre">
                          <span>{`${item.actor}, ${item.variable}`}</span>
                          <small className="acr-av-tenue">{`${fmt(item.filas.length)} categorías`}</small>
                        </span>
                        <b className="acr-av-num">{item.maxDelta == null ? "—" : `${item.maxDelta > 0 ? "+" : ""}${item.maxDelta.toLocaleString("es-PE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} pp`}</b>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </div>
      </nav>
      <div className="acr-pc-derecha">
        {avisos.map((aviso) => <Alert key={aviso} kind="info">{aviso}</Alert>)}
        {elegidaCuota && franja ? (
          <>
            <div className="acr-av-panel acr-pc-franja" data-qa-geometry-group="acreditacion-avance-cuotas-franja" data-qa-geometry-contract="equal">
              <div className="acr-res-kpi" data-qa-geometry-member><small>Efectivas</small><b className="acr-av-num">{fmt(franja.efectivas)}</b></div>
              <div className="acr-res-kpi" data-qa-geometry-member><small>Meta por categorías</small><b className="acr-av-num">{fmt(franja.metaPorCategorias)}</b></div>
              <div className="acr-res-kpi" data-qa-geometry-member>
                <small>Meta del público</small>
                <b className="acr-av-num">{franja.metaDelPublico == null ? "—" : fmt(franja.metaDelPublico)}</b>
                {franja.diferencia ? <span className="acr-av-tenue">{`${franja.diferencia > 0 ? "+" : ""}${fmt(franja.diferencia)} por redondeo`}</span> : null}
              </div>
              <div className="acr-res-kpi" data-qa-geometry-member>
                <small>Más atrasada</small>
                <b>{franja.masAtrasada ? franja.masAtrasada.categoria : "—"}</b>
                {franja.masAtrasada ? <span className="acr-av-tenue acr-av-num">{pctConEspacio(franja.masAtrasada.avance * 100)}</span> : null}
              </div>
              <button type="button" className="acr-av-boton" onClick={() => onEditarEnModelo(elegidaCuota.id)}><Pencil size={14} aria-hidden="true" /> Editar en Modelo</button>
            </div>
            <div className="acr-pc-detalle-cuota">
              <AvanceCuotasDetalle key={elegidaCuota.id} cuota={elegidaCuota} paleta={paleta} onEditar={onEditarEnModelo} />
            </div>
          </>
        ) : null}
        {elegidoControl ? <PesasDeComposicion variable={elegidoControl} onDefinirCuota={onDefinirEnModelo} /> : null}
      </div>
    </div>
  );
}

/**
 * Avance › Por cuota (ficha A3): si se cumple cada categoría. A la izquierda,
 * las cuotas con su avance y las variables de control sin meta con su mayor
 * diferencia; a la derecha, la cuota elegida (`foco`) con el detalle de siempre
 * o, sin meta, su composición frente al universo. Aquí no se crea ni se edita:
 * eso es Modelo › Cuotas.
 */
export function PorCuota({ controles }: { controles: ReadonlyArray<Record<string, unknown>> }) {
  const { estado, error } = useEstadoDeCuotas();
  const [foco, escribirFoco] = useFocoMonitoreo();
  const cuotas = estado?.cuotas ?? [];
  const variables = useMemo(() => variablesDeControl(controles, cuotas), [controles, cuotas]);
  if (!estado && !controles.length) {
    return <div className="acr-cr is-vacio" data-vacio>{error ? <Alert kind="error">{error}</Alert> : <Alert kind="info">Leyendo las cuotas del estudio.</Alert>}</div>;
  }
  const avisos = [
    ...(estado?.preparando ? ["El motor está preparando el cruce del padrón; las cuotas aparecen al terminar."] : []),
    ...(error ? [error] : []),
  ];
  return (
    <PorCuotaVista
      publicos={estado?.publicos ?? []}
      cuotas={cuotas}
      controles={variables}
      foco={foco}
      avisos={avisos}
      onElegir={(id) => escribirFoco(id)}
      onEditarEnModelo={(id) => escribirFoco(id, { seccion: "modelo", pestana: "cuotas", panel: null })}
      onDefinirEnModelo={() => escribirFoco(null, { seccion: "modelo", pestana: "cuotas", panel: null })}
    />
  );
}
