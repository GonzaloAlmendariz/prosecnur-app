/**
 * El caso completo (prototipo `panelCaso`, `vistas.js:206`; dirección
 * `panel=caso&foco=<id_caso>`): quién respondió, cuándo y en cuánto tiempo,
 * en qué hallazgos aparece y sus respuestas por sección, con la que falla
 * resaltada, la vacía por salto dicha como tal y el código especial con su
 * rótulo (M4). Las flechas pasan por los casos del hallazgo abierto.
 *
 * El panel es el del kit (`Sideover`): la línea de quién y cuándo va bajo el
 * título y las flechas en la banda bajo la cabecera, porque la cabecera del kit
 * no lleva acciones propias. Por defecto enseña las secciones con preguntas de
 * sus hallazgos; "Ver todas las secciones" enseña las demás.
 */
import { rotuloDeCaso } from "../rotuloDeCaso";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Table2 } from "../../../vendor/lucide-react";
import { Sideover } from "../../../components/Sideover";
import { Panel } from "../../../components/Panel";
import { PulsoButton } from "../../../components/PulsoButton";
import { ErrorBlock } from "../../../components/States";
import { causaDelError, identificadorDelError } from "../../../components/errorPresentation";
import { CargaDeBloque } from "../../../components/CargaDeBloque";
import { formatoConteo } from "../../../lib/formatoNumero";
import type { VariableDelCaso } from "../../../api/validacionAuditoria";
import { antetituloDelCaso, respondidasDeSeccion, rotuloDeClase, seccionesDelHallazgo, valorDeRespuesta } from "./modeloHallazgos";
import { useCaso } from "./useCaso";
import { CorreccionDeCatalogo } from "./CorreccionDeCatalogo";

function etiquetaDeOrigen(v: VariableDelCaso): string | null {
  if (v.origen === "calculada") return "Calculada";
  if (v.origen === "metadato") return "Del dispositivo";
  return null;
}

export function PanelCaso({
  abierto,
  idCaso,
  casos,
  pendientes,
  baseNombre,
  onIr,
  onCerrar,
  onVerEnRespuestas,
  onCorregida,
}: {
  abierto: boolean;
  idCaso: string | null;
  /** Los casos del hallazgo abierto, en su orden: las flechas los recorren. */
  casos: readonly string[];
  /** Si cada regla de la cola está por decidir, por su id. */
  pendientes: ReadonlyMap<string, boolean>;
  baseNombre: string | null;
  onIr: (id: string) => void;
  onCerrar: () => void;
  onVerEnRespuestas: () => void;
  /** Después de registrar una corrección de catálogo: vuelve a leer la cola. */
  onCorregida?: () => void;
}) {
  const lectura = useCaso(abierto ? idCaso : null, baseNombre);
  const [todas, setTodas] = useState(false);
  const caso = lectura.fase === "lista" ? lectura.caso : null;
  const i = idCaso ? casos.indexOf(idCaso) : -1;
  const anterior = i > 0 ? casos[i - 1] : null;
  const siguiente = i >= 0 && i < casos.length - 1 ? casos[i + 1] : null;

  // Las preguntas de sus hallazgos, con el tono de su clase (la inconsistencia gana).
  const tonoDe = useMemo(() => {
    const tonos = new Map<string, "inconsistencia" | "revisar">();
    for (const h of caso?.hallazgos ?? []) {
      for (const v of h.variables) {
        if (tonos.get(v.variable) !== "inconsistencia") tonos.set(v.variable, h.clase === "caso_a_revisar" ? "revisar" : "inconsistencia");
      }
    }
    return tonos;
  }, [caso]);
  const delHallazgo = useMemo(() => new Set(tonoDe.keys()), [tonoDe]);
  const secciones = caso ? (todas ? caso.secciones : seccionesDelHallazgo(caso.secciones, delHallazgo)) : [];
  const muestraTodas = !caso || secciones.length === caso.secciones.length;

  return (
    <Sideover
      open={abierto}
      onOpenChange={(a) => { if (!a) onCerrar(); }}
      className="pulso-hz-caso"
      title={idCaso ? `Caso ${rotuloDeCaso(idCaso).texto}` : "Caso"}
      subtitle={caso ? antetituloDelCaso(caso.metadatos) ?? undefined : undefined}
      closeLabel="Cerrar el caso"
      stepper={casos.length > 1 && i >= 0 ? (
        <div className="pulso-hz-caso-nav">
          <PulsoButton variant="icon" size="sm" aria-label="Caso anterior" disabled={!anterior} onClick={() => anterior && onIr(anterior)}>
            <ChevronLeft size={15} aria-hidden="true" />
          </PulsoButton>
          <span>{formatoConteo(i + 1)} de {formatoConteo(casos.length)} casos del hallazgo</span>
          <PulsoButton variant="icon" size="sm" aria-label="Caso siguiente" disabled={!siguiente} onClick={() => siguiente && onIr(siguiente)}>
            <ChevronRight size={15} aria-hidden="true" />
          </PulsoButton>
        </div>
      ) : undefined}
      footerStatus={caso && caso.secciones.length ? (
        <span>
          Se muestran {formatoConteo(secciones.length)} de {formatoConteo(caso.secciones.length)} {caso.secciones.length === 1 ? "sección" : "secciones"}.
        </span>
      ) : undefined}
      footer={(
        <>
          {caso && !muestraTodas ? (
            <PulsoButton variant="secondary" size="lg" onClick={() => setTodas(true)}>Ver todas las secciones</PulsoButton>
          ) : null}
          <PulsoButton variant="secondary" size="lg" onClick={onVerEnRespuestas}>
            <Table2 size={14} aria-hidden="true" />
            Ver en Respuestas
          </PulsoButton>
          <PulsoButton variant="secondary" size="lg" onClick={onCerrar}>Cerrar</PulsoButton>
        </>
      )}
    >
      <div className="pulso-hz-caso-cuerpo">
        {lectura.fase === "cargando" ? <CargaDeBloque label="Leyendo el caso" /> : null}
        {lectura.fase === "error" ? (
          <ErrorBlock
            label="No se pudo leer el caso"
            causa={causaDelError(lectura.mensaje)}
            queda="Las decisiones guardadas no cambiaron."
            identificador={identificadorDelError(lectura.mensaje)}
            acciones={<PulsoButton variant="primary" onClick={lectura.reintentar}>Reintentar</PulsoButton>}
          />
        ) : null}
        {caso ? (
          <>
            {caso.avisos.map((a) => (
              <p key={a.codigo} className="pulso-hz-aviso" data-tono="aviso">{a.texto}</p>
            ))}
            {caso.hallazgos.length ? (
              <Panel noPadding className="pulso-hz-caso-caja" title={`Aparece en ${caso.hallazgos.length === 1 ? "1 hallazgo" : `${formatoConteo(caso.hallazgos.length)} hallazgos`}`}>
                <ul className="pulso-hz-en-hallazgos">
                  {caso.hallazgos.map((h) => {
                    const pendiente = pendientes.get(h.id_regla);
                    return (
                      <li key={h.id_regla}>
                        <span className="pulso-rl-clase" data-clase={h.clase === "caso_a_revisar" ? "revisar" : "inconsistencia"}>{rotuloDeClase(h.clase)}</span>
                        <b>{h.nombre ?? h.id_regla}</b>
                        <em>{pendiente === undefined ? "Fuera de la cola" : pendiente ? "Por decidir" : "Decidido"}</em>
                      </li>
                    );
                  })}
                </ul>
              </Panel>
            ) : null}
            {idCaso ? caso.hallazgos.filter((h) => h.roles && Object.keys(h.roles).length > 0).map((h) => (
              <CorreccionDeCatalogo
                key={`correccion-${h.id_regla}-${idCaso}`}
                hallazgo={h}
                idCaso={idCaso}
                baseNombre={baseNombre}
                onGuardada={onCorregida}
              />
            )) : null}
            {!caso.instrumento_leido ? (
              <p className="pulso-hz-aviso" data-tono="aviso">El formulario no se pudo leer: el caso no se puede mostrar por secciones.</p>
            ) : null}
            {secciones.map((s, k) => (
              <Panel
                key={`${s.seccion ?? "sin-seccion"}-${k}`}
                noPadding
                className="pulso-hz-caso-caja"
                title={s.etiqueta ?? s.seccion ?? "Fuera de una sección"}
                actions={<span className="pulso-hz-caso-respondidas">{respondidasDeSeccion(s)}</span>}
              >
                <dl className="pulso-hz-respuestas">
                  {s.variables.map((v) => {
                    const tono = tonoDe.get(v.variable);
                    const origen = etiquetaDeOrigen(v);
                    return (
                      <div
                        key={v.variable}
                        data-falla={tono}
                        data-estado={v.estado ?? undefined}
                      >
                        <dt>
                          <code>{v.variable}</code>
                          <span>{v.etiqueta ?? v.variable}</span>
                          {origen ? <small className="pulso-hz-origen-respuesta">{origen}</small> : null}
                        </dt>
                        <dd>
                          {tono ? <b className="pulso-hz-falla" data-tono={tono}>{valorDeRespuesta(v)}</b> : valorDeRespuesta(v)}
                          {v.fuera_de_opciones ? <small className="pulso-hz-nota-valor">Fuera de las opciones</small> : null}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </Panel>
            ))}
          </>
        ) : null}
      </div>
    </Sideover>
  );
}
