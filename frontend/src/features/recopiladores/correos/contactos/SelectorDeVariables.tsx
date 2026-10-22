// Elegir las variables de control: qué columnas de la lista describen el perfil
// (carrera, sexo, sede…). Es un panel direccionable (`?panel=contactos-variables`)
// y la elección se guarda en la campaña: solo los nombres de columna.
//
// La selección se arma en borrador y se aplica con un botón: cada casilla no
// relee el tablero, y «Cancelar» deja todo como estaba.

import * as Popover from "@radix-ui/react-popover";
import { useEffect, useState } from "react";

import type { CandidataDeControl } from "../../../../api/mailContactos";
import { PulsoButton } from "../../../../components/PulsoButton";
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
              {candidatas.length > MAXIMO_DE_VARIABLES ? (
                <p className="rec-contactos-nota">Hasta {MAXIMO_DE_VARIABLES} variables.</p>
              ) : null}
              {candidatas.length === 0 ? (
                <p className="rec-contactos-nota">La lista no trae columnas con categorías para comparar.</p>
              ) : (
                <ul className="rec-contactos-variables-lista">
                  {candidatas.map((c) => (
                    <li key={c.key}>
                      <label className="rec-contactos-variable">
                        <input
                          type="checkbox"
                          checked={borrador.includes(c.key)}
                          disabled={!borrador.includes(c.key) && borrador.length >= MAXIMO_DE_VARIABLES}
                          onChange={() => alternar(c.key)}
                        />
                        <span className="rec-contactos-variable-nombre">{c.label}</span>
                        <span className="rec-contactos-variable-detalle">
                          {c.tipo === "muchas"
                            ? `${formatoConteoDe(c.distintos, "valor", "valores")} · se ven las más frecuentes`
                            : formatoConteoDe(c.distintos, "categoría")}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>
            {error ? <p className="rec-contactos-error" role="alert">{error}</p> : null}
            <div className="rec-contactos-variables-acciones">
              <PulsoButton variant="ghost" size="sm" onClick={panel.cerrar}>Cancelar</PulsoButton>
              <PulsoButton type="submit" variant="primary" size="sm" disabled={guardando || sinCambios}>
                {guardando ? <Loader2 size={14} className="pulso-spin" aria-hidden /> : null}
                {guardando ? "Guardando…" : ordenado.length ? `Usar ${formatoConteoDe(ordenado.length, "variable")}` : "Quitar las variables"}
              </PulsoButton>
            </div>
          </form>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
