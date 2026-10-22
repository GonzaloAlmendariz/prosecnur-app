// Elegir las variables de control: qué columnas de la lista describen el perfil
// (carrera, sexo, sede…). Es un panel direccionable (`?panel=contactos-variables`)
// y la elección se guarda en la campaña: solo los nombres de columna.
//
// La selección se arma en borrador y se aplica con un botón: cada interruptor no
// relee el tablero, y «Cancelar» deja todo como estaba. Interruptores y no
// casillas (dictado 2026-10-22): una variable de control queda puesta.

import * as Popover from "@radix-ui/react-popover";
import { useEffect, useState } from "react";

import type { CandidataDeControl } from "../../../../api/mailContactos";
import { PulsoButton } from "../../../../components/PulsoButton";
import { Switch } from "../../../../components/Switch";
import type { ControlPanel } from "../../../../lib/navegacion/paneles";
import { formatoConteoDe } from "../../../../lib/formatoNumero";
import { Loader2, SlidersHorizontal } from "../../../../vendor/lucide-react";

/** El backend acepta hasta 12 variables de control por campaña. */
export const MAXIMO_DE_VARIABLES = 12;

type Props = {
  panel: ControlPanel;
  candidatas: readonly CandidataDeControl[];
  control: readonly string[];
  guardando: boolean;
  error: string;
  disabled?: boolean;
  onAplicar: (variables: string[]) => Promise<boolean>;
};

export function SelectorDeVariables({ panel, candidatas, control, guardando, error, disabled = false, onAplicar }: Props) {
  const [borrador, setBorrador] = useState<string[]>([...control]);
  const controlClave = control.join("\u0000");

  // Cada vez que se abre, el borrador parte de lo guardado.
  useEffect(() => {
    if (panel.abierto) setBorrador(controlClave ? controlClave.split("\u0000") : []);
  }, [controlClave, panel.abierto]);

  const alternar = (key: string) => setBorrador((actual) => (
    actual.includes(key) ? actual.filter((k) => k !== key) : [...actual, key]
  ));
  // El orden de las tarjetas es el de las candidatas, no el de los clics.
  const ordenado = candidatas.map((c) => c.key).filter((k) => borrador.includes(k));
  const sinCambios = ordenado.join("\u0000") === controlClave;
  const enElTope = borrador.length >= MAXIMO_DE_VARIABLES;

  return (
    <Popover.Root open={panel.abierto} onOpenChange={(abierto) => (abierto ? panel.abrir() : panel.cerrar())}>
      <Popover.Trigger asChild>
        <PulsoButton variant="secondary" size="sm" disabled={disabled} aria-haspopup="dialog">
          <SlidersHorizontal size={14} aria-hidden />
          Variables de control
          {control.length ? <span className="rec-contactos-cuenta">{control.length}</span> : null}
        </PulsoButton>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="rec-contactos-variables"
          align="end"
          sideOffset={6}
          collisionPadding={12}
          aria-label="Variables de control"
          {...panel.props}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void onAplicar(ordenado).then((ok) => { if (ok) panel.cerrar(); });
            }}
          >
            <fieldset className="rec-contactos-variables-grupo">
              <legend>Columnas que describen el perfil</legend>
              {candidatas.length === 0 ? (
                <p className="rec-contactos-nota">La lista no trae columnas con categorías para comparar.</p>
              ) : (
                <ul className="rec-contactos-variables-lista">
                  {candidatas.map((c) => {
                    const puesta = borrador.includes(c.key);
                    const bloqueada = !puesta && enElTope;
                    const idNombre = `rec-contactos-variable-${c.key}`;
                    return (
                      <li key={c.key}>
                        <div
                          className={`rec-contactos-variable${puesta ? " is-on" : ""}${bloqueada ? " is-bloqueada" : ""}`}
                          // Toda la fila responde al clic; el teclado va al interruptor.
                          onClick={(event) => {
                            if (bloqueada || (event.target as HTMLElement).closest("[role='switch']")) return;
                            alternar(c.key);
                          }}
                        >
                          <span className="rec-contactos-variable-texto" id={idNombre}>
                            <span className="rec-contactos-variable-nombre">{c.label}</span>
                            <span className="rec-contactos-variable-detalle">
                              {c.tipo === "muchas"
                                ? `${formatoConteoDe(c.distintos, "valor", "valores")} · se ven las más frecuentes`
                                : formatoConteoDe(c.distintos, "categoría")}
                            </span>
                          </span>
                          <Switch
                            checked={puesta}
                            disabled={bloqueada}
                            ariaLabel={c.label}
                            onToggle={() => alternar(c.key)}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {enElTope && candidatas.length > MAXIMO_DE_VARIABLES ? (
                <p className="rec-contactos-nota" role="status">
                  Ya van {MAXIMO_DE_VARIABLES} variables, el máximo. Apaga una para elegir otra.
                </p>
              ) : null}
            </fieldset>
            {error ? <p className="rec-contactos-error" role="alert">{error}</p> : null}
            <div className="rec-contactos-variables-acciones">
              <PulsoButton variant="ghost" size="sm" onClick={panel.cerrar}>Cancelar</PulsoButton>
              <PulsoButton type="submit" variant="primary" size="sm" disabled={guardando || sinCambios}>
                {guardando ? <Loader2 size={14} className="pulso-spin" aria-hidden /> : null}
                {guardando
                  ? "Guardando…"
                  : ordenado.length
                    ? `Usar ${formatoConteoDe(ordenado.length, "variable")}`
                    : control.length ? "Quitar las variables" : "Usar las variables"}
              </PulsoButton>
            </div>
          </form>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
