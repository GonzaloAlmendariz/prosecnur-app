import { useEffect, useState, type ReactNode } from "react";
import { apiCodifAplicar } from "../../api/dashboard";
import { ContenedorEntregable } from "../../components/entregables/ContenedorEntregable";
import { PieConEfecto } from "../../components/procesamiento/PieConEfecto";
import { PulsoButton } from "../../components/PulsoButton";
import { useSession } from "../../lib/SessionContext";
import { ArrowLeft, CheckCircle2, Play } from "../../vendor/lucide-react";
import { efectoDeAplicar } from "./aplicar/modeloAplicar";
import { AplicarOmitidasAviso, irAlAviso } from "./AplicarOmitidasAviso";
import { SinRecodificarAviso } from "./SinRecodificarAviso";
import { AvisoBaseYaCodificada } from "./AvisoBaseYaCodificada";
import { ArchivosDeCodificacion } from "./aplicar/ArchivosDeCodificacion";
import { AvisoFuenteAplicar } from "./AvisoFuenteAplicar";
import {
  type AplicarEntrada,
  aplicarCodificacion,
  contarAvisos,
  selectAplicarEntrada,
  useAplicarAvisosStore,
} from "./aplicarAvisosStore";
import { estadoDeAdaptacion, rotulosDeArchivos, TITULO_ARCHIVOS } from "./entregas/modeloEntrega";
import { cancelarAdaptacion, seguirAdaptacion } from "./entregas/seguirAdaptacion";
import "./aplicar/aplicar.css";
import "./AdaptarAplicacion.css";

// El interior del panel de preguntas de Aplicar, que sobrevive al remontaje:
// el cuerpo (lo que le pasa AdaptarPane y, debajo, el avance del job, los dos
// archivos codificados, lo que no se aplicó y lo que se entrega sin recodificar)
// y el pie con el efecto y el botón que lanza `/aplicar`. El cuerpo es el dueño
// del scroll del panel; el pie queda siempre a la vista. Todo sale de
// `aplicarAvisosStore`, keyed por sesión y base; AdaptarPane sólo aporta el
// plan. El avance y los archivos van en el contenedor del kit de entregables
// (ADR 0133, fase 5), en bloque y dentro del mismo panel; el job lo sigue
// `seguirAdaptacion`, fuera de React.

type Props = {
  /** `claveAplicar(sessionId, base)`. */
  clave: string;
  /** Preguntas aplicables del plan: con 0 no hay nada que aplicar. */
  nPreguntas: number;
  onBackToCodificar: () => void;
  /** Retirado con la pestaña Matrices (ADR 0144); se acepta y no se usa. */
  onBackToMatrices?: () => void;
  /** La base activa: los archivos para entregar se generan con ella. */
  base?: string | null;
  /** ADR 0106: la base marcada "ya viene codificada"; no se ofrece aplicar. */
  yaCodificadaEn?: string | null;
  /** Preguntas que el bloque de arriba ya lista con sus acciones: no se repiten. */
  yaListadas?: readonly string[];
  /** Lo que va en el cuerpo del panel antes del resultado: la lista y las preguntas que no se pueden aplicar. */
  children?: ReactNode;
  /** La acción principal va en la cabecera de la pestaña (`BotonAplicar`): el pie no la repite. */
  botonEnCabecera?: boolean;
  /** Cuántas veces se pulsó el botón de la cabecera: cada pulsación lleva el foco al avance. */
  pedidoExterno?: number;
};

const TEXTO_APLICANDO = "Revisando la codificación contra la base; puede tardar un par de minutos.";
const TEXTO_CORRIENDO = "La codificación se está aplicando a la base; el avance se muestra bajo la lista de preguntas.";
export const ID_ESTADO_ADAPTAR = "codificacion-adaptar-estado";

/**
 * Pulsar "Aplicar a la base" (o "Reintentar" en el contenedor). El botón se deshabilita en cuanto el store marca
 * `aplicando`, y un control deshabilitado suelta el foco a BODY; por eso, antes de aplicar, se pide que el
 * contenedor del kit que aparece en el cuerpo del panel tome el foco (`enfocar`): es visible, tiene el anillo del kit
 * y dice qué está pasando. La región viva sólo anuncia; no recibe el foco (era un `span` invisible de 1 px).
 */
export function pulsarAdaptar(pedirFoco: () => void, adaptar: () => void): void {
  pedirFoco();
  adaptar();
}

export function AdaptarAplicacion({ clave, nPreguntas, onBackToCodificar, base = null, yaCodificadaEn = null, yaListadas = [], children, botonEnCabecera = false, pedidoExterno = 0 }: Props) {
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
      base={base}
      yaCodificadaEn={yaCodificadaEn}
      yaListadas={yaListadas}
      onAdaptar={() => void aplicarCodificacion(clave, apiCodifAplicar)}
      onCancelar={jobId ? () => cancelarAdaptacion(jobId) : undefined}
      onCerrarEntrega={() => cerrarEntrega(clave)}
      onEnfocado={() => marcarEnfocado(clave)}
      botonEnCabecera={botonEnCabecera}
      pedidoExterno={pedidoExterno}
    >
      {children}
    </AdaptarAplicacionVista>
  );
}

type VistaProps = {
  entrada: AplicarEntrada;
  nPreguntas: number;
  onBackToCodificar: () => void;
  /** Retirado con la pestaña Matrices (ADR 0144); se acepta y no se usa. */
  onBackToMatrices?: () => void;
  base?: string | null;
  onAdaptar: () => void;
  /** Cancela el job en curso; sin job, no hay "Cancelar". */
  onCancelar?: () => void;
  onCerrarEntrega: () => void;
  onEnfocado: () => void;
  yaCodificadaEn?: string | null;
  yaListadas?: readonly string[];
  children?: ReactNode;
  botonEnCabecera?: boolean;
  pedidoExterno?: number;
};

/** Presentación pura de la entrada del store; testeable sin DOM. */
export function AdaptarAplicacionVista({
  entrada,
  nPreguntas,
  onBackToCodificar,
  base = null,
  onAdaptar,
  onCancelar,
  onCerrarEntrega,
  onEnfocado,
  yaCodificadaEn = null,
  yaListadas = [],
  children,
  botonEnCabecera = false,
  pedidoExterno = 0,
}: VistaProps) {
  const { aplicando, jobId, avisos, sinRecodificar, salida, enfocarPendiente } = entrada;
  // Cada pulsación pide el foco otra vez: también "Reintentar", que desaparece al volver a correr.
  const [pedidoDeFoco, setPedidoDeFoco] = useState(0);
  const pulsar = () => pulsarAdaptar(() => setPedidoDeFoco((n) => n + 1), onAdaptar);
  const entrega = estadoDeAdaptacion(
    { ...entrada, archivos: salida?.archivos ?? null },
    { cancelar: onCancelar, reintentar: nPreguntas > 0 ? pulsar : undefined },
  );
  // Qué son los archivos listos: su nombre lo pone el motor y no lo dice.
  const queSon = rotulosDeArchivos(salida?.archivos);

  const motivoDeshabilitado = aplicando
    ? "La codificación se está aplicando."
    : jobId
    ? "La aplicación ya está en curso."
    : nPreguntas === 0
    ? "No hay preguntas con códigos por aplicar."
    : "";
  const sinBoton = Boolean(yaCodificadaEn) && !aplicando && !jobId;

  return (
    <>
      {/* El cuerpo del panel: su dueño de scroll. Lleva la lista y, debajo, lo que deja la aplicación. */}
      <div className="pulso-aplicar-cuerpo">
        {children}
        {/* Sin nada que decir, la zona de resultado no ocupa lugar. */}
        <div className="pulso-aplicar-resultado">
          {/* Los archivos listos llevan su título y lo que son: el contenedor del kit solo pinta sus nombres. */}
          {entrega.fase === "lista" ? (
            <div className="pulso-aplicar-resultado-cab" data-testid="codificacion-aplicar-archivos">
              <h4 className="pulso-aplicar-resultado-titulo">{TITULO_ARCHIVOS}</h4>
              {queSon ? <p className="pulso-aplicar-resultado-nota">{queSon}</p> : null}
            </div>
          ) : null}

          {/* El avance, el fallo o los dos archivos codificados: una sola señal en
              movimiento (la línea del contenedor); el botón sólo se deshabilita. */}
          <ContenedorEntregable estado={entrega} forma="bloque" enfocar={pedidoDeFoco + pedidoExterno} onCerrar={onCerrarEntrega} />

          {/* La aplicación terminó con avisos: lo dice aquí, junto a los archivos, y lleva al primero.
              Un resultado no mueve lo que ya estaba en pantalla (C2): no va sobre la franja. */}
          <AdaptarAplicacionResumenVista entrada={entrada} onVerAvisos={() => irAlAviso(document)} />

          {/* B1: Codificación leyó otro número de casos que el de la base. */}
          <AvisoFuenteAplicar aviso={entrada.avisoFuente} />

          {/* ADR 0100, P1: las preguntas que no se aplicaron y los textos que
              quedaron sin código. Sin nada que decir, no pinta. */}
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

          {/* ADR 0144: lo que generaba la pestaña Matrices, retirada. */}
          {base ? <ArchivosDeCodificacion base={base} /> : null}
        </div>
      </div>

      <div className="pulso-aplicar-cierre">
        {/* Región viva siempre montada y sólo para el lector: anuncia el cambio de texto. El foco va al
            contenedor de arriba, que se ve. En pantalla la única señal es la línea del contenedor. */}
        <span
          id={ID_ESTADO_ADAPTAR}
          className="pulso-codif-adaptar-estado pulso-sr-only"
          role="status"
          aria-live="polite"
        >
          {aplicando ? TEXTO_APLICANDO : jobId ? TEXTO_CORRIENDO : ""}
        </span>
        {motivoDeshabilitado && !sinBoton && !botonEnCabecera && (
          <span id="codificacion-adaptar-disabled-reason" className="pulso-sr-only">
            {motivoDeshabilitado}
          </span>
        )}

        {/* El pie dice qué se escribe antes de pulsar. La acción sigue disponible después de aplicar: si se
            corrige una causa o se codifica algo más, se aplica otra vez. */}
        <PieConEfecto className="pulso-aplicar-pie" efecto={efectoDeAplicar(nPreguntas, Boolean(yaCodificadaEn))}>
          <PulsoButton variant="ghost" size="lg" onClick={onBackToCodificar}>
            <ArrowLeft size={14} aria-hidden="true" /> Volver a Codificar
          </PulsoButton>
          {sinBoton && yaCodificadaEn ? (
            <AvisoBaseYaCodificada base={yaCodificadaEn} />
          ) : botonEnCabecera ? null : (
            <PulsoButton
              variant="primary"
              size="lg"
              onClick={pulsar}
              disabled={aplicando || !!jobId || nPreguntas === 0}
              aria-busy={aplicando || undefined}
              aria-describedby={motivoDeshabilitado ? "codificacion-adaptar-disabled-reason" : undefined}
              data-testid="codificacion-adaptar-boton"
            >
              <Play size={14} aria-hidden="true" /> Aplicar a la base
            </PulsoButton>
          )}
        </PieConEfecto>
      </div>
    </>
  );
}

/**
 * La aplicación terminó y dejó avisos: una línea en el bloque de resultado, junto a los archivos,
 * con el enlace al primero. Sin avisos o sin job terminado no pinta.
 */
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
        La aplicación terminó con {n === 1 ? "1 aviso" : `${n} avisos`}.
      </span>
      <button type="button" className="pulso-codif-adaptar-resumen-enlace" onClick={onVerAvisos}>
        Ver {n === 1 ? "el aviso" : "los avisos"}
      </button>
    </p>
  );
}
