// =============================================================================
// shell/LogicaExterna.tsx — «La lógica y la limpieza se hicieron fuera»
// =============================================================================
// Tres piezas, una sola voz (textos en `logicaExternaModel.ts`):
//
// - `LogicaExternaDisparador`: la segunda vía junto a «Revisar lógica», con el
//   mismo peso secundario. Sólo abre el diálogo (dirección
//   `?panel=logica-externa&foco=<id>`).
// - `LogicaExternaDialogo`: mini-diálogo con «Programa» (sugerencias SPSS, R,
//   Stata, Excel) y nota opcional. Uno por módulo; lo monta el editor.
// - `LogicaExternaDeshacer`: acción discreta para retirar la declaración, con
//   confirmación en línea.
//
// Geometría: el diálogo tiene ancho fijo por rol y alto intrínseco (dos campos
// y un pie: no hay cardinalidad que lo haga crecer); sin scroll propio.
// =============================================================================

import { useState, type FormEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { PulsoButton } from "../../../components/PulsoButton";
import { X } from "../../../vendor/lucide-react";
import {
  CONSECUENCIA_DESHACER_LOGICA_EXTERNA,
  CONSECUENCIA_LOGICA_EXTERNA,
  NOMBRE_DECLARAR_LOGICA_EXTERNA,
  PROGRAMAS_SUGERIDOS,
  ROTULO_DECLARAR_LOGICA_EXTERNA,
  validarLogicaExterna,
} from "./logicaExternaModel";
import type { AccionesLogicaExterna, ControlLogicaExterna } from "./useLogicaExterna";
import "../styles/xf-logica-externa.css";

export function LogicaExternaDisparador({
  formId,
  acciones,
  disabled = false,
  className,
}: {
  formId: string;
  acciones: Pick<AccionesLogicaExterna, "abrirPara" | "enCursoId">;
  disabled?: boolean;
  /** Clase de la superficie anfitriona (tarjeta, popover o ventana). */
  className?: string;
}) {
  return (
    <button
      type="button"
      className={["pulso-xf-logica-externa-disparador", className].filter(Boolean).join(" ")}
      aria-label={NOMBRE_DECLARAR_LOGICA_EXTERNA}
      aria-haspopup="dialog"
      title={NOMBRE_DECLARAR_LOGICA_EXTERNA}
      disabled={disabled || acciones.enCursoId === formId}
      onClick={() => acciones.abrirPara(formId)}
    >
      {ROTULO_DECLARAR_LOGICA_EXTERNA}
    </button>
  );
}

export function LogicaExternaDialogo({
  control,
  formName,
}: {
  control: ControlLogicaExterna;
  /** Nombre del formulario del `foco`, si se conoce. */
  formName: string | null;
}) {
  const abierto = control.abierto && control.formId != null;
  return (
    <Dialog.Root open={abierto} onOpenChange={(siguiente) => { if (!siguiente) control.cerrar(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="pulso-xf-logica-externa-velo" />
        <Dialog.Content
          className="pulso-xf-logica-externa"
          {...control.props}
          data-audit-ready="true"
        >
          {control.formId ? (
            // `key`: si la dirección cambia de formulario, el borrador se reinicia.
            <FormularioLogicaExterna
              key={control.formId}
              formId={control.formId}
              formName={formName}
              control={control}
            />
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Cuerpo del diálogo; exportado para probarlo sin portal. */
export function FormularioLogicaExterna({
  formId,
  formName,
  control,
}: {
  formId: string;
  formName: string | null;
  control: Pick<ControlLogicaExterna, "declarar" | "cerrar" | "enCursoId">;
}) {
  const [herramienta, setHerramienta] = useState("");
  const [nota, setNota] = useState("");
  const [motivo, setMotivo] = useState<string | null>(null);
  const enCurso = control.enCursoId === formId;
  const idBase = `pulso-xf-logica-externa-${formId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validacion = validarLogicaExterna({ herramienta, nota });
    if (!validacion.ok) {
      setMotivo(validacion.motivo);
      return;
    }
    setMotivo(null);
    const ok = await control.declarar(formId, {
      herramienta: validacion.herramienta,
      nota: validacion.nota,
    });
    if (ok) control.cerrar();
  }

  return (
    <form className="pulso-xf-logica-externa-form" onSubmit={(event) => { void onSubmit(event); }} noValidate>
      <header className="pulso-xf-logica-externa-cabecera">
        <div className="pulso-xf-logica-externa-titular">
          <Dialog.Title className="pulso-xf-logica-externa-titulo">
            La lógica y la limpieza se hicieron fuera
          </Dialog.Title>
          <Dialog.Close className="pulso-xf-logica-externa-cerrar" aria-label="Cerrar" disabled={enCurso}>
            <X size={16} aria-hidden="true" />
          </Dialog.Close>
        </div>
        <Dialog.Description className="pulso-xf-logica-externa-descripcion">
          {CONSECUENCIA_LOGICA_EXTERNA}
        </Dialog.Description>
        {formName ? (
          <p className="pulso-xf-logica-externa-contexto" title={formName}>{formName}</p>
        ) : null}
      </header>

      <div className="pulso-xf-logica-externa-cuerpo">
        <div className="pulso-xf-logica-externa-campo">
          <label htmlFor={`${idBase}-programa`}>Programa</label>
          <input
            id={`${idBase}-programa`}
            type="text"
            value={herramienta}
            autoFocus
            autoComplete="off"
            maxLength={60}
            placeholder="p. ej., SPSS"
            aria-invalid={motivo ? true : undefined}
            aria-describedby={motivo ? `${idBase}-motivo` : undefined}
            onChange={(event) => {
              setHerramienta(event.target.value);
              if (motivo) setMotivo(null);
            }}
          />
          <div className="pulso-xf-logica-externa-sugerencias" role="group" aria-label="Programas frecuentes">
            {PROGRAMAS_SUGERIDOS.map((programa) => {
              const elegido = herramienta.trim().toLowerCase() === programa.toLowerCase();
              return (
                <button
                  key={programa}
                  type="button"
                  className={`pulso-xf-logica-externa-sugerencia${elegido ? " is-on" : ""}`}
                  aria-pressed={elegido}
                  onClick={() => {
                    setHerramienta(programa);
                    setMotivo(null);
                  }}
                >
                  {programa}
                </button>
              );
            })}
          </div>
        </div>
        <div className="pulso-xf-logica-externa-campo">
          <label htmlFor={`${idBase}-nota`}>
            Nota <small>opcional</small>
          </label>
          <textarea
            id={`${idBase}-nota`}
            value={nota}
            rows={2}
            maxLength={500}
            placeholder="p. ej., sintaxis de limpieza del 12 de octubre"
            onChange={(event) => setNota(event.target.value)}
          />
        </div>
        {motivo ? (
          <p id={`${idBase}-motivo`} className="pulso-xf-logica-externa-motivo" role="alert">{motivo}</p>
        ) : null}
      </div>

      <footer className="pulso-xf-logica-externa-pie">
        <PulsoButton variant="secondary" size="md" onClick={control.cerrar} disabled={enCurso}>
          Cancelar
        </PulsoButton>
        <PulsoButton variant="primary" size="md" type="submit" disabled={enCurso} aria-busy={enCurso || undefined}>
          {enCurso ? "Guardando…" : "Declarar y continuar"}
        </PulsoButton>
      </footer>
    </form>
  );
}

export function LogicaExternaDeshacer({
  formId,
  acciones,
  className,
}: {
  formId: string;
  acciones: Pick<AccionesLogicaExterna, "retirar" | "enCursoId">;
  className?: string;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const enCurso = acciones.enCursoId === formId;
  const clase = ["pulso-xf-logica-externa-deshacer", className].filter(Boolean).join(" ");

  if (!confirmando) {
    return (
      <div className={clase}>
        <button
          type="button"
          className="pulso-xf-logica-externa-enlace"
          disabled={enCurso}
          aria-label="Deshacer la declaración de lógica hecha fuera de Prosecnur"
          onClick={() => setConfirmando(true)}
        >
          Deshacer
        </button>
      </div>
    );
  }
  return (
    <div className={`${clase} is-confirmando`} role="group" aria-label="Confirmar deshacer">
      <span className="pulso-xf-logica-externa-confirmacion">{CONSECUENCIA_DESHACER_LOGICA_EXTERNA}</span>
      <span className="pulso-xf-logica-externa-confirmacion-acciones">
        <button
          type="button"
          className="pulso-xf-logica-externa-enlace"
          disabled={enCurso}
          onClick={() => setConfirmando(false)}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="pulso-xf-logica-externa-confirmar"
          disabled={enCurso}
          aria-busy={enCurso || undefined}
          autoFocus
          onClick={() => {
            void acciones.retirar(formId).then((ok) => { if (ok) setConfirmando(false); });
          }}
        >
          {enCurso ? "Deshaciendo…" : "Deshacer"}
        </button>
      </span>
    </div>
  );
}
