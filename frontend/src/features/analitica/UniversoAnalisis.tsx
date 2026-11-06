// Analítica › cuántos casos cuentan. Las tablas, la base, el libro y los
// gráficos trabajan con el universo que declara cada base: esta línea lo dice
// con su condición y abre el panel «Qué casos cuentan» donde se cambia. Sin
// criterio dice que cuentan todos y ofrece definirlo.

import { useEffect, useState, type ReactNode } from "react";
import { useInRouterContext } from "react-router-dom";
import { apiAnaliticaUniverso } from "../../api/analitica";
import { useSession } from "../../lib/SessionContext";
import { usePanelDireccionable } from "../../lib/navegacion/paneles";
import { PANEL_UNIVERSO } from "./panelesAnalitica";
import { lineasUniverso, type LineaUniverso } from "./universoModel";
import "./universoAnalisis.css";
import { EstadoChip } from "../../components/EstadoChip";

function AbrirPanel({ texto, onAbrir }: { texto: string; onAbrir: () => void }) {
  return (
    <button type="button" className="pulso-universo-cambiar" onClick={onAbrir}>
      {texto}
    </button>
  );
}

function ConPanel({ children }: { children: (abrir: () => void, abierto: boolean) => ReactNode }) {
  const panel = usePanelDireccionable(PANEL_UNIVERSO);
  return <>{children(panel.abrir, panel.abierto)}</>;
}

export function UniversoAnalisis() {
  const conRouter = useInRouterContext();
  if (!conRouter) return <UniversoLinea abierto={false} />;
  return <ConPanel>{(abrir, abierto) => <UniversoLinea onAbrir={abrir} abierto={abierto} />}</ConPanel>;
}

function UniversoLinea({ onAbrir, abierto }: { onAbrir?: () => void; abierto: boolean }) {
  const { state } = useSession();
  const [lineas, setLineas] = useState<LineaUniverso[] | null>(null);
  // Se vuelve a leer al cambiar la base activa o la fuente, y al cerrar el panel.
  const clave = `${state?.active_base ?? ""}|${state?.analitica_fuente ?? ""}|${abierto}`;
  useEffect(() => {
    if (abierto) return;
    let vivo = true;
    apiAnaliticaUniverso()
      .then((b) => { if (vivo) setLineas(lineasUniverso(b)); })
      .catch(() => { if (vivo) setLineas([]); });
    return () => { vivo = false; };
  }, [clave, abierto]);
  if (lineas === null) return null;
  return (
    <div className="pulso-universo" role="status" aria-label="Casos que cuentan en el análisis">
      {/* 5 nov 2026 (pulido de UI): cada línea es un estado del análisis y se dibuja con el chip del kit
          (EstadoChip), no como texto suelto bajo la cabecera; en ámbar si trae aviso. */}
      {lineas.length
        ? lineas.map((l) => <EstadoChip key={l.base} label={l.texto} tone={l.aviso ? "warn" : "info"} />)
        : <EstadoChip label="Cuentan todos los casos" tone="neutral" />}
      {onAbrir ? <AbrirPanel texto={lineas.length ? "Cambiar" : "Definir"} onAbrir={onAbrir} /> : null}
    </div>
  );
}
