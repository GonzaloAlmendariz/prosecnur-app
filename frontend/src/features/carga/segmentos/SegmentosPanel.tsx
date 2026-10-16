// Panel «Segmentos de cruce» (ADR 0107). Direccionable: `?panel=segmentos`
// muestra la tabla segmento × base; `?panel=segmentos&foco=<clave>` abre ese
// segmento en su editor. Se abre desde Equivalencias y desde el recorrido de
// la serie.
//
// Cáscara: `PanelLateralFuentes`, la misma de «Variables de la base» (un único
// dueño de scroll, `.pulso-plf-cuerpo`). Secciones, chips de estado y vacíos
// son los del Mapa de bases y la armonización.

import { useCallback, useState } from "react";
import { useInRouterContext, useLocation, useNavigate } from "react-router-dom";
import type { SegmentoADeclarar } from "../../../api/segmentos";
import { PulsoButton } from "../../../components/PulsoButton";
import { usePanelDireccionable } from "../../../lib/navegacion/paneles";
import { conNivel } from "../../../lib/navegacion/direccion";
import { useSeccion } from "../../../lib/navegacion/useDireccion";
import { ArrowLeft, Pencil, Plus, Split, Trash2 } from "../../../vendor/lucide-react";
import { PanelLateralFuentes } from "../fuentes/PanelLateralFuentes";
import { searchSinPanelYFoco } from "../fuentes/compararFuentesModel";
import { PANEL_SEGMENTOS } from "../panelesCarga";
import { useDesbordeHorizontal } from "../useDesbordeHorizontal";
import { EstadoChip } from "./EstadoChip";
import { SegmentoEditor } from "./SegmentoEditor";
import { estadoCelda, ordenarBases, readinessSegmentos, resumenSegmentos } from "./segmentosModel";
import { useSegmentos, type ControlSegmentos } from "./useSegmentos";
import "../ArmonizacionFilaEditor.css";
import "../IndicadorCompuestoEditor.css";
import "../MapaBasesPanel.css";
import "../variablesBase/variablesBase.css";
import "./segmentos.css";

// ---- Abrir --------------------------------------------------------------------

export function SegmentosBoton({ disabled }: { disabled?: boolean }) {
  const panel = usePanelDireccionable(PANEL_SEGMENTOS);
  return (
    <PulsoButton
      variant="secondary"
      className="pulso-equiv-btn"
      onClick={panel.abrir}
      disabled={disabled}
      aria-haspopup="dialog"
      data-plf-abrir="segmentos"
    >
      <Split size={14} aria-hidden="true" />
      Segmentos de cruce
    </PulsoButton>
  );
}

// ---- Panel --------------------------------------------------------------------

export type SegmentosPanelProps = {
  /** Orden de la serie que ya se ve en Equivalencias; las bases que falten van al final. */
  ordenBases?: readonly string[];
  antetitulo?: string;
};

export function SegmentosPanel(props: SegmentosPanelProps) {
  return useInRouterContext() ? <PanelConDireccion {...props} /> : null;
}

function PanelConDireccion({ ordenBases = [], antetitulo = "Carga › Equivalencias" }: SegmentosPanelProps) {
  const panel = usePanelDireccionable(PANEL_SEGMENTOS);
  const procesamiento = useSeccion("procesamiento");
  const location = useLocation();
  const navigate = useNavigate();
  const foco = panel.abierto ? procesamiento.foco?.trim() || null : null;
  const control = useSegmentos(panel.abierto);

  const irA = useCallback(
    (clave: string | null) =>
      navigate({ pathname: location.pathname, search: conNivel(location.search, "foco", clave) }, { replace: true }),
    [location.pathname, location.search, navigate],
  );
  const cerrar = useCallback(
    () => navigate({ pathname: location.pathname, search: searchSinPanelYFoco(location.search) }, { replace: true }),
    [location.pathname, location.search, navigate],
  );

  return (
    <PanelLateralFuentes
      panel={panel}
      antetitulo={antetitulo}
      titulo="Segmentos de cruce"
      descripcion="Los cruces del estudio, con el mismo nombre y la misma escala en todas las bases."
      auditReady={readinessSegmentos(control.estado.lectura)}
      claveDisparador="segmentos"
      ancho="ancho"
      onCerrar={cerrar}
    >
      <SegmentosCuerpo control={control} foco={foco} ordenBases={ordenBases} onIr={irA} />
    </PanelLateralFuentes>
  );
}

// ---- Cuerpo -------------------------------------------------------------------

export type SegmentosCuerpoProps = {
  control: ControlSegmentos;
  /** `foco` de la dirección: la clave del segmento en edición. */
  foco: string | null;
  ordenBases: readonly string[];
  onIr: (clave: string | null) => void;
};

/** Lo que va dentro del dueño de scroll. Aparte del diálogo para renderizarlo sin portal. */
export function SegmentosCuerpo({ control, foco, ordenBases, onIr }: SegmentosCuerpoProps) {
  const { estado, guardar, quitar, limpiarMensaje } = control;
  const [nuevo, setNuevo] = useState(false);
  const { lectura, catalogo, propias, ocupado, mensaje } = estado;

  if (lectura.tipo === "cargando") {
    return (
      <div className="pulso-plf-estado" role="status" data-qa-geometry-capacity="owned">
        <p>Leyendo los segmentos del estudio…</p>
      </div>
    );
  }
  if (lectura.tipo === "error") {
    // C5 categoría 3: desconexión; el mensaje del backend lo dice.
    return (
      <div className="pulso-plf-estado is-error" role="alert" data-qa-geometry-capacity="owned">
        <strong>No se pudieron leer los segmentos de cruce.</strong>
        <p>{lectura.mensaje}</p>
      </div>
    );
  }
  const datos = lectura.datos;
  if (!datos.disponible) {
    // C5 categoría 1: el estudio no tiene bases que comparar.
    return (
      <div className="pulso-plf-estado" role="status" data-qa-geometry-capacity="owned">
        <p>Este estudio no tiene bases separadas: los segmentos de cruce se declaran para comparar bases.</p>
      </div>
    );
  }

  const bases = ordenarBases(datos.bases, ordenBases);
  const enEdicion = foco ? datos.segmentos.find((s) => s.clave === foco) ?? null : null;
  const editorAbierto = nuevo || Boolean(enEdicion);
  const errorDelEditor = editorAbierto && mensaje?.tono === "error" ? mensaje.texto : "";
  const nombres = datos.segmentos.map((s) => s.nombre);

  const alGuardar = async (cuerpo: SegmentoADeclarar) => {
    const ok = await guardar(cuerpo, bases);
    if (ok) {
      setNuevo(false);
      if (foco) onIr(null);
    }
    return ok;
  };
  const cancelar = () => {
    limpiarMensaje();
    setNuevo(false);
    if (foco) onIr(null);
  };

  if (foco && !enEdicion && !nuevo) {
    return (
      <section className="pulso-armon-seccion" data-qa-geometry-capacity="owned">
        <p className="pulso-armon-vacio">El estudio no tiene un segmento «{foco}».</p>
        <div>
          <PulsoButton variant="secondary" size="sm" className="pulso-armon-btn" onClick={() => onIr(null)}>
            <ArrowLeft size={13} aria-hidden="true" />
            Ver todos los segmentos
          </PulsoButton>
        </div>
      </section>
    );
  }

  if (editorAbierto) {
    return (
      <SegmentoEditor
          key={enEdicion?.clave ?? "nuevo"}
          inicial={enEdicion}
          bases={bases}
          catalogo={catalogo}
          propias={propias}
          nombresSegmentos={nombres}
          claves={datos.segmentos.filter((s) => s.clave !== enEdicion?.clave).map((s) => s.clave)}
          guardando={ocupado === "guardar"}
          error={errorDelEditor}
          onGuardar={alGuardar}
          onCancelar={cancelar}
        />
    );
  }

  return (
    <div className="pulso-vb" data-qa-geometry-group="carga/segmentos" data-qa-geometry-contract="intrinsic">
      <TablaSegmentos
        datos={datos}
        bases={bases}
        quitando={ocupado === "quitar"}
        onNuevo={() => { limpiarMensaje(); setNuevo(true); }}
        onEditar={(clave) => { limpiarMensaje(); onIr(clave); }}
        onQuitar={(clave) => void quitar(clave, bases)}
      />
      {mensaje && (
        <p className={mensaje.tono === "error" ? "pulso-armon-error" : "pulso-vb-ok"} role={mensaje.tono === "error" ? "alert" : "status"}>
          {mensaje.texto}
        </p>
      )}
    </div>
  );
}

// ---- Tabla segmento × base -------------------------------------------------------

function TablaSegmentos({
  datos,
  bases,
  quitando,
  onNuevo,
  onEditar,
  onQuitar,
}: {
  datos: Extract<ControlSegmentos["estado"]["lectura"], { tipo: "listo" }>["datos"];
  bases: readonly string[];
  quitando: boolean;
  onNuevo: () => void;
  onEditar: (clave: string) => void;
  onQuitar: (clave: string) => void;
}) {
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [marcoRef, desborda] = useDesbordeHorizontal();
  const segmentos = datos.segmentos;
  return (
    <section className="pulso-armon-seccion" aria-labelledby="pulso-seg-lista" data-qa-geometry-member>
      <div className="pulso-armon-seccion-head">
        <div className="pulso-armon-seccion-titulo">
          <h3 id="pulso-seg-lista">
            Segmentos del estudio
            {segmentos.length > 0 && <small>{segmentos.length}</small>}
          </h3>
          <p className="pulso-armon-ayuda">{resumenSegmentos(datos)}</p>
        </div>
        <PulsoButton variant="secondary" size="sm" className="pulso-armon-btn" onClick={onNuevo}>
          <Plus size={14} aria-hidden="true" />
          Nuevo segmento
        </PulsoButton>
      </div>

      {segmentos.length === 0 ? (
        // C3: el vacío es de esta sección y dice cómo se llena.
        <p className="pulso-armon-vacio">
          Declara una vez la edad, el sexo o la facultad: cada base dice de qué variable sale y la app lo arma en todas.
        </p>
      ) : (
        <div
          ref={marcoRef}
          className={desborda ? "pulso-mapa-tabla-wrap is-desborda" : "pulso-mapa-tabla-wrap"}
          data-scroll-axis={desborda ? "x" : undefined}
          role={desborda ? "region" : undefined}
          aria-label={desborda ? "Segmentos por base, desplázate a la derecha para ver todas" : undefined}
          tabIndex={desborda ? 0 : undefined}
        >
          <table className="pulso-mapa-tabla pulso-seg-tabla" style={{ minWidth: `${240 + bases.length * 150}px` }}>
            <thead>
              <tr>
                <th scope="col">Segmento</th>
                {bases.map((b) => <th key={b} scope="col">{b}</th>)}
                <th scope="col"><span className="pulso-sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {segmentos.map((s) => (
                <tr key={s.clave}>
                  <th scope="row">
                    <span className="pulso-seg-fila-nombre">
                      <strong>{s.etiqueta}</strong>
                      <code title={s.nombre}>{s.nombre}</code>
                    </span>
                  </th>
                  {bases.map((b) => {
                    const c = estadoCelda(s.por_base[b]);
                    return (
                      <td key={b}>
                        <EstadoChip tono={c.tono} texto={c.texto} detalle={c.detalle} />
                      </td>
                    );
                  })}
                  <td className="pulso-seg-acciones">
                    {confirmando === s.clave ? (
                      <span className="pulso-vb-confirmar" role="alert">
                        <span>¿Quitar «{s.nombre}» de todas las bases y de la matriz?</span>
                        <PulsoButton
                          variant="danger"
                          size="sm"
                          disabled={quitando}
                          onClick={() => { onQuitar(s.clave); setConfirmando(null); }}
                        >
                          Quitar
                        </PulsoButton>
                        <PulsoButton variant="ghost" size="sm" onClick={() => setConfirmando(null)}>Cancelar</PulsoButton>
                      </span>
                    ) : (
                      <span className="pulso-vb-calculada-acciones">
                        <PulsoButton
                          variant="ghost"
                          size="sm"
                          className="pulso-armon-btn"
                          aria-label={`Editar ${s.nombre}`}
                          title="Editar"
                          onClick={() => onEditar(s.clave)}
                        >
                          <Pencil size={13} aria-hidden="true" />
                        </PulsoButton>
                        <PulsoButton
                          variant="ghost"
                          size="sm"
                          className="pulso-armon-btn"
                          disabled={quitando}
                          aria-label={`Quitar ${s.nombre}`}
                          title="Quitar"
                          onClick={() => setConfirmando(s.clave)}
                        >
                          <Trash2 size={13} aria-hidden="true" />
                        </PulsoButton>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
