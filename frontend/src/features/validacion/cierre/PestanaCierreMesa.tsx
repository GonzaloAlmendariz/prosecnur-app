/**
 * La mesa de Cierre (plan de fidelidad, rebanada V4; prototipo
 * `validacion-cierre`, vistas.js:1021-1049): la cabecera con "hallazgos
 * decididos", "valores cambiados" y "última auditoría" y la acción "Cerrar la
 * base" o "Reabrir la base"; la franja de los casos recibidos a los que
 * cuentan; y dos columnas, "Decisiones aplicadas" y, a la derecha, "Lista para
 * análisis" sobre "Archivos". El registro completo es el panel `registro`.
 *
 * Todo sale de `GET /limpieza` con su campo `cierre` (motor M5). Las cifras de
 * `summary` no se usan: después de cerrar se miden sobre la base ya limpia.
 */
import { useState } from "react";
import { Check, Inbox, ListChecks, Loader2, RotateCcw } from "../../../vendor/lucide-react";
import { Alert } from "../../../components/Alert";
import { CargaDeBloque } from "../../../components/CargaDeBloque";
import { Dialog } from "../../../components/Dialog";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { FranjaRecorrido } from "../../../components/procesamiento/FranjaRecorrido";
import { MesaDePestana, PilaDeMesa } from "../../../components/procesamiento/MesaDePestana";
import { PanelDeMesa } from "../../../components/procesamiento/PanelDeMesa";
import { PulsoButton } from "../../../components/PulsoButton";
import { ErrorBlock } from "../../../components/States";
import { splitErrorDetail } from "../../../components/errorPresentation";
import { usePanelDireccionable } from "../../../lib/navegacion/paneles";
import { formatoConteo } from "../../../lib/formatoNumero";
import { PANEL_REGISTRO_VALIDACION } from "../panelesValidacion";
import { usePestanaValidacion } from "../pestanaDireccionable";
import CabeceraDeTransicion from "../pestanas/CabeceraDeTransicion";
import { elementosDeCola } from "../hallazgos/modeloHallazgos";
import { ArchivosDelCierre } from "./ArchivosDelCierre";
import { DecisionesAplicadas } from "./DecisionesAplicadas";
import { ListaParaAnalisis } from "./ListaParaAnalisis";
import { PanelRegistro } from "./PanelRegistro";
import { useCierre } from "./useCierre";
import {
  avisoDeCifrasPorDecision,
  cabeceraDeCierre,
  causaDeNoCerrar,
  filasDeRegistro,
  franjaDeCasos,
  gruposDeDecisiones,
  puntosDeLista,
  sePuedeReabrir,
  seOfreceCerrar,
  selloDeLaBase,
  situacionDeLaBase,
} from "./modeloCierre";

const GRUPO = "validacion/cierre";

export function PestanaCierreMesa() {
  const c = useCierre();
  const { irAPestana } = usePestanaValidacion();
  const registro = usePanelDireccionable(PANEL_REGISTRO_VALIDACION);
  const [confirmarReabrir, setConfirmarReabrir] = useState(false);
  const irAHallazgos = () => irAPestana("hallazgos");
  const abrirHallazgo = (sourceId: string) => irAPestana("hallazgos", undefined, { foco: sourceId });

  if (c.lectura.fase === "cargando") {
    return (
      <MesaDePestana grupo={GRUPO} columnas={2} cabecera={<CabeceraDeTransicion pestana="cierre" />}>
        <PanelDeMesa zona="decisiones" titulo="Decisiones aplicadas" ocupado>
          {/* La marca de "todavía no" de la pestaña: se va con la lectura o con su error. */}
          <CargaDeBloque label="Leyendo el cierre de la base" />
        </PanelDeMesa>
        <PilaDeMesa grupo={GRUPO}>
          <PanelDeMesa zona="lista" titulo="Lista para análisis" ocupado>{null}</PanelDeMesa>
          <PanelDeMesa zona="archivos" titulo="Archivos" ocupado>{null}</PanelDeMesa>
        </PilaDeMesa>
      </MesaDePestana>
    );
  }

  if (c.lectura.fase === "error") {
    return (
      <MesaDePestana grupo={GRUPO} columnas={2} cabecera={<CabeceraDeTransicion pestana="cierre" />}>
        <div className="pulso-ci-error">
          <ErrorBlock
            label="No se pudo leer el cierre de la base"
            causa={splitErrorDetail(c.lectura.mensaje).message}
            queda="Las decisiones guardadas y la base del estudio no cambiaron."
            acciones={<PulsoButton variant="primary" size="lg" onClick={c.recargar}>Reintentar</PulsoButton>}
          />
        </div>
      </MesaDePestana>
    );
  }

  const { data, cierre } = c.lectura;
  const situacion = situacionDeLaBase(data, cierre);
  const cabecera = cabeceraDeCierre({ data, cierre, situacion, auditoria: c.auditoria });
  const causaCerrar = causaDeNoCerrar(situacion, data);
  const ocupado = c.releyendo || c.cerrando || c.reabriendo;

  const conAcciones = sePuedeReabrir(situacion) || seOfreceCerrar(situacion);
  const acciones = !conAcciones ? undefined : (
    <>
      {sePuedeReabrir(situacion) ? (
        <PulsoButton variant="secondary" disabled={ocupado} onClick={() => setConfirmarReabrir(true)}>
          {c.reabriendo ? <Loader2 size={14} className="pulso-spin" aria-hidden="true" /> : <RotateCcw size={14} aria-hidden="true" />}
          Reabrir la base
        </PulsoButton>
      ) : null}
      {seOfreceCerrar(situacion) ? (
        <PulsoButton variant="primary" disabled={!!causaCerrar || ocupado} title={causaCerrar ?? undefined} onClick={() => void c.cerrarLaBase()}>
          {c.cerrando ? <Loader2 size={14} className="pulso-spin" aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}
          {c.cerrando ? "Cerrando la base" : "Cerrar la base"}
        </PulsoButton>
      ) : null}
    </>
  );
  const cabeceraNodo = (
    <CabeceraDeTransicion
      pestana="cierre"
      estado={cabecera.estado}
      cifras={cabecera.cifras}
      pendientes={cabecera.pendientes}
      acciones={acciones}
    />
  );

  const falloDelCierre = c.estadoDelCierre.fase === "fallo" ? c.estadoDelCierre : null;
  const avisos = falloDelCierre || c.aviso || (cierre?.causa_sin_cifras && situacion.tipo !== "sin-auditar") ? (
    <div className="pulso-ci-avisos">
      {falloDelCierre ? (
        <ErrorBlock
          label="No se pudo cerrar la base"
          causa={falloDelCierre.causa}
          queda="La base del estudio y las decisiones no cambiaron."
          acciones={<PulsoButton variant="secondary" onClick={() => void c.cerrarLaBase()}>Reintentar</PulsoButton>}
        />
      ) : null}
      {c.aviso?.tono === "error" ? <ErrorBlock label="No se pudo reabrir la base" detail={c.aviso.texto} /> : null}
      {c.aviso?.tono === "info" ? <Alert kind="info">{c.aviso.texto}</Alert> : null}
      {cierre?.causa_sin_cifras && situacion.tipo !== "sin-auditar" ? <Alert kind="warn">{cierre.causa_sin_cifras}</Alert> : null}
    </div>
  ) : undefined;

  const franja = situacion.tipo === "sin-auditar" ? null : franjaDeCasos(cierre?.cadena_casos ?? null, situacion);
  const franjaNodo = franja ? (
    <FranjaRecorrido
      etiqueta="De los casos recibidos a los que cuentan"
      grupos={franja.grupos}
      barra={franja.proporcion}
      destino={{ rotulo: "Cuentan", cifra: franja.cuentan, ...(franja.nota ? { nota: franja.nota } : {}) }}
      avisos={franja.avisos}
      grupoDeGeometria={`${GRUPO}-franja`}
      className="pulso-ci-franja"
    />
  ) : undefined;

  // --- Decisiones ---------------------------------------------------------------
  const elementos = elementosDeCola(data);
  const aplicadas = cierre?.decisiones_aplicadas ?? null;
  const grupos = aplicadas ? gruposDeDecisiones({ aplicadas, cadena: cierre?.cadena_casos ?? null, elementos }) : [];
  const tituloDecisiones = situacion.tipo === "cerrada" ? "Decisiones aplicadas" : "Decisiones listas";
  let vacio;
  if (situacion.tipo === "sin-auditar") {
    vacio = (
      <EstadoVacio
        tamano="normal"
        icono={<ListChecks size={20} />}
        titulo="La base no se ha auditado"
        descripcion="Las decisiones se toman sobre los hallazgos de la auditoría, que se corre en Hallazgos."
        accion={<PulsoButton variant="primary" size="lg" onClick={irAHallazgos}>Ir a Hallazgos</PulsoButton>}
      />
    );
  } else if (!aplicadas) {
    vacio = (
      <EstadoVacio
        tamano="normal"
        icono={<Inbox size={20} />}
        titulo="Sin cifras de las decisiones"
        descripcion={cierre?.causa_sin_cifras ?? "El motor no publicó las decisiones aplicadas de esta base."}
      />
    );
  } else if (elementos.length === 0) {
    vacio = (
      <EstadoVacio
        tamano="normal"
        icono={<Inbox size={20} />}
        titulo="Sin decisiones"
        descripcion="La última auditoría no encontró hallazgos que decidir."
      />
    );
  } else {
    vacio = (
      <EstadoVacio
        tamano="normal"
        icono={<Inbox size={20} />}
        titulo="Todavía no hay decisiones listas"
        descripcion="Las decisiones se toman en Hallazgos."
        accion={(
          <PulsoButton variant="primary" size="lg" onClick={irAHallazgos}>
            <Inbox size={14} aria-hidden="true" />
            Ir a Hallazgos
          </PulsoButton>
        )}
      />
    );
  }

  const casosCargados = data.artifacts && "promocion" in data.artifacts ? data.artifacts.promocion?.n_casos_antes ?? null : null;

  return (
    <>
      <MesaDePestana grupo={GRUPO} columnas={2} cabecera={cabeceraNodo} avisos={avisos} franja={franjaNodo}>
        <DecisionesAplicadas
          titulo={tituloDecisiones}
          grupos={grupos}
          conteo={aplicadas && situacion.tipo !== "sin-auditar" ? aplicadas.decisiones.length : undefined}
          aviso={avisoDeCifrasPorDecision(cierre)}
          vacio={<div className="pulso-ci-vacio">{vacio}</div>}
          ocupado={ocupado}
          onVerRegistro={registro.abrir}
          onAbrirHallazgo={abrirHallazgo}
        />
        <PilaDeMesa grupo={GRUPO}>
          <ListaParaAnalisis
            sello={selloDeLaBase(situacion)}
            puntos={puntosDeLista({ data, auditoria: c.auditoria, casosAuditados: c.casosAuditados })}
            onIrAHallazgos={irAHallazgos}
          />
          <ArchivosDelCierre
            archivos={cierre?.archivos ?? []}
            paquete={c.paquete}
            causaSinPlan={data.progreso?.plan_construido ? null : "Requiere el plan de reglas, que se lee en Reglas."}
            onGenerarPaquete={() => void c.generarPaquete()}
            ocupado={ocupado}
          />
        </PilaDeMesa>
      </MesaDePestana>
      <PanelRegistro filas={filasDeRegistro(data)} onAbrirHallazgo={abrirHallazgo} />
      <Dialog
        open={confirmarReabrir}
        onOpenChange={(abierto) => { if (!abierto) setConfirmarReabrir(false); }}
        title="Reabrir la base"
        tono="aviso"
        footer={(
          <>
            <PulsoButton variant="secondary" onClick={() => setConfirmarReabrir(false)}>Cancelar</PulsoButton>
            <PulsoButton
              variant="primary"
              onClick={() => {
                setConfirmarReabrir(false);
                void c.reabrirLaBase();
              }}
            >
              Reabrir
            </PulsoButton>
          </>
        )}
      >
        <p className="pulso-ci-confirmar">
          La base del estudio vuelve a {casosCargados !== null ? `los ${formatoConteo(casosCargados)} casos cargados` : "la base cargada"}, y Codificación y Analítica se rehacen sobre ella. Las decisiones siguen guardadas: se aplican al volver a cerrar.
        </p>
      </Dialog>
    </>
  );
}
