/**
 * "Sugerencias para revisar" (ítem 31): lo que el detector de consistencia
 * encuentra en la base y no cuadra, para que el analista lo evalúe. No son
 * reglas: cada una trae su frase y su cifra, "Ver casos" (diálogo direccionable,
 * `panel=sugerencia&foco=<id>`) y, si aplica, "Convertir en regla", que abre el
 * panel de regla armado con ella, como "Añadir" en las sugeridas.
 *
 * Va bajo las sugeridas de la base, en la columna de las reglas propias.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Dialog } from "../../../../components/Dialog";
import { PulsoButton } from "../../../../components/PulsoButton";
import { PulsoTable, type PulsoTableColumna } from "../../../../components/PulsoTable";
import { formatoConteo, formatoConteoDe } from "../../../../lib/formatoNumero";
import { useDireccion } from "../../../../lib/navegacion/useDireccion";
import { usePanelDireccionable } from "../../../../lib/navegacion/paneles";
import {
  pedirDetectorDeConsistencia,
  type CasoDeSugerencia,
  type DetectorDeConsistencia,
  type SugerenciaParaRevisar,
} from "../../../../api/validacionDetector";
import { PANEL_SUGERENCIA_VALIDACION } from "../../panelesValidacion";
import { useValidacionStore } from "../../store";
import type { ReglaSemilla } from "../../types";
import {
  columnasDeCasos,
  lineaDeConcentracion,
  searchConCasosDeSugerencia,
  searchSinCasosDeSugerencia,
} from "./modeloSugerencias";
import { BloqueDelRecomendador } from "./BloqueDelRecomendador";
import {
  datosPersonales,
  esDatoPersonal,
  presentarSugerencia,
  ROTULO_DATO_PERSONAL,
  type ColumnaPersonal,
  type IndiceDePreguntas,
} from "./modeloRecomendador";
import { FraseDelRecomendador, TarjetaDelRecomendador } from "./PiezasDelRecomendador";
import "./sugerenciasParaRevisar.css";

type Lectura =
  | { fase: "cargando" }
  | { fase: "error"; mensaje: string }
  | { fase: "lista"; detector: DetectorDeConsistencia };

function useDetector(): Lectura {
  const baseNombre = useValidacionStore((s) => s.baseNombre);
  const version = useValidacionStore((s) => s.version);
  const [lectura, setLectura] = useState<Lectura>({ fase: "cargando" });
  useEffect(() => {
    let vigente = true;
    setLectura({ fase: "cargando" });
    pedirDetectorDeConsistencia(baseNombre)
      .then((detector) => { if (vigente) setLectura({ fase: "lista", detector }); })
      .catch((e: unknown) => {
        if (vigente) setLectura({ fase: "error", mensaje: e instanceof Error ? e.message : String(e) });
      });
    return () => { vigente = false; };
  }, [baseNombre, version]);
  return lectura;
}

function useCasosDeSugerencia() {
  const control = usePanelDireccionable(PANEL_SUGERENCIA_VALIDACION);
  const direccion = useDireccion();
  const location = useLocation();
  const navigate = useNavigate();
  const escribir = useCallback(
    (search: string) => navigate({ pathname: location.pathname, search }, { replace: true }),
    [location.pathname, navigate],
  );
  return {
    abierta: control.abierto ? direccion?.foco ?? null : null,
    abrir: (id: string) => escribir(searchConCasosDeSugerencia(location.search, id)),
    cerrar: () => escribir(searchSinCasosDeSugerencia(location.search)),
  };
}

function DialogoDeCasos({
  sugerencia,
  recopilador,
  ocupada,
  onCerrar,
  onConvertir,
}: {
  sugerencia: SugerenciaParaRevisar;
  recopilador: string | null;
  ocupada: boolean;
  onCerrar: () => void;
  onConvertir: (regla: ReglaSemilla) => void;
}) {
  const columnas = useMemo<PulsoTableColumna<CasoDeSugerencia>[]>(
    () => columnasDeCasos(sugerencia, recopilador).map((c) => ({
      id: c.id,
      encabezado: c.encabezado,
      ancho: c.id === "fila" ? 72 : c.id === "recopilador" ? 200 : 140,
      tipo: c.id === "fila" ? "cifra" : "texto",
      celda: (fila) => c.valor(fila),
      valor: (fila) => c.valor(fila),
    })),
    [sugerencia, recopilador],
  );
  const total = sugerencia.nCasos ?? sugerencia.casos.length;
  const regla = sugerencia.regla;
  return (
    <Dialog
      open
      onOpenChange={(abierto) => { if (!abierto) onCerrar(); }}
      size="lg"
      alto="fijo"
      title={sugerencia.titulo}
      subtitle={sugerencia.casos.length < total
        ? `Se muestran ${formatoConteo(sugerencia.casos.length)} de ${formatoConteoDe(total, "caso")}.`
        : formatoConteoDe(total, "caso")}
      footer={regla ? (
        <PulsoButton variant="primary" disabled={ocupada} onClick={() => { onCerrar(); onConvertir(regla); }}>
          Convertir en regla
        </PulsoButton>
      ) : undefined}
    >
      <PulsoTable
        columnas={columnas}
        filas={sugerencia.casos}
        idDeFila={(c) => `${c.fila ?? ""}`}
        ariaLabel={`Casos de ${sugerencia.titulo}`}
        densidad="compacta"
        altoMaximo={100_000}
        vacio="La sugerencia no trae casos."
      />
    </Dialog>
  );
}

export function SugerenciasParaRevisar({
  ocupada,
  indice,
  onConvertir,
}: {
  ocupada: boolean;
  /** Etiqueta y tipo de cada columna del inventario, para las preguntas que el detector manda sin rótulo. */
  indice?: IndiceDePreguntas;
  /** "Convertir en regla": abre el panel de regla armado con la regla de la sugerencia. */
  onConvertir: (regla: ReglaSemilla) => void;
}) {
  const lectura = useDetector();
  const casos = useCasosDeSugerencia();
  const detector = lectura.fase === "lista" ? lectura.detector : null;
  if (detector?.estado === "sin_datos") return null;
  const sugerencias = detector?.sugerencias ?? [];
  const abierta = sugerencias.find((s) => s.id === casos.abierta) ?? null;
  const sinRol = detector?.avisos.find((a) => a.codigo === "sin_recopilador") ?? null;
  const otrosAvisos = detector?.avisos.filter((a) => a.codigo !== "sin_recopilador") ?? [];

  let estado: string | undefined;
  if (lectura.fase === "error") estado = `No se pudo leer la base: ${lectura.mensaje}`;
  else if (lectura.fase === "lista" && !sugerencias.length) {
    estado = detector?.nTotal ? `Sin sugerencias en los ${formatoConteoDe(detector.nTotal, "caso")} de la base.` : "Sin sugerencias.";
  }

  const avisos = (
    <>
      {sinRol && sugerencias.length ? <p className="pulso-rl-rec-estado">{sinRol.texto}</p> : null}
      {otrosAvisos.map((a) => (
        <p key={a.codigo} className="pulso-rl-rec-estado" data-tono="aviso">{a.texto}</p>
      ))}
    </>
  );

  return (
    <>
      <BloqueDelRecomendador
        id="pulso-rl-sugerencias-titulo"
        className="pulso-rl-sugerencias"
        titulo="Sugerencias para revisar"
        conteo={sugerencias.length}
        grupo="validacion/reglas-sugerencias"
        cargando={lectura.fase === "cargando"}
        etiquetaDeCarga="Revisando la consistencia de la base"
        avisos={avisos}
        estado={estado}
        estadoEsAviso={lectura.fase === "error"}
      >
        {sugerencias.length ? sugerencias.map((s) => (
          <TarjetaDeSugerencia
            key={s.id}
            sugerencia={s}
            indice={indice}
            ocupada={ocupada}
            onVerCasos={() => casos.abrir(s.id)}
            onConvertir={onConvertir}
          />
        )) : null}
      </BloqueDelRecomendador>
      {abierta ? (
        <DialogoDeCasos
          sugerencia={abierta}
          recopilador={detector?.recopilador?.variable ?? null}
          ocupada={ocupada}
          onCerrar={casos.cerrar}
          onConvertir={onConvertir}
        />
      ) : null}
    </>
  );
}

function TarjetaDeSugerencia({
  sugerencia: s,
  indice,
  ocupada,
  onVerCasos,
  onConvertir,
}: {
  sugerencia: SugerenciaParaRevisar;
  indice?: IndiceDePreguntas;
  ocupada: boolean;
  onVerCasos: () => void;
  onConvertir: (regla: ReglaSemilla) => void;
}) {
  const linea = lineaDeConcentracion(s);
  const acciones = s.casos.length || s.regla ? (
    <>
      {s.casos.length ? (
        <PulsoButton variant="secondary" size="sm" aria-label={`Ver los casos de ${s.titulo}`} onClick={onVerCasos}>
          Ver casos
        </PulsoButton>
      ) : null}
      {s.regla ? (
        <PulsoButton
          variant="secondary"
          size="sm"
          disabled={ocupada}
          aria-label={`Convertir en regla ${s.titulo}`}
          onClick={() => s.regla && onConvertir(s.regla)}
        >
          Convertir en regla
        </PulsoButton>
      ) : null}
    </>
  ) : undefined;
  const pie = linea ? (
    <span className="pulso-rl-rec-concentracion" data-destacada={linea.destacada ? "" : undefined}>{linea.texto}</span>
  ) : undefined;

  if (esDatoPersonal(s)) {
    const { columnas, nota } = datosPersonales(s, indice);
    return (
      <TarjetaDelRecomendador
        titulo={(
          <>
            {ROTULO_DATO_PERSONAL}
            <span className="pulso-rl-rec-titulo-meta">{formatoConteoDe(columnas.length, "columna")}</span>
          </>
        )}
        pie={pie}
        acciones={acciones}
      >
        <ListaDePersonales columnas={columnas} />
        {nota ? <p className="pulso-rl-rec-nota">{nota}</p> : null}
      </TarjetaDelRecomendador>
    );
  }

  const vista = presentarSugerencia(s, indice);
  return (
    <TarjetaDelRecomendador
      titulo={<FraseDelRecomendador piezas={vista.titulo} />}
      preguntas={vista.preguntas}
      pie={pie}
      acciones={acciones}
    >
      {vista.frase.length ? <p className="pulso-rl-rec-frase"><FraseDelRecomendador piezas={vista.frase} /></p> : null}
    </TarjetaDelRecomendador>
  );
}

/** Una fila por columna: el enunciado de la pregunta con su nombre debajo, y la causa. */
function ListaDePersonales({ columnas }: { columnas: readonly ColumnaPersonal[] }) {
  return (
    <ul className="pulso-rl-rec-personales" aria-label="Columnas con dato potencialmente personal">
      {columnas.map((c) => (
        <li key={c.pregunta.codigo} className="pulso-rl-rec-personal">
          <span className="pulso-rl-rec-personal-pregunta">
            {/* TODO(ítem 40): una columna fuera del formulario y sin etiqueta en la base llega sin
                enunciado (el motor manda `rotulo` = NA y el inventario repite el nombre); se muestra el nombre. */}
            <span className="pulso-rl-rec-personal-etiqueta">{c.pregunta.etiqueta ?? c.pregunta.codigo}</span>
            {c.pregunta.etiqueta ? <code className="pulso-rl-rec-codigo">{c.pregunta.codigo}</code> : null}
          </span>
          <span className="pulso-rl-rec-personal-causa">
            {c.causa ? <span>{c.causa}</span> : null}
            {c.detalle ? <small>{c.detalle}</small> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
