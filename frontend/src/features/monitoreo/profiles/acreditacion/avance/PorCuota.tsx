import { useMemo } from "react";
import { Pencil, Target } from "lucide-react";
import type { MonitoreoCuota, MonitoreoCuotaPublico } from "../../../../../api/monitoreoCuotas";
import { useFocoMonitoreo } from "../../../useMonitoreoDireccion";
import { pctConEspacio } from "../../../core/formatoComun";
import { fmt } from "../formato";
import { AvanceCuotasDetalle } from "../AvanceCuotasDetalle";
import { resumenCuota } from "../avanceCuotasModelo";
import { clasePublico, paletaDePublicos } from "../paletaPublicos";
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
import { CabeceraDeTarjeta } from "../navegacion/rotuloDePestana";
import { AvisosDeTarjeta, PestanaSinContenido, VacioDeBloque } from "../piezas/AvisoDeTarjeta";
import { MarcaDeLectura } from "../navegacion/MarcaDeLectura";

type PropsDeVista = {
  publicos: readonly MonitoreoCuotaPublico[];
  cuotas: readonly MonitoreoCuota[];
  controles: readonly VariableDeControl[];
  foco: string | null;
  onElegir: (id: string) => void;
  onEditarEnModelo: (id: string) => void;
  onDefinirEnModelo: () => void;
  /** Avisos del estado de cuotas: van en la tarjeta de la lista, que es lo que afectan. */
  avisos?: ReadonlyArray<{ tono: "info" | "error"; texto: string }>;
  /** Mientras se leen las cuotas: el mismo marco de dos columnas, para que el selector no cambie de lugar al llegar. */
  leyendo?: boolean;
};

export function PorCuotaVista({ publicos, cuotas, controles, foco, onElegir, onEditarEnModelo, onDefinirEnModelo, avisos = [], leyendo = false }: PropsDeVista) {
  const paleta = useMemo(() => paletaDePublicos([...publicos.map((publico) => publico.actor), ...cuotas.map((cuota) => cuota.actor)]), [publicos, cuotas]);
  const cuota = cuotas.find((item) => item.id === foco) ?? null;
  const control = controles.find((item) => item.id === foco) ?? null;
  const elegidaCuota = cuota ?? (control ? null : cuotas[0] ?? null);
  const elegidoControl = control ?? (elegidaCuota ? null : controles[0] ?? null);
  const franja = elegidaCuota ? franjaDeCuota(elegidaCuota, publicos) : null;
  if (!cuotas.length && !controles.length && !leyendo) {
    return (
      <PestanaSinContenido
        titulo="Variables"
        icono={<Target size={18} />}
        motivo="El estudio no tiene cuotas ni variables de control."
        descripcion="Las cuotas se declaran en Modelo › Cuotas."
        accion={<button type="button" className="acr-av-boton" onClick={onDefinirEnModelo}>Ir a Modelo › Cuotas</button>}
      />
    );
  }
  return (
    <div className="acr-ps acr-pc" data-qa-geometry-group="acreditacion-avance-cuotas" data-qa-geometry-contract="intrinsic">
      <nav className="acr-av-panel acr-pr-filtros" aria-label="Variables">
        {/* Sin título propio: el rótulo y el selector «Cuotas | Variables de control» ya nombran la tarjeta. */}
        <CabeceraDeTarjeta primera>{null}</CabeceraDeTarjeta>
        <AvisosDeTarjeta avisos={avisos.map((aviso) => ({ kind: aviso.tono, texto: aviso.texto }))} />
        <div className="acr-pr-filtros-cuerpo" data-qa-geometry-capacity="owned">
          {leyendo && !cuotas.length && !controles.length ? <VacioDeBloque vacio="cargando" icono={<Target size={15} />} titulo="Leyendo las cuotas del estudio." /> : null}
          {cuotas.length ? (
            <section className="acr-pr-grupo">
              <h3 className="acr-av-antetitulo">Con meta <span className="acr-av-num">{fmt(cuotas.length)}</span></h3>
              <ul>
                {cuotas.map((item) => {
                  const resumen = resumenCuota(item);
                  const activa = elegidaCuota?.id === item.id;
                  return (
                    <li key={item.id}>
                      <button type="button" className={`acr-in-fuente acr-pc-fila${activa ? " is-activo" : ""}`} aria-pressed={activa} onClick={() => onElegir(item.id)}>
                        <span className="acr-in-fuente-nombre">
                          <span className={`acr-celda-publico ${clasePublico(paleta, item.actor)}`}><i className="mon-publico-punto" aria-hidden="true" />{`${item.actor}, ${item.variable}`}</span>
                          <small className="acr-av-tenue">{resumen.cumplidas}</small>
                          {/* El avance de la cuota de un vistazo, al pie de la fila (E2, 30/10). */}
                          {resumen.meta > 0 && resumen.avance != null ? (
                            <span className={`acr-av-pista acr-pc-pista ${clasePublico(paleta, item.actor)}`} aria-hidden="true"><i style={{ width: `${Math.min(100, resumen.avance * 100)}%` }} /></span>
                          ) : null}
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
        {elegidaCuota && franja ? (
          <>
            <div className="acr-av-panel acr-pc-franja" data-qa-geometry-group="acreditacion-avance-cuotas-franja" data-qa-geometry-contract="equal">
              <div className="acr-res-kpi" data-qa-geometry-member><small>Efectivas</small><b className="acr-av-num">{fmt(franja.efectivas)}</b><span className="acr-av-tenue">{elegidaCuota.universo == null ? "Sin padrón cruzado" : `de ${fmt(elegidaCuota.universo)} personas`}</span></div>
              <div className="acr-res-kpi" data-qa-geometry-member><small>Meta por categorías</small><b className="acr-av-num">{fmt(franja.metaPorCategorias)}</b><span className="acr-av-tenue">{`suma de ${fmt(elegidaCuota.categorias.length)} categorías`}</span></div>
              <div className="acr-res-kpi" data-qa-geometry-member>
                <small>Meta del público</small>
                <b className="acr-av-num">{franja.metaDelPublico == null ? "—" : fmt(franja.metaDelPublico)}</b>
                <span className="acr-av-tenue">{franja.diferencia ? `${franja.diferencia > 0 ? "+" : ""}${fmt(franja.diferencia)} por redondeo` : "Igual a la suma"}</span>
              </div>
              <div className="acr-res-kpi" data-qa-geometry-member>
                <small>Más atrasada</small>
                <b>{franja.masAtrasada ? franja.masAtrasada.categoria : "—"}</b>
                <span className="acr-av-tenue acr-av-num">{franja.masAtrasada ? pctConEspacio(franja.masAtrasada.avance * 100) : "Sin metas"}</span>
              </div>
              <button type="button" className="acr-av-boton" onClick={() => onEditarEnModelo(elegidaCuota.id)}><Pencil size={14} aria-hidden="true" /> Editar en Modelo</button>
            </div>
            <div className="acr-av-panel acr-pc-detalle-cuota" data-qa-geometry-capacity="owned">
              <AvanceCuotasDetalle key={elegidaCuota.id} cuota={elegidaCuota} paleta={paleta} />
            </div>
          </>
        ) : null}
        {elegidoControl ? <PesasDeComposicion variable={elegidoControl} onDefinirCuota={onDefinirEnModelo} /> : null}
        {leyendo && !elegidaCuota && !elegidoControl ? <div className="acr-av-panel acr-pc-detalle-cuota" data-vacio="cargando" aria-hidden="true" /> : null}
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
  if (!estado && !controles.length && error) {
    return <PestanaSinContenido vacio="error" titulo="Variables" icono={<Target size={18} />} motivo={error} />;
  }
  const avisos = [
    ...(estado?.preparando ? [{ tono: "info" as const, texto: "El motor está preparando el cruce del padrón; las cuotas aparecen al terminar." }] : []),
    ...(error ? [{ tono: "error" as const, texto: error }] : []),
  ];
  return (
    <>
    <MarcaDeLectura leyendo={!error && (!estado || estado.preparando)} />
    <PorCuotaVista
      publicos={estado?.publicos ?? []}
      cuotas={cuotas}
      controles={variables}
      foco={foco}
      avisos={avisos}
      leyendo={!estado}
      onElegir={(id) => escribirFoco(id)}
      onEditarEnModelo={(id) => escribirFoco(id, { seccion: "modelo", pestana: "cuotas", panel: null })}
      onDefinirEnModelo={() => escribirFoco(null, { seccion: "modelo", pestana: "cuotas", panel: null })}
    />
    </>
  );
}
