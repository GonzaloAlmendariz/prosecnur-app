// Codificación, Aplicar (ADR 0142, etapa P3d): qué se aplica a la base y qué
// produce. Una franja dice de dónde sale y a dónde llega. Debajo, dos paneles:
// las preguntas (con las que no se pueden aplicar, el resultado de la última
// aplicación y, al pie, la acción con su efecto) y el detalle de la pregunta
// elegida, con la tabla de sus códigos.
//
// Cada cifra aparece una vez: los totales en la franja, lo de cada pregunta en
// su fila y el desglose por código en el detalle. Todas salen del plan del motor
// (`aplicar/modeloAplicar.ts`).

import { useId, useState, type ReactNode } from "react";

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
import { useAvanceParaAplicar } from "./aplicar/useAvanceParaAplicar";
import { estadoDeFila, gruposDeAplicar } from "./aplicar/gruposDeAplicar";
import { claveAplicar, selectAplicarEntrada, useAplicarAvisosStore } from "./aplicarAvisosStore";
import { BotonAplicar } from "./aplicar/BotonAplicar";
import { CabeceraDeCodificacion } from "./CabeceraDeCodificacion";
import type { EstadoDePestana } from "../../components/procesamiento/CabeceraDePestana";
import type { CifraDePestana } from "../../components/procesamiento/CifrasDePestana";
import { formatoConteo } from "../../lib/formatoNumero";
import { useBaseYaCodificada } from "./useBaseYaCodificada";

type Props = {
  /** Base activa de codificación: los avisos de la última aplicación van por base. */
  base: string | null;
  onBackToCodificar: () => void;
  /** Retirado con la pestaña Matrices (ADR 0144); se acepta y no se usa. */
  onBackToMatrices?: () => void;
  /** El nombre de la base activa cuando la banda no lo muestra. */
  baseActual?: ReactNode;
};

/** El marco de la pantalla mientras no hay plan: la misma sección y el mismo panel, sin marca de lista. */
const CLASE_DE_PANTALLA = "pulso-codificacion-adaptar pulso-aplicar";
// El título del prototipo: lo que entra a la base, con sus grupos "Listas" y "En curso".
const TITULO_DE_PREGUNTAS = "Preguntas de la base codificada";

export function AdaptarPane({ base, onBackToCodificar, baseActual }: Props) {
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
  const entrada = useAplicarAvisosStore(selectAplicarEntrada(clave));
  // El avance de cada pregunta ("Lista" o "Faltan N") se vuelve a leer con el plan.
  const aplicablesParents = plan ? resumenDelPlan(plan).aplicables.map((p) => p.parent) : [];
  const { listo: avancesListos, mapa: avances } = useAvanceParaAplicar(plan, aplicablesParents);
  // Cada pulsación del botón de la cabecera lleva el foco al avance, dentro del panel de preguntas.
  const [pedidoDeFoco, setPedidoDeFoco] = useState(0);
  // "Ver qué cambia" abre las respuestas de la pregunta elegida con el código que recibe cada una.
  const [verQueCambia, setVerQueCambia] = useState(0);

  const resumenParaCabecera = plan ? resumenDelPlan(plan) : null;
  const nPorAplicar = resumenParaCabecera?.aplicables.length ?? 0;
  const nTotal = nPorAplicar + (resumenParaCabecera?.fuera.length ?? 0);
  // "Listas" con la misma definición que la lista: todas sus respuestas con código. Sin el avance, no se dice.
  const gruposParaCabecera = resumenParaCabecera ? gruposDeAplicar(resumenParaCabecera.aplicables, avances) : null;
  const nListas = gruposParaCabecera ? gruposParaCabecera.find((g) => g.id === "listas")?.preguntas.length ?? 0 : null;
  const estado: EstadoDePestana | null = !plan
    ? null
    : entrada.aplicando || entrada.jobId
      ? { tono: "parcial", texto: "Aplicando" }
      : entrada.salida
        ? { tono: "listo", texto: "Aplicada" }
        : plan.respuestas_cambiaron === true
          ? { tono: "atencion", texto: "Desactualizada" }
          : nPorAplicar > 0
            ? { tono: "parcial", texto: "Por aplicar" }
            : { tono: "neutro", texto: "Sin códigos" };
  const cifras: CifraDePestana[] = nTotal > 0 && nListas !== null
    ? [{ clave: "listas", valor: formatoConteo(nListas), base: formatoConteo(nTotal), rotulo: nListas === 1 ? "pregunta lista" : "preguntas listas", tono: nListas > 0 ? "ok" : "neutral", rango: 1 }]
    : [];
  const cabecera = (
    <CabeceraDeCodificacion
      pestana="adaptar"
      estado={estado}
      cifras={cifras}
      pendientes="Última aplicación: el motor no publica la fecha de la última aplicación"
      acciones={(
        <>
          {baseActual}
          {plan ? (
            <BotonAplicar clave={clave} nPreguntas={nPorAplicar} yaCodificada={Boolean(yaCodificada)} onPulsado={() => setPedidoDeFoco((n) => n + 1)} />
          ) : null}
        </>
      )}
    />
  );

  if (error) {
    return (
      <section className={CLASE_DE_PANTALLA}>
        {cabecera}
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
        {cabecera}
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
  // Las respuestas que entran sin código propio, con la misma cuenta que "Faltan N" de la lista.
  const sinCodigoPropio = avances && resumen.aplicables.every((p) => avances.has(p.parent))
    ? resumen.aplicables.reduce((suma, p) => {
        const a = avances.get(p.parent);
        return suma + (a ? Math.max(0, a.total - a.decididas) : 0);
      }, 0)
    : null;

  return (
    <section
      className={CLASE_DE_PANTALLA}
      // C1: sus hijos (franja y mesa de paneles) son secciones independientes,
      // no pares. La mesa llega al borde inferior y el vacío queda dentro de
      // sus paneles (C3). El resultado de una aplicación va dentro del panel de
      // preguntas: no mueve la franja ni la mesa (C2).
      data-qa-geometry-group="codificacion/adaptar-secciones"
      data-qa-geometry-contract="intrinsic"
    >
      {/* La marca de lista va cuando ya se sabe el estado de cada pregunta (sus grupos "Listas" y "En curso"). */}
      {avancesListos ? <span data-audit-ready="codificacion-adaptar" hidden /> : null}
      {cabecera}
      {/* De dónde sale y a dónde llega. Sin preguntas aplicables no hay recorrido que contar.
          ADR 0100 D3: si la base cambió y la aplicación anterior se descartó, lo dice su aviso. */}
      {nAplicables > 0 ? (
        <FranjaRecorrido
          {...franjaDeAplicar(resumen, { baseCambio, sinCodigo: sinCodigoPropio })}
          grupoDeGeometria="codificacion/aplicar-franja"
          accionDeAvisos={elegida ? (
            <PulsoButton variant="link" size="sm" onClick={() => setVerQueCambia((n) => n + 1)}>Ver qué cambia</PulsoButton>
          ) : undefined}
        />
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
            base={base}
            yaCodificadaEn={yaCodificada ? base : null}
            yaListadas={resumen.fuera.map((p) => p.parent)}
            botonEnCabecera
            pedidoExterno={pedidoDeFoco}
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
                grupos={gruposDeAplicar(resumen.aplicables, avances)}
                estadoDe={(p) => estadoDeFila(avances?.get(p.parent))}
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
        {elegida ? <DetalleAplicar id={idDeDetalle} pregunta={elegida} vistaPedida={verQueCambia} /> : null}
      </div>
    </section>
  );
}
