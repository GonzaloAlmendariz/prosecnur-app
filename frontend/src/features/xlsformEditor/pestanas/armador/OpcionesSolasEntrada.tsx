// «Opciones que van solas» en una pregunta de selección múltiple (E18 editor-conjoint, 2026-11-06): un interruptor por
// opción, las habituales sugeridas («Ninguno», «No sabe»…), la lectura de lo que quedará y el mensaje propuesto. Al
// aplicar se escribe la regla en la restricción, junto con lo que ya exigía. Mismo formato que la entrada «Formato».

import { useId, useState } from "react";
import { ChevronRight, ListChecks } from "../../../../vendor/lucide-react";
import { PulsoSwitch } from "../../../../components/PulsoSwitch";
import { stripMarkdown } from "../../helpers/markdown";
import { escribirSolas, leerSolas, mensajeSolas, sugeridasSolas } from "./opcionesSolasModelo";

type Opcion = { name: string; label: string };

type Props = {
  constraint: string;
  opciones: readonly Opcion[];
  /** Escribe la restricción nueva y, si no había, el mensaje propuesto. */
  onAplicar: (constraint: string, mensaje: string) => void;
};

export function OpcionesSolasEntrada({ constraint, opciones, onAplicar }: Props) {
  const [abierto, setAbierto] = useState(false);
  const panelId = useId();
  const vigentes = leerSolas(constraint).solas;
  const [elegidas, setElegidas] = useState<string[] | null>(null);
  const marcadas = elegidas ?? vigentes;
  const sugeridas = sugeridasSolas(opciones);
  const etiqueta = (c: string) => stripMarkdown(opciones.find((o) => o.name === c)?.label || c);
  const resumen = vigentes.length ? mensajeSolas(vigentes.map(etiqueta)).replace(/\.$/, "") : "Ninguna opción va sola";
  const cambiar = (c: string, si: boolean) => setElegidas((prev) => {
    const base = prev ?? vigentes;
    return si ? [...base.filter((x) => x !== c), c] : base.filter((x) => x !== c);
  });
  const enOrden = opciones.map((o) => o.name).filter((c) => marcadas.includes(c));
  const cambio = enOrden.join(" ") !== vigentes.join(" ");

  return (
    <div className="xfa-entrada-caja" data-testid="opciones-solas">
      <button type="button" className="xfa-entrada" aria-expanded={abierto} aria-controls={panelId} onClick={() => setAbierto((v) => !v)}>
        <ListChecks aria-hidden="true" />
        <span className="xfa-entrada__nombre">Opciones que van solas</span>
        <span className="xfa-entrada__lectura">{resumen}</span>
        <ChevronRight aria-hidden="true" style={{ transform: abierto ? "rotate(90deg)" : undefined }} />
      </button>
      {abierto && (
        <div id={panelId} className="xfa-entrada__panel xfa-solas">
          <p className="xfa-solas__explica">
            Una opción que va sola no se puede marcar junto con otras: si la persona marca «Ninguno», no puede marcar nada
            más. Activa las que deben ir solas.
          </p>
          <ul className="xfa-solas__lista">
            {opciones.map((o) => (
              <li key={o.name}>
                <PulsoSwitch
                  size="sm"
                  label={stripMarkdown(o.label || o.name)}
                  checked={marcadas.includes(o.name)}
                  onCheckedChange={(si) => cambiar(o.name, si)}
                />
                <code className="xfa-solas__codigo">{o.name}</code>
                {sugeridas.includes(o.name) && !marcadas.includes(o.name) ? <span className="xfa-solas__suele">suele ir sola</span> : null}
              </li>
            ))}
          </ul>
          {sugeridas.some((c) => !marcadas.includes(c)) ? (
            <button type="button" className="xfa-solas__sugeridas" onClick={() => setElegidas([...new Set([...marcadas, ...sugeridas])])}>
              Activar las que suelen ir solas
            </button>
          ) : null}
          <p className="xfa-solas__lectura" role="status">
            {enOrden.length ? mensajeSolas(enOrden.map(etiqueta)) : "Ninguna opción va sola: se pueden marcar todas juntas."}
          </p>
          <div className="xfa-solas__acciones">
            <button type="button" onClick={() => { setElegidas(null); setAbierto(false); }}>Cancelar</button>
            <button
              type="button"
              className="pulso-primary"
              disabled={!cambio}
              onClick={() => {
                onAplicar(escribirSolas(constraint, enOrden), mensajeSolas(enOrden.map(etiqueta)));
                setElegidas(null);
                setAbierto(false);
              }}
            >
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
