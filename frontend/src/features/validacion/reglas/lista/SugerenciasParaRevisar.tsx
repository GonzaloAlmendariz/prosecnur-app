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
  onConvertir,
}: {
  ocupada: boolean;
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

  let cuerpo;
  if (lectura.fase === "cargando") {
    cuerpo = <p className="pulso-rl-sugerencias-estado">Leyendo la base.</p>;
  } else if (lectura.fase === "error") {
    cuerpo = <p className="pulso-rl-sugerencias-estado" data-tono="aviso">No se pudo leer la base: {lectura.mensaje}</p>;
  } else if (!sugerencias.length) {
    cuerpo = (
      <p className="pulso-rl-sugerencias-estado">
        {detector?.nTotal ? `Sin sugerencias en los ${formatoConteoDe(detector.nTotal, "caso")} de la base.` : "Sin sugerencias."}
      </p>
    );
  } else {
    cuerpo = (
      <ul
        className="pulso-rl-sugeridas-lista"
        data-qa-geometry-group="validacion/reglas-sugerencias"
        data-qa-geometry-contract="intrinsic"
      >
        {sugerencias.map((s) => {
          const linea = lineaDeConcentracion(s);
          return (
            <li key={s.id} className="pulso-rl-sugerencia-revisar" data-qa-geometry-member="">
              <div className="pulso-rl-sugerida-texto">
                <b>{s.titulo}</b>
                <span>{s.texto}</span>
                {linea ? (
                  <span className="pulso-rl-sugerencia-concentracion" data-destacada={linea.destacada ? "" : undefined}>
                    {linea.texto}
                  </span>
                ) : null}
              </div>
              <div className="pulso-rl-sugerencia-acciones">
                {s.casos.length ? (
                  <PulsoButton variant="secondary" size="sm" aria-label={`Ver los casos de ${s.titulo}`} onClick={() => casos.abrir(s.id)}>
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
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <section className="pulso-rl-sugeridas pulso-rl-sugerencias" aria-labelledby="pulso-rl-sugerencias-titulo">
      <h3 id="pulso-rl-sugerencias-titulo" className="pulso-rl-seccion-rotulo">
        <span>Sugerencias para revisar</span>
        {sugerencias.length ? <span className="pulso-rl-familias-n">{formatoConteo(sugerencias.length)}</span> : null}
      </h3>
      {sinRol && sugerencias.length ? <p className="pulso-rl-sugerencias-estado">{sinRol.texto}</p> : null}
      {otrosAvisos.map((a) => (
        <p key={a.codigo} className="pulso-rl-sugerencias-estado" data-tono="aviso">{a.texto}</p>
      ))}
      {cuerpo}
      {abierta ? (
        <DialogoDeCasos
          sugerencia={abierta}
          recopilador={detector?.recopilador?.variable ?? null}
          ocupada={ocupada}
          onCerrar={casos.cerrar}
          onConvertir={onConvertir}
        />
      ) : null}
    </section>
  );
}
