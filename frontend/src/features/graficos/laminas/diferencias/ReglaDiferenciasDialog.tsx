// U1 · «Ajustes del informe › Diferencias entre grupos» (`?panel=diferencias-regla`; ADR 0128 §1 y §5). Una sola regla
// para láminas, Word y tablas de cruces. Cada cambio pide la vista previa (sin guardar): cuántas celdas de las tablas
// cambian de letra y la nota que leerá el cliente. Nivel, umbral, base mínima y frágiles son opciones cerradas: no hay
// paso a paso libre. «Aplicar al informe» guarda la regla en el proyecto.

import { useEffect, useId, useState, type ReactNode } from "react";
import { AlertCircle, AlertTriangle, Scale } from "../../../../vendor/lucide-react";
import {
  getDiferenciasRegla,
  guardarDiferenciasRegla,
  previsualizarDiferenciasRegla,
  type CorreccionDiferencias,
  type FragilesDiferencias,
  type PruebaDiferencias,
  type ReglaDiferencias,
  type ReglaDiferenciasRespuesta,
  type VistaPreviaRegla,
} from "../../../../api/graficosDiferencias";
import { Dialog } from "../../../../components/Dialog";
import { Panel } from "../../../../components/Panel";
import { PulsoButton } from "../../../../components/PulsoButton";
import { PulsoSelect } from "../../../../components/PulsoSelect";
import { toast } from "../../../../components/toasterStore";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { usePanelDireccionable } from "../../../../lib/navegacion/paneles";
import { PANEL_DIFERENCIAS_REGLA } from "../../panelesGraficos";
import { RadioSegmentado } from "../../subpestanas/RadioSegmentado";
import { CajaDiferencias } from "./CajaDiferencias";
import { CodigoError } from "./CodigoError";
import { CargaDeBloque } from "../../../../components/CargaDeBloque";
import { Capsula } from "./Capsula";
import {
  mismaRegla,
  OPCIONES_FRAGILES,
  OPCIONES_TENDENCIA,
  type TendenciaDiferencias,
  opcionesAlfa,
  opcionesBaseMinima,
  opcionesUmbral,
  partirNota,
  type CargaDiferencias,
} from "./modeloDiferencias";
import { useDiferenciasUi } from "./store";
import { cargaDeError } from "./useDiferencias";
import "./diferencias.css";

// La vista previa recorre el estudio entero (20–40 s la primera vez): espera generosa y se cancela la anterior.
const ESPERA_PREVIA_MS = 900;
const SIN_ESTRATO = "__sin_estrato__";

type EstadoDialogo = {
  regla: CargaDiferencias<ReglaDiferenciasRespuesta> | null;
  previa: CargaDiferencias<VistaPreviaRegla> | null;
  guardando: boolean;
  errorGuardar: string | null;
};

const INICIAL: EstadoDialogo = { regla: null, previa: null, guardando: false, errorGuardar: null };

export function ReglaDiferenciasDialog() {
  const panel = usePanelDireccionable(PANEL_DIFERENCIAS_REGLA);
  const borrador = useDiferenciasUi((s) => s.borrador);
  const setBorrador = useDiferenciasUi((s) => s.setBorrador);
  const reglaAplicada = useDiferenciasUi((s) => s.reglaAplicada);
  const cruces = useDiferenciasUi((s) => (s.informe?.estado === "listo" ? s.informe.datos.resumen.cruces : null));
  const [estado, setEstado] = useState<EstadoDialogo>(INICIAL);
  const abierto = panel.abierto;

  // Al abrir: la regla guardada (o la propuesta) siembra el borrador. Al cerrar se descarta lo no aplicado.
  useEffect(() => {
    if (!abierto) {
      setEstado(INICIAL);
      setBorrador(null);
      return;
    }
    let vivo = true;
    setEstado((e) => ({ ...e, regla: { estado: "cargando" } }));
    getDiferenciasRegla()
      .then((r) => {
        if (!vivo) return;
        setEstado((e) => ({ ...e, regla: { estado: "listo", datos: r } }));
        setBorrador(r.regla);
      })
      .catch((err: unknown) => { if (vivo) setEstado((e) => ({ ...e, regla: cargaDeError(err) })); });
    return () => { vivo = false; };
  }, [abierto, setBorrador]);

  // Cada cambio del borrador pide la vista previa, con espera para no pedir por cada clic.
  // `huella` resume el borrador; el que se envía se lee del store al disparar, ya con el último cambio.
  const huella = borrador ? JSON.stringify(borrador) : "";
  useEffect(() => {
    if (!abierto || !huella) return;
    const control = new AbortController();
    const t = window.setTimeout(() => {
      const actual = useDiferenciasUi.getState().borrador;
      if (!actual) return;
      setEstado((e) => ({ ...e, previa: { estado: "cargando", datos: e.previa?.estado === "listo" ? e.previa.datos : undefined } }));
      previsualizarDiferenciasRegla(actual, { signal: control.signal })
        .then((p) => setEstado((e) => ({ ...e, previa: { estado: "listo", datos: p } })))
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setEstado((e) => ({ ...e, previa: cargaDeError(err) }));
        });
    }, ESPERA_PREVIA_MS);
    return () => { window.clearTimeout(t); control.abort(); };
  }, [abierto, huella]);

  const respuesta = estado.regla?.estado === "listo" ? estado.regla.datos : null;
  const previa = estado.previa;
  const cambiar = (patch: Partial<ReglaDiferencias>) => { if (borrador) setBorrador({ ...borrador, ...patch }); };
  const sinCambios = !!(respuesta && borrador && mismaRegla(respuesta.regla, borrador) && respuesta.origen === "estudio");
  const bloqueaPrevia = previa?.estado === "error";

  const aplicar = () => {
    if (!borrador) return;
    setEstado((e) => ({ ...e, guardando: true, errorGuardar: null }));
    guardarDiferenciasRegla(borrador)
      .then(() => {
        reglaAplicada();
        toast.exito("Regla de diferencias aplicada al informe", { detalle: "Láminas, Word y tablas de cruces usan la misma." });
        panel.cerrar();
      })
      .catch((err: unknown) => {
        const c = cargaDeError<never>(err);
        setEstado((e) => ({ ...e, guardando: false, errorGuardar: c.estado === "error" ? c.message || c.code : "No se pudo guardar la regla." }));
      });
  };

  const alcance = cruces !== null
    ? `Afecta a ${cruces === 1 ? "1 gráfico" : `${formatoConteo(cruces)} gráficos`} con cruce y a las tablas de cruces. Se guarda en el proyecto.`
    : "Afecta a los gráficos con cruce y a las tablas de cruces. Se guarda en el proyecto.";

  return (
    <Dialog
      panel={PANEL_DIFERENCIAS_REGLA}
      size="lg"
      title="Diferencias entre grupos"
      subtitle="Una sola regla para todo el estudio: láminas, figuras del Word y tablas de cruces dicen lo mismo."
      icon={<Scale size={16} aria-hidden="true" />}
      dismissible={!estado.guardando}
      bodyClassName="pulso-sig-regla-cuerpo"
      footerStatus={estado.errorGuardar ? <span className="pulso-sig-error-pie" role="alert"><AlertCircle size={12} aria-hidden="true" /> {estado.errorGuardar}</span> : alcance}
      footer={(
        <>
          <PulsoButton variant="secondary" onClick={panel.cerrar} disabled={estado.guardando}>Cancelar</PulsoButton>
          <PulsoButton variant="primary" onClick={aplicar} disabled={!borrador || estado.guardando || bloqueaPrevia || sinCambios}
            title={sinCambios ? "La regla guardada ya es ésta" : undefined}>
            {estado.guardando ? "Aplicando…" : "Aplicar al informe"}
          </PulsoButton>
        </>
      )}
    >
      <div
        className="pulso-sig-regla"
        data-audit-ready={estado.regla?.estado === "cargando" || (estado.regla === null && abierto) ? "false" : "graficos-diferencias-regla"}
        data-qa-surface="graficos/diferencias-regla"
        data-qa-geometry-group="graficos/diferencias-regla"
        data-qa-geometry-contract="intrinsic"
      >
        {estado.regla?.estado === "error" ? (
          <CajaDiferencias tono="peligro" role="alert" data-qa-geometry-member="">
            <strong className="pulso-sig-titulo">No se pudo leer la regla del estudio</strong>
            <p className="pulso-sig-texto">{estado.regla.message}<CodigoError code={estado.regla.code} errorId={estado.regla.error_id} /></p>
          </CajaDiferencias>
        ) : !respuesta || !borrador ? (
          <div data-qa-geometry-member=""><CargaDeBloque label="Leyendo la regla del estudio…" /></div>
        ) : (
          <FormularioRegla respuesta={respuesta} borrador={borrador} previa={previa} onCambiar={cambiar}
            onRestablecer={() => setBorrador(respuesta.propuesta)} />
        )}
      </div>
    </Dialog>
  );
}

function FormularioRegla({ respuesta, borrador, previa, onCambiar, onRestablecer }: {
  respuesta: ReglaDiferenciasRespuesta;
  borrador: ReglaDiferencias;
  previa: CargaDiferencias<VistaPreviaRegla> | null;
  onCambiar: (patch: Partial<ReglaDiferencias>) => void;
  onRestablecer: () => void;
}) {
  const { propuesta, columnas } = respuesta;
  const id = useId();
  const conglomerados = conValor(columnas.conglomerado, borrador.conglomerado);
  const estratos = conValor(columnas.estrato, borrador.estrato);
  const datosPrevia = previa && previa.estado !== "error" ? previa.datos : undefined;
  return (
    <>
      <div className="pulso-sig-regla-cabeza" data-qa-geometry-member="">
        {respuesta.origen !== "estudio" && (
          <p className="pulso-sig-texto">El estudio todavía no tiene una regla guardada: se propone la que corresponde a su diseño.</p>
        )}
        <span className="pulso-sig-espacio" />
        <PulsoButton variant="link" size="sm" onClick={onRestablecer} disabled={mismaRegla(borrador, propuesta)}>
          Restablecer a la recomendada
        </PulsoButton>
      </div>

      <AvisoCambios previa={previa} conglomerado={borrador.conglomerado} />

      <div className="pulso-sig-regla-rejilla" data-qa-geometry-member="">
        <fieldset className="pulso-sig-grupo">
          <legend className="pulso-sig-eyebrow">Prueba</legend>
          <OpcionRadio<PruebaDiferencias> nombre={`${id}-prueba`} valor="rao_scott" actual={borrador.prueba} recomendada={propuesta.prueba === "rao_scott"}
            titulo={`Rao-Scott por ${borrador.conglomerado ?? "conglomerado"}`}
            detalle="Usa el diseño: la varianza se calcula por conglomerado, dentro de cada estrato si lo hay."
            onElegir={(prueba) => onCambiar({ prueba, conglomerado: borrador.conglomerado ?? propuesta.conglomerado ?? columnas.conglomerado[0]?.valor ?? null })}>
            {borrador.prueba === "rao_scott" && (
              <div className="pulso-sig-columnas">
                <Campo rotulo="Conglomerado" id={`${id}-cong`}>
                  <PulsoSelect id={`${id}-cong`} size="sm" value={borrador.conglomerado ?? undefined} placeholder="Elige una columna"
                    options={conglomerados.map((c) => ({ value: c.valor, label: c.etiqueta }))}
                    onValueChange={(v) => onCambiar({ conglomerado: v })} />
                </Campo>
                <Campo rotulo="Estrato" id={`${id}-estr`}>
                  <PulsoSelect id={`${id}-estr`} size="sm" value={borrador.estrato ?? SIN_ESTRATO}
                    options={[{ value: SIN_ESTRATO, label: "Sin estrato" }, ...estratos.map((c) => ({ value: c.valor, label: c.etiqueta }))]}
                    onValueChange={(v) => onCambiar({ estrato: v === SIN_ESTRATO ? null : v })} />
                </Campo>
              </div>
            )}
          </OpcionRadio>
          <OpcionRadio<PruebaDiferencias> nombre={`${id}-prueba`} valor="z" actual={borrador.prueba} recomendada={propuesta.prueba === "z"}
            titulo="z de diferencia de proporciones" detalle="Supone muestreo aleatorio simple." onElegir={(prueba) => onCambiar({ prueba })} />
        </fieldset>

        <fieldset className="pulso-sig-grupo">
          <legend className="pulso-sig-eyebrow">Comparaciones múltiples</legend>
          <OpcionRadio<CorreccionDiferencias> nombre={`${id}-corr`} valor="bh_informe" actual={borrador.correccion} recomendada={propuesta.correccion === "bh_informe"}
            titulo="Benjamini-Hochberg en todo el informe"
            detalle={`Controla la proporción de falsos hallazgos entre ${(datosPrevia?.familia ?? respuesta.familia) ? `las ${formatoConteo(datosPrevia?.familia ?? respuesta.familia)}` : "todas las"} comparaciones del informe.`}
            onElegir={(correccion) => onCambiar({ correccion })} />
          <OpcionRadio<CorreccionDiferencias> nombre={`${id}-corr`} valor="bonferroni_fila" actual={borrador.correccion} recomendada={propuesta.correccion === "bonferroni_fila"}
            titulo="Bonferroni dentro de cada fila" detalle="Más estricta con muchos grupos; ignora el resto del informe."
            onElegir={(correccion) => onCambiar({ correccion })} />
        </fieldset>

        <section className="pulso-sig-grupo" aria-labelledby={`${id}-marca`}>
          <h3 id={`${id}-marca`} className="pulso-sig-eyebrow">Qué se marca</h3>
          <FilaCerrada rotulo="Significancia" valor={borrador.alfa} opciones={opcionesAlfa(borrador.alfa)} onCambiar={(alfa) => onCambiar({ alfa })} />
          <FilaCerrada rotulo="Magnitud mínima" valor={borrador.umbral_puntos} opciones={opcionesUmbral(borrador.umbral_puntos)} onCambiar={(umbral_puntos) => onCambiar({ umbral_puntos })} />
          <FilaCerrada rotulo="Base mínima por grupo" valor={borrador.base_minima} opciones={opcionesBaseMinima(borrador.base_minima)} onCambiar={(base_minima) => onCambiar({ base_minima })} />
          <div className="pulso-sig-fila">
            <span className="pulso-sig-fila-rotulo">Diferencias frágiles</span>
            <RadioSegmentado<FragilesDiferencias> etiqueta="Diferencias frágiles" valor={borrador.fragiles} opciones={OPCIONES_FRAGILES} onCambiar={(fragiles) => onCambiar({ fragiles })} />
          </div>
          <div className="pulso-sig-fila">
            <span className="pulso-sig-fila-rotulo">Tendencia por nivel</span>
            <RadioSegmentado<TendenciaDiferencias> etiqueta="Prueba de tendencia por nivel" valor={borrador.tendencia ? "si" : "no"}
              opciones={OPCIONES_TENDENCIA} onCambiar={(v) => onCambiar({ tendencia: v === "si" })} />
          </div>
        </section>

        <section className="pulso-sig-grupo" aria-labelledby={`${id}-cliente`}>
          <h3 id={`${id}-cliente`} className="pulso-sig-eyebrow">Así lo leerá el cliente</h3>
          <div className={`pulso-sig-nota${previa?.estado === "cargando" ? " is-actualizando" : ""}`} aria-live="polite">
            {datosPrevia?.nota
              ? partirNota(datosPrevia.nota).map((l, k) => (
                <p key={k} className="pulso-sig-nota-linea">
                  {l.capsula && <Capsula letras={l.capsula.letras} fragil={l.capsula.fragil} decorativa />}
                  <span>{l.texto}</span>
                </p>
              ))
              : <p className="pulso-sig-texto">{previa?.estado === "error" ? "Sin vista previa mientras la regla no pueda calcularse." : "Preparando la vista previa…"}</p>}
          </div>
          <p className="pulso-sig-texto">La lámina "Cómo leer las diferencias" se actualiza con esta regla.</p>
        </section>
      </div>
    </>
  );
}

/** El aviso de la doble vara: cuántas celdas de las tablas cambian de letra al aplicar, o por qué no se puede. */
function AvisoCambios({ previa, conglomerado }: { previa: CargaDiferencias<VistaPreviaRegla> | null; conglomerado: string | null }) {
  if (!previa) return null;
  if (previa.estado === "error") {
    const sinCong = previa.code === "E_SIG_SIN_CONGLOMERADO";
    return (
      <CajaDiferencias tono="peligro" role="alert" data-qa-geometry-member="">
        <strong className="pulso-sig-titulo"><AlertCircle size={14} aria-hidden="true" /> {sinCong ? "Falta la columna de conglomerado" : "No se pudo calcular la vista previa"}</strong>
        <p className="pulso-sig-texto">
          {sinCong ? `La base no tiene ${conglomerado ? `la columna "${conglomerado}"` : "una columna de conglomerado"}. Elige otra o usa la prueba z.` : previa.message}
          <CodigoError code={previa.code} errorId={previa.error_id} />
        </p>
      </CajaDiferencias>
    );
  }
  const datos = previa.datos;
  if (!datos) return <p className="pulso-sig-texto" role="status" data-qa-geometry-member="">Calculando cuántas celdas de las tablas cambian. Recorre todo el estudio y puede tardar un poco.</p>;
  const { cambian, total } = datos.cambios_tablas;
  if (cambian === 0) {
    return <CajaDiferencias data-qa-geometry-member=""><p className="pulso-sig-texto">Con esta regla no cambia ninguna letra de las tablas de cruces.</p></CajaDiferencias>;
  }
  return (
    <CajaDiferencias tono="aviso" role="note" data-qa-geometry-member="">
      <p className="pulso-sig-texto">
        <strong><AlertTriangle size={14} aria-hidden="true" /> Cambian las tablas de cruces.</strong>{" "}
        Con esta regla cambian de letra {formatoConteo(cambian)}{total !== null ? ` de ${formatoConteo(total)}` : ""} {cambian === 1 ? "celda" : "celdas"}.
        Al aplicar, las tablas adoptan la misma regla que las láminas.
      </p>
    </CajaDiferencias>
  );
}

function OpcionRadio<K extends string>({ nombre, valor, actual, recomendada, titulo, detalle, onElegir, children }: {
  nombre: string; valor: K; actual: K; recomendada: boolean; titulo: string; detalle: string; onElegir: (v: K) => void; children?: ReactNode;
}) {
  const elegida = valor === actual;
  return (
    <Panel className={`pulso-sig-opcion${elegida ? " is-elegida" : ""}`}>
      <label className="pulso-sig-opcion-rotulo">
        <input type="radio" name={nombre} value={valor} checked={elegida} onChange={() => onElegir(valor)} />
        <span className="pulso-sig-opcion-texto">
          <span className="pulso-sig-opcion-titulo">{titulo}{recomendada && <span className="pulso-sig-recomendada">Recomendada</span>}</span>
          <span className="pulso-sig-opcion-detalle">{detalle}</span>
        </span>
      </label>
      {children}
    </Panel>
  );
}

function FilaCerrada({ rotulo, valor, opciones, onCambiar }: {
  rotulo: string; valor: number; opciones: { valor: number; rotulo: string }[]; onCambiar: (v: number) => void;
}) {
  return (
    <div className="pulso-sig-fila">
      <span className="pulso-sig-fila-rotulo">{rotulo}</span>
      <RadioSegmentado etiqueta={rotulo} valor={String(valor)} opciones={opciones.map((o) => ({ clave: String(o.valor), rotulo: o.rotulo }))}
        onCambiar={(k) => onCambiar(Number(k))} />
    </div>
  );
}

function Campo({ rotulo, id, children }: { rotulo: string; id: string; children: ReactNode }) {
  return (
    <div className="pulso-sig-campo">
      <label className="pulso-sig-fila-rotulo" htmlFor={id}>{rotulo}</label>
      {children}
    </div>
  );
}

/** Las columnas candidatas más la elegida, si el backend no la lista (una regla migrada): se ve y se puede cambiar. */
function conValor(columnas: readonly { valor: string; etiqueta: string }[], actual: string | null) {
  return actual && !columnas.some((c) => c.valor === actual) ? [{ valor: actual, etiqueta: actual }, ...columnas] : [...columnas];
}
