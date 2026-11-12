import { useId, useState } from "react";
import { ArrowRightLeft, Inbox, ListChecks } from "../../../../vendor/lucide-react";
import type { CargaReviewPayload, CargaReviewSummaryPayload, ChoiceCodeMapReview } from "../../../../api/client";
import { EstadoVacio } from "../../../../components/EstadoVacio";
import { MesaDePestana } from "../../../../components/procesamiento/MesaDePestana";
import { PanelDeMesa } from "../../../../components/procesamiento/PanelDeMesa";
import type { CifraDePestana } from "../../../../components/procesamiento/CifrasDePestana";
import { PulsoButton, PulsoButtonEnlace } from "../../../../components/PulsoButton";
import { ErrorBlock, LoadingBlock } from "../../../../components/States";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { CargaUniverseFilter } from "../../CargaUniverseFilter";
import { FuentesEmparejamientoPanel } from "../../FuentesEmparejamientoPanel";
import { OrigenExternoPanel } from "../../OrigenExternoPanel";
import { SelectorDeBaseCarga } from "../SelectorDeBaseCarga";
import { AvisosDeLaBase } from "./AvisosDeLaBase";
import { CabeceraDeMesaDeCarga } from "./CabeceraDeMesaDeCarga";
import { CodigosPorConfirmar } from "./CodigosPorConfirmar";
import { ColumnasFueraDelFormulario } from "./ColumnasFueraDelFormulario";
import {
  cifrasDeRevision,
  codigosPendientes,
  comprobacionInicial,
  comprobacionesDeRevision,
  estadoDeRevision,
  filtroInicial,
  marcadasIniciales,
  type ClaveDeComprobacion,
  type FiltroDeColumnas,
} from "./comprobacionesModel";
import { DecisionDeColumnas } from "./DecisionDeColumnas";
import { ListaDeComprobaciones } from "./ListaDeComprobaciones";
import "./marcoDeMesa.css";
import "./revision.css";

export type MesaDeRevisionProps = {
  revision: CargaReviewPayload | null;
  /** La revisión de la base elegida todavía no llega. */
  leyendo: boolean;
  ocupado: boolean;
  tieneFormulario: boolean;
  tieneRespuestas: boolean;
  mapeoPendiente: boolean;
  filas: number | null;
  varias: boolean;
  basesPrimarias: readonly string[];
  baseElegida: string;
  onCambiarBase: (nombre: string) => void;
  resumenDeBases: CargaReviewSummaryPayload | null;
  puedeContinuar: boolean;
  /** Se monta el filtro de universo (y la base preparada fuera) para esta base. */
  conDeclaraciones: boolean;
  onLecturaUniverso: (base: string, leida: boolean) => void;
  onUniversoAplicado: () => void;
  onRevisarMapeo: (mapeo: ChoiceCodeMapReview) => void;
  /** Guarda la decisión sobre las columnas fuera del formulario (el mismo POST que el diálogo de variables extra). */
  onGuardarColumnas: (incluidas: string[]) => Promise<unknown>;
};

type EstadoDeColumnas = { firma: string; marcadas: string[]; filtro: FiltroDeColumnas };

/**
 * Carga › Revisión con la forma del prototipo "carga-revision": la cabecera
 * con el estado y las comprobaciones conformes; a la izquierda las
 * comprobaciones de la base, en el centro el detalle de la elegida y a la
 * derecha la decisión que pide. Una sola composición para una y varias bases:
 * con varias, el selector de base va en la cabecera.
 */
export function MesaDeRevision(props: MesaDeRevisionProps) {
  const {
    revision, leyendo, ocupado, tieneFormulario, tieneRespuestas, mapeoPendiente, filas, varias,
    basesPrimarias, baseElegida, onCambiarBase, resumenDeBases, puedeContinuar, conDeclaraciones,
    onLecturaUniverso, onUniversoAplicado, onRevisarMapeo, onGuardarColumnas,
  } = props;
  const idDetalle = useId();
  const conInsumos = varias ? basesPrimarias.length > 0 && tieneFormulario && tieneRespuestas : tieneFormulario && tieneRespuestas;
  const comprobaciones = comprobacionesDeRevision({
    revision,
    leyendo,
    tieneFormulario,
    tieneRespuestas,
    mapeoPendiente,
    filas,
    conUniverso: conDeclaraciones,
    conOrigenExterno: conDeclaraciones,
  });
  const [elegidaPorUsuario, setElegida] = useState<ClaveDeComprobacion | null>(null);
  const elegida = elegidaPorUsuario && comprobaciones.some((c) => c.clave === elegidaPorUsuario)
    ? elegidaPorUsuario
    : comprobacionInicial(comprobaciones);
  const comprobacion = comprobaciones.find((c) => c.clave === elegida) ?? null;

  // La selección de columnas vive mientras la revisión no cambie; otra lectura
  // (otra base, o la decisión recién guardada) vuelve a la que dice el motor.
  const extras = revision?.reconciliation.extra ?? [];
  const firma = `${revision?.base_nombre ?? ""}|${extras.map((e) => `${e.name}:${e.decision}`).join(",")}`;
  const [columnas, setColumnas] = useState<EstadoDeColumnas | null>(null);
  const vigente: EstadoDeColumnas = columnas && columnas.firma === firma
    ? columnas
    : { firma, marcadas: marcadasIniciales(extras), filtro: filtroInicial(extras) };
  const [guardado, setGuardado] = useState<{ guardando: boolean; error: string }>({ guardando: false, error: "" });

  function marcar(nombre: string, entra: boolean) {
    const resto = vigente.marcadas.filter((n) => n !== nombre);
    setColumnas({ ...vigente, marcadas: entra ? [...resto, nombre] : resto });
  }

  async function guardar(incluidas: string[]) {
    setGuardado({ guardando: true, error: "" });
    try {
      await onGuardarColumnas(incluidas);
      setGuardado({ guardando: false, error: "" });
    } catch (e) {
      setGuardado({ guardando: false, error: (e as Error).message || "No se pudo guardar la decisión." });
    }
  }

  const resumen = varias ? resumenDeBases : null;
  const { conformes, total } = cifrasDeRevision(comprobaciones);
  const cifras: CifraDePestana[] = [];
  if (conInsumos && !leyendo && revision) {
    cifras.push({
      clave: "conformes",
      valor: formatoConteo(conformes),
      base: formatoConteo(total),
      rotulo: total === 1 ? "comprobación conforme" : "comprobaciones conformes",
      tono: conformes === total ? "ok" : "alerta",
      rango: 1,
    });
  }
  if (resumen && !leyendo) {
    const bloqueadas = resumen.bases.filter((b) => !b.ready);
    cifras.push({
      clave: "bases",
      valor: formatoConteo(resumen.n_ready),
      base: formatoConteo(resumen.n_bases),
      rotulo: resumen.n_bases === 1 ? "base sin pendientes" : "bases sin pendientes",
      tono: resumen.all_ready ? "ok" : "alerta",
      titulo: bloqueadas.length > 0
        ? bloqueadas.map((b) => `${b.base_nombre}: ${b.blockers.join(", ") || "con pendientes"}`).join(". ")
        : undefined,
    });
  }

  const cabecera = (
    <CabeceraDeMesaDeCarga
      pestana="revision"
      titulo="Revisión"
      estado={estadoDeRevision({ lista: comprobaciones, leyendo, conInsumos, resumen })}
      cifras={cifras}
      pendientes='"Filas leídas" y "columnas": las filas van en la comprobación Respuestas; las columnas no, porque el estudio publica las del archivo recibido y la hoja las procesadas. "Filas repetidas": el motor no la publica'
      acciones={(varias && basesPrimarias.length > 1) || puedeContinuar ? (
        <>
          {varias ? (
            <SelectorDeBaseCarga bases={basesPrimarias} elegida={baseElegida} onCambiar={onCambiarBase} deshabilitado={ocupado} />
          ) : null}
          {puedeContinuar ? (
            <PulsoButtonEnlace variant="primary" size="md" nav href="/validacion">Ir a Validación</PulsoButtonEnlace>
          ) : null}
        </>
      ) : undefined}
    />
  );

  const mapeoRevisable = Boolean(revision?.choice_mapping.pending && revision.choice_mapping.maps.length > 0);
  const tituloCentro = comprobacion?.titulo ?? "Revisión de la base";

  return (
    <div className="pulso-carga-mesa-kit pulso-revision" data-carga-surface="review">
      <MesaDePestana grupo="carga/revision" columnas={3} cabecera={cabecera}>
        <PanelDeMesa zona="cola" titulo="Comprobaciones" conteo={comprobaciones.filter((c) => c.grupo === "comprobacion").length}>
          <ListaDeComprobaciones comprobaciones={comprobaciones} elegida={elegida} onElegir={setElegida} idDetalle={idDetalle} />
        </PanelDeMesa>

        <PanelDeMesa
          zona="detalle"
          titulo={tituloCentro}
          conteo={elegida === "extra" && revision ? revision.reconciliation.n_extra : undefined}
          ocupado={leyendo && Boolean(revision)}
          etiquetaCuerpo={`Detalle: ${tituloCentro}`}
        >
          <div id={idDetalle} className="pulso-revision-detalle">
            {!conInsumos ? (
              <div className="pulso-revision-pleno"><EstadoVacio
                tamano="normal"
                icono={<Inbox size={18} />}
                titulo={varias && basesPrimarias.length === 0 ? "Todavía no hay bases" : "Esta base todavía no tiene formulario y respuestas"}
                descripcion="Se cargan en Bases. La revisión empieza cuando están los dos."
              /></div>
            ) : leyendo ? (
              <div className="pulso-revision-pleno"><LoadingBlock variant="inline" label="Leyendo la revisión de la base" /></div>
            ) : !revision ? (
              <div className="pulso-revision-pleno"><ErrorBlock
                label="No se pudo leer la revisión de esta base"
                causa="El servidor no devolvió la revisión."
                queda="La base y las decisiones guardadas no cambiaron."
              /></div>
            ) : elegida === null ? (
              <div className="pulso-revision-pleno"><EstadoVacio tamano="normal" icono={<ListChecks size={18} />} titulo="Nada por decidir en esta base" /></div>
            ) : elegida === "extra" ? (
              <ColumnasFueraDelFormulario
                extras={extras}
                filtro={vigente.filtro}
                onFiltro={(filtro) => setColumnas({ ...vigente, filtro })}
                marcadas={vigente.marcadas}
                onMarcar={marcar}
                ocupado={ocupado || guardado.guardando}
              />
            ) : elegida === "codigos" ? (
              <CodigosPorConfirmar mapas={revision.choice_mapping.pending ? revision.choice_mapping.maps : []} />
            ) : elegida === "fuentes" || elegida === "versiones" || elegida === "orden" ? (
              <AvisosDeLaBase clave={elegida} revision={revision} />
            ) : elegida === "universo" || elegida === "origen-externo" ? null : (
              <p className="pulso-revision-nada pulso-revision-relleno">{comprobacion?.detalle}</p>
            )}
            {/* El universo y la base preparada fuera leen su configuración al montarse y la página espera esa
                lectura para declararse lista: se montan siempre y solo se muestran al elegirlos. */}
            {conDeclaraciones ? (
              <>
                <div hidden={elegida !== "universo"} className="pulso-revision-declaracion">
                  <CargaUniverseFilter
                    baseNombre={varias ? baseElegida : undefined}
                    disabled={ocupado}
                    onLectura={onLecturaUniverso}
                    onApplied={onUniversoAplicado}
                  />
                </div>
                <div hidden={elegida !== "origen-externo"} className="pulso-revision-declaracion">
                  <OrigenExternoPanel baseNombre={varias ? baseElegida : undefined} disabled={ocupado} />
                </div>
              </>
            ) : null}
          </div>
        </PanelDeMesa>

        {elegida === "extra" && revision && conInsumos && !leyendo ? (
          <DecisionDeColumnas
            extras={extras}
            marcadas={vigente.marcadas}
            guardando={guardado.guardando}
            error={guardado.error}
            ocupado={ocupado}
            onGuardar={(incluidas) => void guardar(incluidas)}
          />
        ) : elegida === "codigos" && revision && codigosPendientes({ revision, mapeoPendiente }) ? (
          <PanelDeMesa
            zona="decision"
            titulo="Decisión"
            pie={mapeoRevisable && revision ? (
              <PulsoButton
                variant="primary"
                size="lg"
                className="pulso-revision-revisar-mapeo"
                disabled={ocupado}
                onClick={() => onRevisarMapeo({
                  applied: revision.choice_mapping.applied,
                  requires_confirmation: revision.choice_mapping.requires_confirmation,
                  n_questions: revision.choice_mapping.n_questions,
                  maps: revision.choice_mapping.maps,
                })}
              >
                <ArrowRightLeft size={15} aria-hidden="true" />
                Revisar mapeo
              </PulsoButton>
            ) : undefined}
          >
            <p className="pulso-revision-nada pulso-revision-relleno">
              Al confirmar, las respuestas de estas preguntas se leen con los códigos de su lista en el formulario.
            </p>
          </PanelDeMesa>
        ) : (
          <PanelDeMesa zona="decision" titulo="Decisión">
            <div className="pulso-revision-relleno"><EstadoVacio tamano="compacto" icono={<ListChecks size={15} />} titulo="Nada que decidir aquí" /></div>
          </PanelDeMesa>
        )}
      </MesaDePestana>
      {/* "Ver preguntas" de cada fuente; también lo abre un enlace guardado. */}
      <FuentesEmparejamientoPanel baseNombre={revision && !leyendo ? revision.base_nombre : undefined} />
    </div>
  );
}
