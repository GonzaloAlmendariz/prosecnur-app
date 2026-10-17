// Confirmación antes de rehacer el plan (H26).
//
// Rehacer el plan descarta fichas, recibos y publicaciones, y el plan está
// congelado a propósito: es lo que fue a imprenta. Por eso la escritura no se
// dispara al pulsar: primero se pide la previsualización (`dry_run: true`, que
// no muta nada) y el diálogo dice con cifras qué entra, qué sale y qué se
// conserva. Sólo «Rehacer el plan» llama al reseed real, con la MISMA revisión
// que se previsualizó: si el estado cambió en medio, el backend responde 409 y
// no se reemplaza nada que no se haya visto.
//
// Es un panel direccionable (`?panel=rehacer-plan`): se enlaza y el QA lo abre
// por su dirección. Diálogo de alerta (Radix): el foco entra en «Cancelar», la
// opción segura; Escape y el velo cancelan.

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useRef, useState } from "react";

import {
  apiRecopiladoresReseed,
  apiRecopiladoresReseedPreview,
  apiRecopiladoresState,
  type CollectionStatePayload,
} from "../../api/recopiladores";
import { PulsoButton } from "../../components/PulsoButton";
import type { ControlPanel } from "../../lib/navegacion/paneles";
import { Loader2, RotateCcw } from "../../vendor/lucide-react";
import {
  AVISO_PLAN_ACTUALIZADO,
  confirmarResembrado,
  leerPreviaDelResembrado,
  textoDelResembrado,
  type PreviaDelResembrado,
  type PuertoDelResembrado,
} from "./resembrado";
import "./styles/confirmarResembrado.css";

/** Una sola máquina de estados en vez de un racimo de `useState`. */
type Fase =
  | { tipo: "leyendo"; aviso: string }
  | { tipo: "error"; mensaje: string }
  | { tipo: "listo"; previa: PreviaDelResembrado; aviso: string }
  | { tipo: "rehaciendo"; previa: PreviaDelResembrado };

type Props = {
  panel: ControlPanel;
  /** `state_revision` vigente: la que se previsualiza y la que se confirma. */
  expectedRevision: number;
  onState: (payload: CollectionStatePayload) => void;
};

const PUERTO: PuertoDelResembrado = {
  previsualizar: apiRecopiladoresReseedPreview,
  rehacer: apiRecopiladoresReseed,
  leerVigente: apiRecopiladoresState,
};

const avisoDe = (fase: Fase) => (fase.tipo === "leyendo" || fase.tipo === "listo" ? fase.aviso : "");

export function ConfirmarResembrado({ panel, expectedRevision, onState }: Props) {
  const [fase, setFase] = useState<Fase>({ tipo: "leyendo", aviso: "" });
  const cancelarRef = useRef<HTMLButtonElement>(null);
  const { abierto, cerrar } = panel;

  // Abrir SÓLO previsualiza. Si el estado cambió (409), se repinta con el
  // vigente; su revisión nueva vuelve a disparar este efecto.
  useEffect(() => {
    if (!abierto) {
      setFase({ tipo: "leyendo", aviso: "" });
      return undefined;
    }
    let vigente = true;
    setFase((previa) => ({ tipo: "leyendo", aviso: avisoDe(previa) }));
    void leerPreviaDelResembrado(PUERTO, expectedRevision).then((resultado) => {
      if (!vigente) return;
      if (resultado.tipo === "refrescado") {
        setFase({ tipo: "leyendo", aviso: AVISO_PLAN_ACTUALIZADO });
        onState(resultado.payload);
      } else if (resultado.tipo === "error") {
        setFase({ tipo: "error", mensaje: resultado.mensaje });
      } else {
        setFase((previa) => ({ tipo: "listo", previa: resultado.previa, aviso: avisoDe(previa) }));
      }
    });
    return () => { vigente = false; };
  }, [abierto, expectedRevision, onState]);

  const confirmar = async (previa: PreviaDelResembrado) => {
    setFase({ tipo: "rehaciendo", previa });
    const resultado = await confirmarResembrado(PUERTO, previa);
    if (resultado.tipo === "hecho") {
      onState(resultado.payload);
      cerrar();
    } else if (resultado.tipo === "refrescado") {
      setFase({ tipo: "leyendo", aviso: AVISO_PLAN_ACTUALIZADO });
      onState(resultado.payload);
    } else {
      setFase({ tipo: "listo", previa, aviso: resultado.aviso });
    }
  };

  const previa = fase.tipo === "listo" || fase.tipo === "rehaciendo" ? fase.previa : null;
  const texto = previa ? textoDelResembrado(previa.descartado, previa.propuesto) : null;
  const rehaciendo = fase.tipo === "rehaciendo";

  return (
    <Dialog.Root open={abierto} onOpenChange={(siguiente) => { if (!siguiente && !rehaciendo) cerrar(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="rec-resembrar-velo" />
        <Dialog.Content
          role="alertdialog"
          className="rec-resembrar"
          {...panel.props}
          // Mientras lee la previsualización (dry_run) no está lista; en error
          // y con la previsualización cargada publica true.
          data-audit-ready={fase.tipo === "leyendo" ? "false" : "true"}
          aria-busy={fase.tipo === "leyendo" || rehaciendo}
          onOpenAutoFocus={(e) => { e.preventDefault(); cancelarRef.current?.focus({ preventScroll: true }); }}
        >
          <Dialog.Title className="rec-resembrar-titulo">
            ¿Rehacer el plan con el sorteo vigente?
          </Dialog.Title>
          <div
            className="rec-resembrar-cuerpo"
            data-qa-geometry-group="recopiladores-rehacer-plan"
            data-qa-geometry-contract="intrinsic"
          >
            {fase.tipo === "leyendo" ? (
              <p className="rec-resembrar-estado" data-qa-geometry-member>
                <Loader2 size={14} className="pulso-spin" aria-hidden /> Calculando qué cambia…
              </p>
            ) : null}
            {fase.tipo === "error" ? (
              <p className="rec-resembrar-error" role="alert" data-qa-geometry-member>{fase.mensaje}</p>
            ) : null}
            {texto ? (
              <>
                <Dialog.Description className="rec-resembrar-entra" data-qa-geometry-member>
                  <strong>{texto.entra}</strong>
                  {texto.sale ? <span>{texto.sale}</span> : null}
                </Dialog.Description>
                <section className="rec-resembrar-bloque is-descarta" data-qa-geometry-member aria-labelledby="rec-resembrar-descarta">
                  <h3 id="rec-resembrar-descarta">Se descarta</h3>
                  {texto.descarta.length ? (
                    <ul>{texto.descarta.map((linea) => <li key={linea}>{linea}</li>)}</ul>
                  ) : <p>Nada: no hay fichas, archivos ni despliegue que perder.</p>}
                </section>
                {texto.conserva.length ? (
                  <section className="rec-resembrar-bloque is-conserva" data-qa-geometry-member aria-labelledby="rec-resembrar-conserva">
                    <h3 id="rec-resembrar-conserva">Se conserva</h3>
                    <ul>{texto.conserva.map((linea) => <li key={linea}>{linea}</li>)}</ul>
                  </section>
                ) : null}
                {avisoDe(fase) ? (
                  <p className="rec-resembrar-error" role="alert" data-qa-geometry-member>{avisoDe(fase)}</p>
                ) : null}
              </>
            ) : null}
          </div>
          <div className="rec-resembrar-acciones">
            <Dialog.Close asChild>
              <PulsoButton ref={cancelarRef} variant="secondary" size="sm" disabled={rehaciendo}>
                Cancelar
              </PulsoButton>
            </Dialog.Close>
            <PulsoButton
              variant="danger"
              size="sm"
              disabled={!previa || rehaciendo}
              onClick={() => { if (previa) void confirmar(previa); }}
            >
              {rehaciendo
                ? <Loader2 size={14} className="pulso-spin" aria-hidden />
                : <RotateCcw size={14} aria-hidden />}
              {rehaciendo ? "Rehaciendo…" : (texto?.confirmar ?? "Rehacer el plan")}
            </PulsoButton>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
