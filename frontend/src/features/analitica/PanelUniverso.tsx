// Analítica › «Qué casos cuentan»: el universo de análisis de cada base. Las
// tablas, la base, el libro de códigos y los gráficos trabajan sólo con los
// casos que cumplen estas condiciones; Codificación trabaja con todos, así un
// cambio de selección no obliga a recodificar. Cada base guarda su criterio al
// cambiarlo (CasoValidoManual). Direccionable: `?panel=universo`.

import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "../../vendor/lucide-react";
import { apiAnaliticaUniverso, type UniversoDeBase } from "../../api/analitica";
import type { CasoValidoCondicion } from "../../api/validacion";
import { ErrorBlock, LoadingBlock } from "../../components/States";
import { usePanelDireccionable } from "../../lib/navegacion/paneles";
import { CasoValidoManual } from "../validacion/components/CasoValidoManual";
import { PANEL_UNIVERSO } from "./panelesAnalitica";
import "./variablesExcluidas.css";
import "../validacion/validacion-v2.css";

type Criterio = { enabled: boolean; condiciones: CasoValidoCondicion[] };

export function PanelUniverso() {
  const panel = usePanelDireccionable(PANEL_UNIVERSO);
  const contenido = useRef<HTMLDivElement | null>(null);
  const [bases, setBases] = useState<UniversoDeBase[] | null>(null);
  const [error, setError] = useState("");
  const [criterios, setCriterios] = useState<Record<string, Criterio>>({});

  useEffect(() => {
    if (!panel.abierto) return;
    let vivo = true;
    setBases(null);
    setError("");
    apiAnaliticaUniverso()
      .then((b) => {
        if (!vivo) return;
        setBases(b);
        setCriterios(Object.fromEntries(b.map((x) => [x.base, { enabled: x.declarado, condiciones: x.condiciones }])));
      })
      .catch((e: unknown) => { if (vivo) setError(e instanceof Error ? e.message : "No se pudo leer el universo."); });
    return () => { vivo = false; };
  }, [panel.abierto]);

  const varias = (bases?.length ?? 0) > 1;
  return (
    <Dialog.Root open={panel.abierto} onOpenChange={(abierto) => { if (!abierto) panel.cerrar(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="pulso-excluidas-velo" />
        <Dialog.Content
          ref={contenido}
          className="pulso-excluidas"
          {...panel.props}
          data-audit-ready={bases || error ? "true" : "false"}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            contenido.current?.querySelector<HTMLElement>("[data-universo-titulo]")?.focus();
          }}
        >
          <header className="pulso-excluidas-cabecera">
            <div className="pulso-excluidas-titular">
              <Dialog.Title asChild>
                <h2 tabIndex={-1} data-universo-titulo="">Qué casos cuentan</h2>
              </Dialog.Title>
              <Dialog.Close asChild>
                <button type="button" className="pulso-excluidas-cerrar" aria-label="Cerrar qué casos cuentan">
                  <X size={16} aria-hidden="true" />
                </button>
              </Dialog.Close>
            </div>
            <Dialog.Description asChild>
              <p className="pulso-excluidas-regla">
                Tablas, base, libro de códigos y gráficos usan sólo los casos que cumplen estas condiciones. Sin
                condiciones cuentan todos. Codificación trabaja con todos los casos.
              </p>
            </Dialog.Description>
          </header>
          <div className="pulso-excluidas-cuerpo">
            {error ? (
              <ErrorBlock label="No se pudo leer el universo de análisis" detail={error} />
            ) : !bases ? (
              <LoadingBlock label="Leyendo las bases…" />
            ) : (
              bases.map((b) => {
                const c = criterios[b.base] ?? { enabled: false, condiciones: [] };
                return (
                  <section key={b.base} className="pulso-universo-base" aria-label={varias ? `Base ${b.base}` : undefined}>
                    {varias ? <h3>{b.base}</h3> : null}
                    <CasoValidoManual
                      baseNombre={b.base}
                      enabled={c.enabled}
                      condiciones={c.condiciones}
                      onCambiar={(condiciones) =>
                        setCriterios((prev) => ({ ...prev, [b.base]: { enabled: condiciones.length > 0, condiciones } }))}
                    />
                  </section>
                );
              })
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
