// «Opciones que van solas» en una pregunta de selección múltiple (E18 editor-conjoint, 2026-11-06): un interruptor por
// opción, las habituales sugeridas («Ninguno», «No sabe»…), la lectura de lo que quedará y el mensaje propuesto. Al
// aplicar se escribe la regla en la restricción, junto con lo que ya exigía. Mismo formato que la entrada «Formato».

import { useId, useState } from "react";
import { CheckCircle2, ListChecks } from "../../../../vendor/lucide-react";
import { PulsoSwitch } from "../../../../components/PulsoSwitch";
import { stripMarkdown } from "../../helpers/markdown";
import {
  escribirSolas,
  leerSolas,
  mensajeSolas,
  sugeridasSolas,
} from "./opcionesSolasModelo";

type Opcion = { name: string; label: string };

type Props = {
  constraint: string;
  opciones: readonly Opcion[];
  /** Escribe la restricción nueva y, si no había, el mensaje propuesto. */
  onAplicar: (constraint: string, mensaje: string) => void;
};

export function OpcionesSolasEntrada({
  constraint,
  opciones,
  onAplicar,
}: Props) {
  const tituloId = useId();
  const vigentes = leerSolas(constraint).solas;
  const [elegidas, setElegidas] = useState<string[] | null>(null);
  const marcadas = elegidas ?? vigentes;
  const sugeridas = sugeridasSolas(opciones);
  const etiqueta = (c: string) =>
    stripMarkdown(opciones.find((o) => o.name === c)?.label || c);
  const cambiar = (c: string, si: boolean) =>
    setElegidas((prev) => {
      const base = prev ?? vigentes;
      return si
        ? [...base.filter((x) => x !== c), c]
        : base.filter((x) => x !== c);
    });
  const enOrden = opciones
    .map((o) => o.name)
    .filter((c) => marcadas.includes(c));
  const cambio = enOrden.join(" ") !== vigentes.join(" ");

  return (
    // Siempre abierta: Gonzalo no quiere triángulos que despliegan (2026-11-06).
    <section
      className="xfa-bloque"
      data-testid="opciones-solas"
      aria-labelledby={tituloId}
    >
      <header className="xfa-bloque__cabeza">
        <span className="xfa-bloque__icono" aria-hidden="true">
          <ListChecks />
        </span>
        <div className="xfa-bloque__titulos">
          <h4 id={tituloId} className="xfa-bloque__titulo">
            Opciones que van solas
          </h4>
          <p className="xfa-bloque__sub">
            Quien marca una de estas no puede marcar nada más.
          </p>
        </div>
        {sugeridas.some((c) => !marcadas.includes(c)) ? (
          <button
            type="button"
            className="xfa-bloque__accion"
            onClick={() =>
              setElegidas([...new Set([...marcadas, ...sugeridas])])
            }
          >
            Activar las habituales
          </button>
        ) : null}
      </header>
      <ul className="xfa-opciones">
        {opciones.map((o) => {
          const on = marcadas.includes(o.name);
          const texto = stripMarkdown(o.label || o.name);
          return (
            <li key={o.name} className={on ? "is-on" : undefined}>
              <span className="xfa-opciones__texto">
                {texto}
                {sugeridas.includes(o.name) && !on ? (
                  <span className="xfa-opciones__suele">Suele ir sola</span>
                ) : null}
              </span>
              <code className="xfa-opciones__codigo">{o.name}</code>
              <PulsoSwitch
                size="sm"
                ariaLabel={`${texto} va sola`}
                checked={on}
                onCheckedChange={(si) => cambiar(o.name, si)}
              />
            </li>
          );
        })}
      </ul>
      <p
        className={`xfa-bloque__resultado${enOrden.length ? " is-on" : ""}`}
        role="status"
      >
        {enOrden.length ? <CheckCircle2 aria-hidden="true" /> : null}
        <span>
          {enOrden.length
            ? mensajeSolas(enOrden.map(etiqueta))
            : "Ninguna opción va sola: se pueden marcar todas juntas."}
        </span>
      </p>
      {cambio ? (
        <div className="xfa-bloque__acciones">
          <button type="button" onClick={() => setElegidas(null)}>
            Deshacer
          </button>
          <button
            type="button"
            className="pulso-primary"
            disabled={!cambio}
            onClick={() => {
              onAplicar(
                escribirSolas(constraint, enOrden),
                mensajeSolas(enOrden.map(etiqueta)),
              );
              setElegidas(null);
            }}
          >
            Aplicar
          </button>
        </div>
      ) : null}
    </section>
  );
}
