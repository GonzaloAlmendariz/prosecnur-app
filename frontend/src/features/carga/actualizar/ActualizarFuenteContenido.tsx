// El Sideover de "Actualizar" con su recorrido. Ver `ActualizarFuente.tsx`.

import { useState, type ReactNode } from "react";
import {
  apiCargaActualizarRespuestas,
  apiCargaRevertirActualizacion,
  apiCargaVistaPreviaActualizacion,
  type ActualizacionAplicada,
  type VistaPreviaDeActualizacion,
} from "../../../api/cargaActualizar";
import { ApiError } from "../../../api/core";
import { apiEstudioGet, apiUpload, uploadKindForDataFile, type EstudioPayload } from "../../../api/estudio";
import { Alert } from "../../../components/Alert";
import { PulsoButton } from "../../../components/PulsoButton";
import { Sideover } from "../../../components/Sideover";
import { ErrorBlock } from "../../../components/States";
import { usePanelDireccionable } from "../../../lib/navegacion/paneles";
import { CheckCircle2, RefreshCw, Undo2 } from "../../../vendor/lucide-react";
import { PANEL_ACTUALIZAR_FUENTE } from "../panelesCarga";
import type { BaseDeLaColeccion } from "../pestanas/bases/basesModel";
import {
  causaSinVistaPreviaDePlataforma,
  errorDeActualizacion,
  lineaDeRespaldo,
  type ErrorDeActualizacion,
  type ModoDeActualizacion,
} from "./actualizarFuenteModel";
import { ElegirArchivo } from "./ElegirArchivo";
import { PasosDeActualizacion, type PasoDeActualizacion } from "./PasosDeActualizacion";
import { QueCambia } from "./QueCambia";
import { useRespaldoDe, useRespaldos } from "./respaldoStore";

type Estado =
  | { fase: "elegir" }
  | { fase: "leyendo"; archivo: string; etapa: "subiendo" | "comparando" }
  | { fase: "error"; archivo: string; error: ErrorDeActualizacion }
  | { fase: "previa"; fileId: string; previa: VistaPreviaDeActualizacion; error: ErrorDeActualizacion | null; aplicando: boolean }
  | { fase: "aplicada"; resultado: ActualizacionAplicada; error: ErrorDeActualizacion | null; revirtiendo: boolean }
  | { fase: "revertida"; archivo: string | null };

const COPIA = "Se guarda una copia de la base actual para poder volver.";

function pasoDe(estado: Estado): PasoDeActualizacion {
  if (estado.fase === "previa") return "que-cambia";
  if (estado.fase === "aplicada" || estado.fase === "revertida") return "hecho";
  return "elegir";
}

export function ActualizarFuenteContenido({ fila, modo, ocupado, onCambio }: {
  fila: BaseDeLaColeccion | null;
  modo: ModoDeActualizacion | null;
  ocupado: boolean;
  onCambio: (payload: EstudioPayload) => Promise<void>;
}) {
  const [estado, setEstado] = useState<Estado>({ fase: "elegir" });
  const { cerrar } = usePanelDireccionable(PANEL_ACTUALIZAR_FUENTE);
  const nombre = fila?.nombre ?? "";
  const respaldo = useRespaldoDe(nombre);
  const guardarRespaldo = useRespaldos((s) => s.guardar);
  const fuente = fila?.fuentes[0] ?? null;
  const titulo = fuente ? `Actualizar "${fuente.titulo}"` : "Actualizar la fuente";
  const origen = fuente?.origen ?? "";
  const antesDeAplicar = modo === "archivo" && estado.fase !== "aplicada" && estado.fase !== "revertida";
  const subtitulo = fila ? `${fila.etiqueta}${origen ? `, ${origen}` : ""}.${antesDeAplicar ? " Nada cambia hasta que apliques." : ""}` : undefined;

  const leer = async (archivo: File) => {
    setEstado({ fase: "leyendo", archivo: archivo.name, etapa: "subiendo" });
    try {
      const subido = await apiUpload(archivo, uploadKindForDataFile(archivo));
      setEstado({ fase: "leyendo", archivo: archivo.name, etapa: "comparando" });
      const previa = await apiCargaVistaPreviaActualizacion({ nombre, data_file_id: subido.file_id });
      guardarRespaldo(nombre, previa.respaldo);
      setEstado({ fase: "previa", fileId: subido.file_id, previa, error: null, aplicando: false });
    } catch (e) {
      setEstado({ fase: "error", archivo: archivo.name, error: errorDeActualizacion(e, "No se pudo comparar la versión nueva") });
    }
  };

  const aplicar = async () => {
    if (estado.fase !== "previa") return;
    const { fileId, previa } = estado;
    setEstado({ ...estado, aplicando: true, error: null });
    try {
      const resultado = await apiCargaActualizarRespuestas({ nombre, data_file_id: fileId });
      guardarRespaldo(nombre, resultado.respaldo);
      setEstado({ fase: "aplicada", resultado, error: null, revirtiendo: false });
      await onCambio(await apiEstudioGet());
    } catch (e) {
      setEstado({ fase: "previa", fileId, previa, aplicando: false, error: errorDeActualizacion(e, "No se pudo aplicar la actualización") });
    }
  };

  const revertir = async () => {
    if (estado.fase === "aplicada") setEstado({ ...estado, revirtiendo: true, error: null });
    try {
      const r = await apiCargaRevertirActualizacion({ nombre });
      guardarRespaldo(nombre, r.respaldo);
      setEstado({ fase: "revertida", archivo: r.archivo });
      await onCambio(await apiEstudioGet());
    } catch (e) {
      const error = errorDeActualizacion(e, "No se pudo volver a la versión anterior");
      // Sin copia (409 E_CARGA_ACTUALIZAR_SIN_COPIA) el botón deja de ofrecerse: no hay a qué volver.
      const sinCopia = e instanceof ApiError && e.code === "E_CARGA_ACTUALIZAR_SIN_COPIA";
      if (sinCopia) guardarRespaldo(nombre, null);
      if (estado.fase === "aplicada") {
        const resultado = sinCopia ? { ...estado.resultado, respaldo: null } : estado.resultado;
        setEstado({ ...estado, resultado, revirtiendo: false, error });
      }
      else setEstado({ fase: "error", archivo: "", error });
    }
  };

  const aplicando = estado.fase === "previa" && estado.aplicando;
  const revirtiendo = estado.fase === "aplicada" && estado.revirtiendo;
  const trabajando = estado.fase === "leyendo" || aplicando || revirtiendo;
  const copiaLegible = (estado.fase === "aplicada" ? estado.resultado.respaldo : respaldo)?.legible === true;

  const volver = (
    <PulsoButton variant="secondary" size="lg" disabled={ocupado || trabajando} onClick={() => void revertir()}>
      <Undo2 size={14} aria-hidden="true" />{revirtiendo ? "Volviendo" : "Volver a la versión anterior"}
    </PulsoButton>
  );

  let cuerpo: ReactNode;
  let pie: ReactNode;
  let hint: ReactNode | undefined = null;

  if (!fila || !modo) {
    cuerpo = (
      <Alert kind="warn">
        {fila ? `${fila.etiqueta} no recibe una versión nueva desde aquí.` : "El enlace no nombra una base del estudio."}
      </Alert>
    );
    pie = null;
  } else if (modo === "plataforma") {
    cuerpo = (
      <Alert kind="warn">
        <strong>Sin vista previa para {origen || "la plataforma"}.</strong>{" "}
        {causaSinVistaPreviaDePlataforma(origen || "la plataforma")}
      </Alert>
    );
  } else if (estado.fase === "elegir") {
    cuerpo = (
      <>
        <ElegirArchivo disabled={ocupado} onElegir={(a) => void leer(a)} />
        {respaldo?.legible ? (
          <Alert kind="info" acciones={volver}>{lineaDeRespaldo(respaldo)}</Alert>
        ) : null}
      </>
    );
    hint = COPIA;
  } else if (estado.fase === "leyendo") {
    cuerpo = <PasosDeLectura archivo={estado.archivo} etapa={estado.etapa} />;
    hint = "Nada cambia hasta que apliques.";
  } else if (estado.fase === "error") {
    cuerpo = (
      <ErrorBlock
        variante="enmarcado"
        label={estado.error.titulo}
        causa={estado.error.causa}
        queda="La base sigue como estaba."
        acciones={(
          <PulsoButton variant="primary" size="lg" onClick={() => setEstado({ fase: "elegir" })}>
            Elegir otro archivo
          </PulsoButton>
        )}
      />
    );
    hint = undefined;
  } else if (estado.fase === "previa") {
    cuerpo = (
      <>
        {estado.error ? (
          <ErrorBlock variante="enmarcado" label={estado.error.titulo} causa={estado.error.causa} queda="La base sigue como estaba." />
        ) : null}
        <QueCambia cambios={estado.previa} formulario={estado.previa.formulario} fases={estado.previa.fases} decisiones={estado.previa.decisiones} />
      </>
    );
    hint = COPIA;
  } else if (estado.fase === "aplicada") {
    const r = estado.resultado;
    cuerpo = (
      <>
        <Alert kind="info">
          {r.archivo ? `Las respuestas de ${fila.etiqueta} vienen ahora de "${r.archivo}".` : `Se aplicó la versión nueva de ${fila.etiqueta}.`}
        </Alert>
        {estado.error ? (
          <ErrorBlock variante="enmarcado" label={estado.error.titulo} causa={estado.error.causa} queda="La versión nueva sigue aplicada." />
        ) : null}
        <QueCambia cambios={r.cambios} formulario={null} fases={r.fases} decisiones={r.decisiones} />
      </>
    );
    hint = lineaDeRespaldo(r.respaldo);
  } else {
    cuerpo = (
      <Alert kind="info">
        {estado.archivo ? `${fila.etiqueta} volvió a "${estado.archivo}". Si la base tenía la codificación aplicada, hay que aplicarla otra vez.` : `${fila.etiqueta} volvió a la versión anterior.`}
      </Alert>
    );
    hint = "La copia se usó y ya no está.";
  }

  if (fila && modo === "archivo") {
    if (estado.fase === "previa" || estado.fase === "elegir" || estado.fase === "leyendo") {
      pie = (
        <>
          <PulsoButton variant="secondary" size="lg" onClick={cerrar} disabled={aplicando}>
            Cancelar
          </PulsoButton>
          <PulsoButton
            variant="primary"
            size="lg"
            className="pulso-actualizar-aplicar"
            disabled={estado.fase !== "previa" || ocupado || aplicando}
            onClick={() => void aplicar()}
          >
            <RefreshCw size={14} aria-hidden="true" />{aplicando ? "Aplicando" : "Aplicar actualización"}
          </PulsoButton>
        </>
      );
    } else if (estado.fase === "aplicada") {
      pie = (
        <>
          {copiaLegible ? volver : null}
          <PulsoButton variant="primary" size="lg" onClick={cerrar} disabled={revirtiendo}>
            <CheckCircle2 size={14} aria-hidden="true" />Listo
          </PulsoButton>
        </>
      );
    } else {
      pie = <PulsoButton variant="secondary" size="lg" onClick={cerrar}>Cerrar</PulsoButton>;
    }
  } else if (fila && modo === "plataforma") {
    pie = <PulsoButton variant="secondary" size="lg" onClick={cerrar}>Cerrar</PulsoButton>;
  }

  return (
    <Sideover
      panel={PANEL_ACTUALIZAR_FUENTE}
      title={titulo}
      subtitle={subtitulo}
      icon={<RefreshCw size={16} aria-hidden="true" />}
      className="pulso-actualizar"
      closeLabel="Cerrar la actualización de la fuente"
      dismissible={!trabajando}
      stepper={fila && modo === "archivo" ? <PasosDeActualizacion paso={pasoDe(estado)} /> : undefined}
      footerHint={hint}
      footer={pie}
    >
      <div
        className="pulso-actualizar-cuerpo"
        // Siempre lista: el panel abre por dirección en "elegir"; leer y aplicar solo empiezan con un clic
        // y su progreso lo dicen `aria-busy` y `data-actualizar-estado`.
        data-audit-ready="true"
        data-actualizar-estado={estado.fase}
        data-qa-geometry-group="carga/actualizar-cuerpo"
        data-qa-geometry-contract="intrinsic"
        aria-busy={trabajando || undefined}
      >
        {cuerpo}
      </div>
    </Sideover>
  );
}

function PasosDeLectura({ archivo, etapa }: { archivo: string; etapa: "subiendo" | "comparando" }) {
  const pasos = [
    { id: "subiendo", rotulo: "Subir el archivo", detalle: archivo },
    { id: "comparando", rotulo: "Comparar con la base cargada", detalle: null },
  ] as const;
  const actual = pasos.findIndex((p) => p.id === etapa);
  return (
    <ol className="pulso-actualizar-lectura" aria-label="Lectura de la versión nueva">
      {pasos.map((p, i) => {
        const e = i < actual ? "hecho" : i === actual ? "actual" : "pendiente";
        return (
          <li key={p.id} data-e={e} aria-current={e === "actual" ? "step" : undefined}>
            <i aria-hidden="true">{e === "hecho" ? <CheckCircle2 size={14} /> : null}</i>
            <span>
              <strong>{p.rotulo}</strong>
              {p.detalle ? <small>{p.detalle}</small> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
