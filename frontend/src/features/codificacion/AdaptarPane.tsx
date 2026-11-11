// Codificación, Aplicar (ADR 0142, etapa P3d): qué se aplica a la base y qué
// produce. Una franja dice de dónde sale y a dónde llega. Debajo, dos paneles:
// las preguntas (con las que no se pueden aplicar, el resultado de la última
// aplicación y, al pie, la acción con su efecto) y el detalle de la pregunta
// elegida, con la tabla de sus códigos.
//
// Cada cifra aparece una vez: los totales en la franja, lo de cada pregunta en
// su fila y el desglose por código en el detalle. Todas salen del plan del motor
// (`aplicar/modeloAplicar.ts`).

import { useId, useState } from "react";

import { Alert } from "../../components/Alert";
import { EstadoVacio } from "../../components/EstadoVacio";
import { FranjaRecorrido } from "../../components/procesamiento/FranjaRecorrido";
import { PulsoButton } from "../../components/PulsoButton";
import { ErrorBlock, LoadingBlock } from "../../components/States";
import { useSession } from "../../lib/SessionContext";
import { Database, RefreshCw, Tags } from "../../vendor/lucide-react";
import { AdaptarAplicacion } from "./AdaptarAplicacion";
import { AdaptarOmitidas } from "./AdaptarOmitidas";
import { DetalleAplicar } from "./aplicar/DetalleAplicar";
import { ListaAplicar } from "./aplicar/ListaAplicar";
import { AVISO_BASE_CAMBIO, claveDePregunta, franjaDeAplicar, preguntaElegida, resumenDelPlan } from "./aplicar/modeloAplicar";
import { PanelAplicar } from "./aplicar/PanelAplicar";
import { usePlanAplicar } from "./aplicar/usePlanAplicar";
import { claveAplicar } from "./aplicarAvisosStore";
import { useBaseYaCodificada } from "./useBaseYaCodificada";

type Props = {
  /** Base activa de codificación: los avisos de la última aplicación van por base. */
  base: string | null;
  onBackToCodificar: () => void;
  onBackToMatrices: () => void;
};

/** El marco de la pantalla mientras no hay plan: la misma sección y el mismo panel, sin marca de lista. */
const CLASE_DE_PANTALLA = "pulso-codificacion-adaptar pulso-aplicar";
const TITULO_DE_PREGUNTAS = "Preguntas por aplicar";

export function AdaptarPane({ base, onBackToCodificar, onBackToMatrices }: Props) {
  const { sessionId } = useSession();
  const { plan, error, cargando, recargar } = usePlanAplicar();
  // La pregunta elegida para el detalle. Estado efímero de la vista: no va a la dirección.
  // Sin elegir, o si la elegida ya no está en el plan, vale la primera.
  const [claveElegida, setClaveElegida] = useState<string | null>(null);
  const idDeDetalle = useId();
  // Lo que deja una aplicación (avisos, sin recodificar, archivos, job) vive
  // en `aplicarAvisosStore`: al terminar el job la página remonta este panel y
  // el estado local se perdía (QA C5, Codificación, Aplicar).
  const clave = claveAplicar(sessionId, base);
  const yaCodificada = useBaseYaCodificada(base);
  const iconoDePreguntas = <Database size={16} />;

  if (error) {
    return (
      <section className={CLASE_DE_PANTALLA}>
        <div className="pulso-aplicar-mesa">
          <PanelAplicar variante="preguntas" titulo={TITULO_DE_PREGUNTAS} icono={iconoDePreguntas} soloEstado>
            <ErrorBlock
              label="No se pudieron leer las preguntas por aplicar"
              detail={error}
              queda="La base y la codificación siguen como estaban."
              acciones={
                <PulsoButton variant="secondary" onClick={recargar}>
                  Reintentar
                </PulsoButton>
              }
            />
          </PanelAplicar>
        </div>
      </section>
    );
  }
  if (!plan) {
    return (
      <section className={CLASE_DE_PANTALLA}>
        <div className="pulso-aplicar-mesa">
          <PanelAplicar variante="preguntas" titulo={TITULO_DE_PREGUNTAS} icono={iconoDePreguntas} soloEstado>
            <LoadingBlock label="Cargando las preguntas por aplicar" />
          </PanelAplicar>
        </div>
      </section>
    );
  }

  const resumen = resumenDelPlan(plan);
  const nAplicables = resumen.aplicables.length;
  // Sin preguntas en el plan (ni aplicables ni fuera): un vacío con su texto propio, nunca una buena noticia.
  const sinPreguntas = nAplicables === 0 && resumen.fuera.length === 0;
  const baseCambio = plan.respuestas_cambiaron === true;
  const elegida = preguntaElegida(resumen.aplicables, claveElegida);

  return (
    <section
      className={CLASE_DE_PANTALLA}
      data-audit-ready="codificacion-adaptar"
      // C1: sus hijos (franja y mesa de paneles) son secciones independientes,
      // no pares. La mesa llega al borde inferior y el vacío queda dentro de
      // sus paneles (C3). El resultado de una aplicación va dentro del panel de
      // preguntas: no mueve la franja ni la mesa (C2).
      data-qa-geometry-group="codificacion/adaptar-secciones"
      data-qa-geometry-contract="intrinsic"
    >
      {/* De dónde sale y a dónde llega. Sin preguntas aplicables no hay recorrido que contar.
          ADR 0100 D3: si la base cambió y la aplicación anterior se descartó, lo dice su aviso. */}
      {nAplicables > 0 ? (
        <FranjaRecorrido {...franjaDeAplicar(resumen, { baseCambio })} grupoDeGeometria="codificacion/aplicar-franja" />
      ) : null}

      <div className="pulso-aplicar-mesa" data-con-detalle={elegida ? "" : undefined}>
        <PanelAplicar
          variante="preguntas"
          titulo={TITULO_DE_PREGUNTAS}
          icono={iconoDePreguntas}
          acciones={
            <PulsoButton
              variant="ghost"
              size="sm"
              onClick={recargar}
              disabled={cargando}
              aria-busy={cargando || undefined}
              title="Volver a leer la codificación"
            >
              <RefreshCw size={13} aria-hidden="true" /> Actualizar
            </PulsoButton>
          }
        >
          <AdaptarAplicacion
            clave={clave}
            nPreguntas={nAplicables}
            onBackToCodificar={onBackToCodificar}
            onBackToMatrices={onBackToMatrices}
            yaCodificadaEn={yaCodificada ? base : null}
            yaListadas={resumen.fuera.map((p) => p.parent)}
          >
            {/* Sin franja no hay dónde decir que la base cambió: lo dice el panel. */}
            {nAplicables === 0 && baseCambio ? (
              <div className="pulso-aplicar-aviso">
                <Alert kind="info">{AVISO_BASE_CAMBIO}.</Alert>
              </div>
            ) : null}

            {elegida ? (
              <ListaAplicar
                preguntas={resumen.aplicables}
                elegida={claveDePregunta(elegida)}
                onElegir={setClaveElegida}
                idDeDetalle={idDeDetalle}
              />
            ) : null}
            {sinPreguntas ? (
              <EstadoVacio
                tamano="normal"
                icono={<Tags size={18} />}
                titulo="Ninguna pregunta tiene códigos por aplicar"
                descripcion="Los códigos se asignan en Codificar o se importan en Matrices."
              />
            ) : null}

            {/* Las que no se pueden aplicar: cada una con su causa y, si se puede, la acción que la destraba. */}
            <AdaptarOmitidas preguntas={resumen.fuera} onCambio={recargar} onIrAPreguntas={onBackToCodificar} />
          </AdaptarAplicacion>
        </PanelAplicar>

        {/* El desglose por código de la pregunta elegida. Sin preguntas aplicables no hay detalle. */}
        {elegida ? <DetalleAplicar id={idDeDetalle} pregunta={elegida} /> : null}
      </div>
    </section>
  );
}
