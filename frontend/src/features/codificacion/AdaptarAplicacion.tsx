import { useEffect, useRef } from "react";
import { ArrowLeft, CheckCircle2, FileSpreadsheet, Play } from "lucide-react";
import { apiCodifAplicar } from "../../api/client";
import { ContenedorEntregable } from "../../components/entregables/ContenedorEntregable";
import { useSession } from "../../lib/SessionContext";
import { AplicarOmitidasAviso, irAlAviso } from "./AplicarOmitidasAviso";
import { SinRecodificarAviso } from "./SinRecodificarAviso";
import { AvisoBaseYaCodificada } from "./AvisoBaseYaCodificada";
import { AvisoFuenteAplicar } from "./AvisoFuenteAplicar";
import {
  type AplicarEntrada,
  aplicarCodificacion,
  contarAvisos,
  selectAplicarEntrada,
  useAplicarAvisosStore,
} from "./aplicarAvisosStore";
import { estadoDeAdaptacion } from "./entregas/modeloEntrega";
import { cancelarAdaptacion, seguirAdaptacion } from "./entregas/seguirAdaptacion";
import "./AdaptarAplicacion.css";
import { formatoConteo } from "../../lib/formatoNumero";

// La mitad de Adaptar que sobrevive al remontaje: el botón que lanza
// `/aplicar`, el avance del job, lo que no se aplicó, lo que se entrega sin
// recodificar y los dos archivos adaptados. Todo sale de `aplicarAvisosStore`,
// keyed por sesión y base; AdaptarPane sólo aporta el plan. El avance y los
// archivos van en el contenedor del kit de entregables (ADR 0133, fase 5), en
// bloque bajo el botón; el job lo sigue `seguirAdaptacion`, fuera de React.

type Props = {
  /** `claveAplicar(sessionId, base)`. */
  clave: string;
  /** Preguntas soportadas del plan: con 0 no hay nada que adaptar. */
  nPreguntas: number;
  onBackToCodificar: () => void;
  onBackToMatrices: () => void;
  /** ADR 0106: la base marcada «ya viene codificada»; no se ofrece aplicar. */
  yaCodificadaEn?: string | null;
  /** Preguntas que el bloque de arriba ya lista con sus acciones: no se repiten. */
  yaListadas?: readonly string[];
};

const TEXTO_APLICANDO = "Revisando el catálogo contra la base; puede tardar un par de minutos.";
const TEXTO_CORRIENDO = "La adaptación está corriendo; el avance se muestra abajo.";
export const ID_ESTADO_ADAPTAR = "codificacion-adaptar-estado";

type Enfocable = { focus: (opciones?: FocusOptions) => void };

/**
 * Pulsar «Adaptar». El botón se deshabilita en cuanto el store marca
 * `aplicando` y un control deshabilitado suelta el foco a BODY; por eso el foco
 * pasa antes a la región de estado (estable, `tabIndex=-1`), que es la que
 * cuenta qué está pasando.
 */
export function pulsarAdaptar(estado: Enfocable | null, adaptar: () => void): void {
  estado?.focus({ preventScroll: true });
  adaptar();
}

export function AdaptarAplicacion({ clave, nPreguntas, onBackToCodificar, onBackToMatrices, yaCodificadaEn = null, yaListadas = [] }: Props) {
  const { refresh } = useSession();
  const entrada = useAplicarAvisosStore(selectAplicarEntrada(clave));
  const cerrarEntrega = useAplicarAvisosStore((s) => s.cerrarEntrega);
  const marcarEnfocado = useAplicarAvisosStore((s) => s.marcarEnfocado);
  const alMontar = useAplicarAvisosStore((s) => s.alMontar);

  // El fin del job dispara `pulso:session-changed` y la página remonta este
  // panel con el scroll en 0. El primer montaje con el job terminado consume
  // el pedido de revelar del store y el aviso vuelve a la vista; los demás no.
  useEffect(() => {
    alMontar(clave);
  }, [alMontar, clave]);

  // El job se sigue una sola vez, aunque el panel se monte varias veces.
  const jobId = entrada.jobId;
  useEffect(() => {
    if (!jobId) return;
    seguirAdaptacion(clave, jobId, () => {
      void refresh();
      window.dispatchEvent(new Event("pulso:session-changed"));
    });
  }, [clave, jobId, refresh]);

  return (
    <AdaptarAplicacionVista
      entrada={entrada}
      nPreguntas={nPreguntas}
      onBackToCodificar={onBackToCodificar}
      onBackToMatrices={onBackToMatrices}
      yaCodificadaEn={yaCodificadaEn}
      yaListadas={yaListadas}
      onAdaptar={() => void aplicarCodificacion(clave, apiCodifAplicar)}
      onCancelar={jobId ? () => cancelarAdaptacion(jobId) : undefined}
      onCerrarEntrega={() => cerrarEntrega(clave)}
      onEnfocado={() => marcarEnfocado(clave)}
    />
  );
}

type VistaProps = {
  entrada: AplicarEntrada;
  nPreguntas: number;
  onBackToCodificar: () => void;
  onBackToMatrices: () => void;
  onAdaptar: () => void;
  /** Cancela el job en curso; sin job, no hay "Cancelar". */
  onCancelar?: () => void;
  onCerrarEntrega: () => void;
  onEnfocado: () => void;
  yaCodificadaEn?: string | null;
  yaListadas?: readonly string[];
};

/** Presentación pura de la entrada del store; testeable sin DOM. */
export function AdaptarAplicacionVista({
  entrada,
  nPreguntas,
  onBackToCodificar,
  onBackToMatrices,
  onAdaptar,
  onCancelar,
  onCerrarEntrega,
  onEnfocado,
  yaCodificadaEn = null,
  yaListadas = [],
}: VistaProps) {
  const { aplicando, jobId, avisos, sinRecodificar, salida, enfocarPendiente } = entrada;
  const estadoRef = useRef<HTMLSpanElement>(null);
  const entrega = estadoDeAdaptacion(
    { ...entrada, archivos: salida?.archivos ?? null },
    { cancelar: onCancelar, reintentar: nPreguntas > 0 ? () => pulsarAdaptar(estadoRef.current, onAdaptar) : undefined },
  );

  const motivoDeshabilitado = aplicando
    ? "La codificación se está aplicando."
    : jobId
    ? "La adaptación ya está corriendo."
    : nPreguntas === 0
    ? "No hay codificaciones listas para adaptar."
    : "";

  return (
    <>
      {!salida && (
        <div className="pulso-codificacion-adaptar-actions">
          <button type="button" className="pulso-cv2-pill" onClick={onBackToCodificar} style={{ fontSize: "var(--pulso-type-body-size)", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <ArrowLeft size={13} /> Volver a codificar
          </button>
          <button type="button" className="pulso-cv2-pill" onClick={onBackToMatrices} style={{ fontSize: "var(--pulso-type-body-size)", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <FileSpreadsheet size={13} /> Revisar matrices
          </button>
          <div style={{ flex: 1 }} />
          {/* Región viva siempre montada y sólo para el lector: anuncia el cambio de texto y recibe el foco al
              pulsar. En pantalla la única señal es la línea del contenedor, debajo; un texto al lado del
              botón era una segunda. */}
          <span
            ref={estadoRef}
            id={ID_ESTADO_ADAPTAR}
            className="pulso-codif-adaptar-estado pulso-sr-only"
            role="status"
            aria-live="polite"
            tabIndex={-1}
          >
            {aplicando ? TEXTO_APLICANDO : jobId ? TEXTO_CORRIENDO : ""}
          </span>
          {yaCodificadaEn && !aplicando && !jobId ? (
            <AvisoBaseYaCodificada base={yaCodificadaEn} />
          ) : (
          <button
            type="button"
            className="pulso-primary"
            onClick={() => pulsarAdaptar(estadoRef.current, onAdaptar)}
            disabled={aplicando || !!jobId || nPreguntas === 0}
            aria-busy={aplicando || undefined}
            aria-describedby={motivoDeshabilitado ? "codificacion-adaptar-disabled-reason" : undefined}
            data-testid="codificacion-adaptar-boton"
            style={{ fontSize: "var(--pulso-type-body-size)", display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Play size={14} aria-hidden="true" /> Confirmar y adaptar respuestas
          </button>
          )}
          {motivoDeshabilitado && (
            <span id="codificacion-adaptar-disabled-reason" className="pulso-sr-only">
              {motivoDeshabilitado}
            </span>
          )}
        </div>
      )}

      {/* El avance, el fallo o los dos archivos adaptados: una sola señal en
          movimiento (la línea del contenedor); el botón sólo se deshabilita. */}
      <ContenedorEntregable estado={entrega} forma="bloque" onCerrar={onCerrarEntrega} />

      {/* B1: Codificación leyó otro número de casos que el de la base. */}
      <AvisoFuenteAplicar aviso={entrada.avisoFuente} />

      {/* ADR 0100, P1: las preguntas del catálogo que no se aplicaron y los
          textos que quedaron sin código. Sin nada que decir, no pinta. */}
      <AplicarOmitidasAviso
        omitidas={avisos.omitidas.filter((o) => !yaListadas.includes(o.pregunta))}
        textosSinCodigo={avisos.textos_sin_codigo}
        incompletos={avisos.avisos_incompletos}
        enfocar={enfocarPendiente}
        onEnfocado={onEnfocado}
      />

      {/* ADR 0078, punto 5: qué se entrega sin recodificar. Aparece al aplicar
          y no antes, porque es el momento en que deja de ser reversible sin
          rehacer. Informa y no frena: bloquear acá se satisfaría desmarcando
          todo, que dejaría el módulo peor que ahora. */}
      <SinRecodificarAviso variables={sinRecodificar} />

    </>
  );
}

/**
 * Línea de arriba de Adaptar: la aplicación terminó y dejó avisos que viven al
 * pie, varias pantallas más abajo. Sin avisos o sin job terminado no pinta.
 */
export function AdaptarAplicacionResumen({ clave }: { clave: string }) {
  const entrada = useAplicarAvisosStore(selectAplicarEntrada(clave));
  return <AdaptarAplicacionResumenVista entrada={entrada} onVerAvisos={() => irAlAviso(document)} />;
}

export function AdaptarAplicacionResumenVista({
  entrada,
  onVerAvisos,
}: {
  entrada: AplicarEntrada;
  onVerAvisos: () => void;
}) {
  const n = contarAvisos(entrada.avisos) + (entrada.avisoFuente ? 1 : 0);
  if (!entrada.salida || n === 0) return null;
  return (
    <p className="pulso-codif-adaptar-resumen" data-testid="codificacion-adaptar-resumen">
      <CheckCircle2 size={14} aria-hidden="true" className="pulso-codif-adaptar-resumen-icono" />
      <span>
        La adaptación terminó con {n === 1 ? "1 aviso" : `${n} avisos`}.
      </span>
      <button type="button" className="pulso-codif-adaptar-resumen-enlace" onClick={onVerAvisos}>
        Ver {n === 1 ? "el aviso" : "los avisos"}
      </button>
    </p>
  );
}
