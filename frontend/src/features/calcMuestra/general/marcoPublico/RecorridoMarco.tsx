/**
 * Actores › Marco de un público (D6): el archivo del cliente en cuatro pasos (archivo, columnas, quién se invita y
 * segmentos) y, al guardar, el marco declarado con su receta: el actor recibe su N y un estrato por segmento.
 * Se abre con `?seccion=actores&panel=marco&foco=<componente_id>` y reemplaza la tabla de actores.
 */
import { useState, type ReactNode } from "react";
import { ArrowLeft, Check, FileUp, User } from "lucide-react";

import type { CalcMuestraComponente } from "../../../../api/calcMuestra";
import { apiMarcoPublicoDeclarar } from "../../../../api/calcMuestraMarcoPublico";
import { Alert } from "../../../../components/Alert";
import { CabeceraDePestana } from "../../../../components/procesamiento/CabeceraDePestana";
import { MesaDePestana } from "../../../../components/procesamiento/MesaDePestana";
import { PanelDeMesa } from "../../../../components/procesamiento/PanelDeMesa";
import { PulsoButton } from "../../../../components/PulsoButton";
import { useCalcMuestraStore } from "../../store";
import { actorVisual } from "../catalogos";
import { reconciliarEstudio } from "../modelo";
import { useMuestraGeneralStore } from "../store";
import { guardarEstudioPendiente } from "../useMuestraGeneral";
import {
  columnasConUso,
  conRotulo,
  ESTADO_MARCO_INICIAL,
  motivoNoAvanzar,
  PASOS_MARCO,
  recetaDe,
  usoDe,
  type EstadoMarco,
  type PasoMarco,
} from "./modeloMarco";
import { PasoArchivo } from "./PasoArchivo";
import { PasosDelMarco } from "./PasosDelMarco";
import { PasoColumnas } from "./PasoColumnas";
import { PasoInvitados, useEmbudo } from "./PasoInvitados";
import { PasoSegmentos, useCruce } from "./PasoSegmentos";
import { cifra, conCortes, errorLegible, Pastilla } from "./piezas";
import { ValoresConRotulo } from "./ValoresConRotulo";
import { useRecorridoMarcoStore } from "./store";
import { fmtInt } from "../../sharedCore";
import "./marcoPublico.css";

export function RecorridoMarco({ componente, onCerrar, lateral, onPoblacionManual, cancelable = false }: {
  componente: CalcMuestraComponente;
  onCerrar: () => void;
  /** La columna izquierda de la sección (la lista de actores); con ella la mesa es de tres columnas. */
  lateral?: ReactNode;
  /** Sin base todavía: la población del actor se escribe a mano (una propuesta antes de recibir las bases). */
  onPoblacionManual?: (n: number) => void;
  /** Hay un marco guardado al que se puede volver sin cambiarlo. */
  cancelable?: boolean;
}) {
  const actor = actorVisual(componente).label;
  const estado = useRecorridoMarcoStore((s) => s.porActor[componente.id]) ?? ESTADO_MARCO_INICIAL;
  const paso = useRecorridoMarcoStore((s) => s.paso[componente.id]) ?? "archivo";
  const actualizar = useRecorridoMarcoStore((s) => s.actualizar);
  const irAPaso = useRecorridoMarcoStore((s) => s.irAPaso);
  const descartar = useRecorridoMarcoStore((s) => s.descartar);
  const [colElegida, setColElegida] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cambiar = (e: EstadoMarco) => actualizar(componente.id, () => e);
  const { embudo, leyendo: leyendoEmbudo, error: errorEmbudo } = useEmbudo(estado);
  const { cruce, leyendo: leyendoCruce, error: errorCruce } = useCruce(estado);

  const indice = PASOS_MARCO.findIndex((p) => p.id === paso);
  const ultimo = indice === PASOS_MARCO.length - 1;
  const motivo = motivoNoAvanzar(paso, estado, cruce);
  // Un paso queda disponible cuando todos los anteriores se pueden dejar.
  const disponible = (k: number) => PASOS_MARCO.slice(0, k).every((p) => motivoNoAvanzar(p.id, estado, cruce) === null);

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      await guardarEstudioPendiente();
      const enviado = useCalcMuestraStore.getState().estudio;
      const res = await apiMarcoPublicoDeclarar({ componenteId: componente.id, fileId: estado.fileId, hoja: estado.hoja, receta: recetaDe(estado) });
      const store = useCalcMuestraStore.getState();
      const reconciliado = reconciliarEstudio({
        componenteId: componente.id, actual: store.estudio, enviado, estudioRespuesta: res.estudio, componenteRespuesta: res.componente,
      });
      if (reconciliado?.limpio) store.hydrate(reconciliado.estudio);
      else if (reconciliado) store.replaceEstudio(reconciliado.estudio);
      await useMuestraGeneralStore.getState().cargar({ forzar: true });
      descartar(componente.id);
      onCerrar();
    } catch (e) {
      setError(errorLegible(e));
    } finally {
      setGuardando(false);
    }
  }

  // Cancelar descarta lo leído: el marco guardado vuelve a verse tal cual.
  const volver = () => {
    if (indice > 0) irAPaso(componente.id, PASOS_MARCO[indice - 1].id);
    else { descartar(componente.id); onCerrar(); }
  };
  const hayDondeVolver = indice > 0 || !lateral || cancelable;
  // La lista de actores acompaña al primer paso; en los siguientes la tabla necesita el ancho.
  const conLateral = Boolean(lateral) && paso === "archivo";
  const seguir = () => (ultimo ? void guardar() : irAPaso(componente.id, PASOS_MARCO[indice + 1].id));

  return (
    <MesaDePestana
      grupo="calc-muestra/marco-publico"
      columnas={conLateral ? 3 : 2}
      cabecera={(
        <CabeceraDePestana
          seccion="Marco"
          titulo={actor}
          icono={FileUp}
          estado={{ tono: "parcial", texto: "Sin guardar" }}
          acciones={(
            <>
              {hayDondeVolver ? (
                <PulsoButton variant="secondary" size="sm" onClick={volver} disabled={guardando}>
                  <ArrowLeft size={14} aria-hidden="true" /> {indice > 0 ? "Volver" : "Cancelar"}
                </PulsoButton>
              ) : null}
              <PulsoButton variant="primary" size="sm" onClick={seguir} disabled={guardando || motivo !== null} title={motivo ?? undefined}>
                {ultimo ? <><Check size={14} aria-hidden="true" /> Guardar el marco</> : "Siguiente"}
              </PulsoButton>
            </>
          )}
        />
      )}
      avisos={error || (motivo && indice > 0) ? (
        <Alert kind={error ? "error" : "warn"}>{error ?? motivo}</Alert>
      ) : undefined}
      franja={(
        <PasosDelMarco
          etiqueta={`Pasos del marco de ${actor}`}
          actual={paso}
          disponible={disponible}
          onIr={(p) => irAPaso(componente.id, p)}
        />
      )}
    >
      {conLateral ? lateral : null}
      {paso === "archivo" && (
        <PasoArchivo
          estado={estado}
          onCambio={cambiar}
          poblacionManual={onPoblacionManual ? { valor: componente.marco.marco_validado, onGuardar: onPoblacionManual } : undefined}
          conteos={{ componenteId: componente.id, actor, onGuardado: () => { descartar(componente.id); onCerrar(); } }}
        />
      )}
      {paso === "columnas" && <PasoColumnas estado={estado} colElegida={colElegida} onElegir={setColElegida} onCambio={cambiar} />}
      {paso === "invitados" && <PasoInvitados estado={estado} embudo={embudo} leyendo={leyendoEmbudo} error={errorEmbudo} onCambio={cambiar} />}
      {paso === "segmentos" && <PasoSegmentos estado={estado} cruce={cruce} leyendo={leyendoCruce} error={errorCruce} onCambio={cambiar} />}
      <ResumenMarco actor={actor} estado={estado} paso={paso} colElegida={colElegida} invitados={embudo?.invitados ?? null} onCambio={cambiar} />
    </MesaDePestana>
  );
}

function ResumenMarco({ actor, estado, paso, colElegida, invitados, onCambio }: {
  actor: string; estado: EstadoMarco; paso: PasoMarco; colElegida: string; invitados: number | null;
  onCambio: (e: EstadoMarco) => void;
}) {
  const lectura = estado.lectura;
  const roles: Array<[string, string[], boolean]> = [
    ["Identificador", columnasConUso(estado, "id"), false],
    ["Correo de envío", columnasConUso(estado, "correo"), false],
    ["Para cuotas", columnasConUso(estado, "cuota"), true],
    ["Para reglas", columnasConUso(estado, "regla"), true],
  ];
  const col = lectura?.columnas.find((c) => c.nombre === colElegida)
    ?? lectura?.columnas.find((c) => usoDe(c, estado.usos) === "cuota");
  return (
    <PanelDeMesa zona="marco-resumen" titulo={`${actor}, hasta aquí`} icono={<User size={15} aria-hidden="true" />}>
      <div className="cmmp-cifras">
        <div><strong>{lectura ? cifra(lectura.filas) : "Sin archivo"}</strong><small>filas en la base</small></div>
        <div><strong>{paso === "archivo" || paso === "columnas" || invitados == null ? <span className="cmmp-suave">Por definir</span> : cifra(invitados)}</strong><small>se invitan</small></div>
      </div>
      {lectura ? (
        <section className="cmmp-sec" aria-label="Lo que se leyó">
          <h4>Lo que se leyó</h4>
          <div className="cmmp-leido">
            <Pastilla>{estado.nombreArchivo}</Pastilla>
            {estado.hoja ? <Pastilla>{estado.hoja}</Pastilla> : null}
          </div>
          <dl className="cmmp-roles">
            {roles.map(([t, cols, opcional]) => (
              <div key={t}>
                <dt>{t}</dt>
                <dd>{cols.length ? cols.map((c) => <span key={c} className="cmmp-nombre-col">{conCortes(c)}</span>) : opcional ? <span className="cmmp-suave">Ninguna</span> : <em>Por elegir</em>}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
      {paso === "columnas" && col ? (
        <section className="cmmp-sec" aria-label={`Valores de ${col.nombre}`}>
          <h4><span className="cmmp-nombre-col">{conCortes(col.nombre)}</span>{col.distribucion.length ? <span>{col.distribucion.length > 8 ? "8 más frecuentes" : `${fmtInt(col.distribucion.length)} valores`}</span> : null}</h4>
          {col.distribucion.length ? (
            <ValoresConRotulo
              columna={col.nombre}
              valores={col.distribucion}
              rotulos={estado.rotulos[col.nombre] ?? {}}
              onRotulo={(valor, rotulo) => onCambio({ ...estado, rotulos: conRotulo(estado, col.nombre, valor, rotulo) })}
            />
          ) : <p className="cmmp-vacio-chico">Sus valores no se muestran: es un dato personal o casi todos son distintos.</p>}
        </section>
      ) : null}
    </PanelDeMesa>
  );
}
