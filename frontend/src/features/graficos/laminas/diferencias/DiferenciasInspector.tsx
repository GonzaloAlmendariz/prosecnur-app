// U2 · «Diferencias entre grupos» en la tarjeta del gráfico (ADR 0126; propuesta de significancia §3.5). Reemplaza la
// fila «Nivel de significancia» de Cifras: el nivel ya no es de cada lámina sino de la regla del estudio. El interruptor
// es el `mostrar_significancia` del gráfico; el resumen sale de GET /api/graficos/diferencias?slide=<id>.
//
// Seis estados, cada uno con `data-estado` legible: con marcas · sin cruce (vacío) · calculando · ninguna diferencia ·
// abstención · error. Apagado es el séptimo, sin pedir nada. La marca de readiness sólo vale `false` mientras calcula.

import { useId } from "react";
import { AlertTriangle, Copy, Plus, RotateCcw } from "../../../../vendor/lucide-react";
import type { LaminaDiferencias, ReglaDiferencias } from "../../../../api/graficosDiferencias";
import { Switch } from "../../../../components/Switch";
import { PulsoButton } from "../../../../components/PulsoButton";
import { Skeleton } from "../../../../components/Skeleton";
import { usePanelDireccionable } from "../../../../lib/navegacion/paneles";
import { copiarTexto } from "../../../../lib/portapapeles";
import { toast } from "../../../../components/toasterStore";
import { PANEL_DIFERENCIAS_LAMINA, PANEL_DIFERENCIAS_REGLA } from "../../panelesGraficos";
import { Capsula } from "./Capsula";
import {
  conteosLamina,
  descripcionComparacion,
  estadoInspector,
  gruposNoComparables,
  parInicial,
  redaccionLamina,
  resumenRegla,
  type EstadoInspector,
} from "./modeloDiferencias";
import { useClaveDiferencias, useDiferenciasLamina } from "./useDiferencias";
import { useDiferenciasUi } from "./store";
import "./diferencias.css";

type Props = {
  slideId: string;
  /** El `mostrar_significancia` efectivo del gráfico (guardado o, sin guardar, el default del registro). */
  encendido: boolean;
  /** La pregunta que divide (`cruces`); vacía = sin cruce. */
  cruce: string;
  /** Su etiqueta legible, si se conoce. */
  etiquetaCruce: string | null;
  onAlternar: (encendido: boolean) => void;
  /** «Agregar cruce»: lleva al campo «Dividir por» de la tarjeta. */
  onAgregarCruce: () => void;
  /** «Quitar el cruce» cuando no muestra diferencias. */
  onQuitarCruce: () => void;
};

export function DiferenciasInspector({ slideId, encendido, cruce, etiquetaCruce, onAlternar, onAgregarCruce, onQuitarCruce }: Props) {
  const tieneCruce = cruce.trim() !== "";
  // La huella de la lámina entera (sus ranuras): la comparte «Por qué», que pide lo mismo.
  const clave = useClaveDiferencias(slideId);
  const { carga, reintentar } = useDiferenciasLamina(slideId, clave, tieneCruce && encendido);
  const reglaPanel = usePanelDireccionable(PANEL_DIFERENCIAS_REGLA);
  const porQuePanel = usePanelDireccionable(PANEL_DIFERENCIAS_LAMINA);
  const elegirPar = useDiferenciasUi((s) => s.elegirPar);
  const estado = estadoInspector({ tieneCruce, encendido, carga });
  const datos = carga && carga.estado !== "error" ? carga.datos : undefined;
  const error = carga?.estado === "error" ? { code: carga.code, message: carga.message, error_id: carga.error_id } : null;
  return (
    <DiferenciasInspectorVista
      estado={estado}
      encendido={encendido}
      lamina={datos?.lamina ?? null}
      regla={datos?.regla ?? null}
      errorCarga={error}
      etiquetaCruce={etiquetaCruce}
      onAlternar={onAlternar}
      onAgregarCruce={onAgregarCruce}
      onQuitarCruce={onQuitarCruce}
      onReintentar={reintentar}
      onAbrirRegla={reglaPanel.abrir}
      onVerPorQue={() => {
        if (datos) elegirPar(slideId, parInicial(datos.lamina.pares));
        porQuePanel.abrir();
      }}
    />
  );
}

type VistaProps = {
  estado: EstadoInspector;
  encendido: boolean;
  lamina: LaminaDiferencias | null;
  regla: ReglaDiferencias | null;
  /** Fallo de la llamada misma (no de la prueba dentro de la lámina). */
  errorCarga: { code: string; message: string; error_id: string | null } | null;
  etiquetaCruce: string | null;
  onAlternar: (encendido: boolean) => void;
  onAgregarCruce: () => void;
  onQuitarCruce: () => void;
  onReintentar: () => void;
  onAbrirRegla: () => void;
  onVerPorQue: () => void;
};

/** La sección por estado, sin red ni dirección: lo que pintan los tests. */
export function DiferenciasInspectorVista(props: VistaProps) {
  const { estado, encendido, regla, onAlternar, onAbrirRegla } = props;
  const id = useId();
  return (
    <div
      className="pulso-sig-inspector"
      data-estado={estado}
      data-audit-ready={estado === "calculando" ? "false" : "graficos-diferencias"}
      data-qa-surface="graficos/f6-diferencias"
      data-qa-geometry-group="graficos/f6-diferencias"
      data-qa-geometry-contract="intrinsic"
    >
      <div className="pulso-f6-dato" data-qa-geometry-member="">
        <span className="pulso-f6-dato-rotulo" id={`${id}-rotulo`}>Marcar en este gráfico</span>
        <Switch checked={encendido} ariaLabel="Marcar diferencias entre grupos en este gráfico" onToggle={() => onAlternar(!encendido)} />
      </div>
      <div className="pulso-sig-cuerpo" data-qa-geometry-member="" aria-live="polite" aria-busy={estado === "calculando"}>
        <CuerpoPorEstado {...props} />
      </div>
      <div className="pulso-sig-regla-linea" data-qa-geometry-member="">
        <span>{regla ? `Regla del informe: ${resumenRegla(regla)}.` : "Una sola regla para láminas, Word y tablas de cruces."}</span>
        <PulsoButton variant="link" size="sm" data-pulso-abre-panel={PANEL_DIFERENCIAS_REGLA.id} onClick={onAbrirRegla}>
          Regla del estudio…
        </PulsoButton>
      </div>
    </div>
  );
}

function CuerpoPorEstado({ estado, lamina, errorCarga, etiquetaCruce, onAgregarCruce, onQuitarCruce, onReintentar, onAbrirRegla, onVerPorQue }: VistaProps) {
  switch (estado) {
    case "apagado":
      return <p className="pulso-sig-texto">Este gráfico no marca diferencias. Enciéndelo para compararlas entre los grupos del cruce.</p>;
    case "sin_cruce":
      return (
        <div className="pulso-sig-caja">
          <p className="pulso-sig-texto">Las diferencias se calculan entre los grupos de un cruce, y este gráfico no tiene cruce.</p>
          <div className="pulso-sig-acciones">
            <PulsoButton variant="secondary" size="sm" onClick={onAgregarCruce}>
              <Plus size={14} aria-hidden="true" /> Agregar cruce
            </PulsoButton>
          </div>
        </div>
      );
    case "calculando":
      return (
        <div className="pulso-sig-caja" role="status">
          <div className="pulso-sig-chips" aria-hidden="true">
            <Skeleton forma="texto" ancho={84} alto={22} />
            <Skeleton forma="texto" ancho={64} alto={22} />
            <Skeleton forma="texto" ancho={72} alto={22} />
          </div>
          <p className="pulso-sig-texto">Comparando los grupos{etiquetaCruce ? ` de ${etiquetaCruce}` : ""}…</p>
        </div>
      );
    case "error": {
      const e = lamina?.error ?? errorCarga;
      return (
        <div className="pulso-sig-caja is-peligro" role="alert">
          <strong className="pulso-sig-titulo">La prueba no pudo ejecutarse</strong>
          <p className="pulso-sig-texto">{e?.message || "El cálculo de diferencias falló."}</p>
          {(e?.code || e?.error_id) && (
            <p className="pulso-sig-codigo">
              {e?.code ? <>Error <code>{e.code}</code></> : null}
              {e?.code && e?.error_id ? " · " : null}
              {e?.error_id ? <>id <code>{e.error_id}</code></> : null}
            </p>
          )}
          <div className="pulso-sig-acciones">
            <PulsoButton variant="secondary" size="sm" onClick={onReintentar}><RotateCcw size={14} aria-hidden="true" /> Reintentar</PulsoButton>
            <PulsoButton variant="ghost" size="sm" onClick={onAbrirRegla}>Revisar la regla</PulsoButton>
          </div>
        </div>
      );
    }
    case "abstencion":
      return (
        <div className="pulso-sig-caja is-aviso" role="note">
          <strong className="pulso-sig-titulo"><AlertTriangle size={14} aria-hidden="true" /> No se marcan diferencias</strong>
          <p className="pulso-sig-texto">{lamina?.motivo ?? lamina?.nota ?? "Esta pregunta no admite la comparación entre grupos."} La lámina lo explica en la nota.</p>
        </div>
      );
    case "ninguna":
    case "con_marcas":
      return lamina ? <Resumen lamina={lamina} estado={estado} etiquetaCruce={etiquetaCruce} onQuitarCruce={onQuitarCruce} onVerPorQue={onVerPorQue} /> : null;
  }
}

function Resumen({ lamina, estado, etiquetaCruce, onQuitarCruce, onVerPorQue }: {
  lamina: LaminaDiferencias; estado: "ninguna" | "con_marcas"; etiquetaCruce: string | null; onQuitarCruce: () => void; onVerPorQue: () => void;
}) {
  const c = conteosLamina(lamina);
  const chicos = gruposNoComparables(lamina.grupos);
  const redaccion = redaccionLamina(lamina.pares);
  const copiar = () => {
    copiarTexto(redaccion).then(() => toast.exito("Redacción copiada")).catch(() => toast.error("No se pudo copiar la redacción"));
  };
  return (
    <div className="pulso-sig-caja">
      <ul className="pulso-sig-chips" aria-label="Resumen de las diferencias">
        <li className={`pulso-sig-chip${c.marcadas ? " is-marcada" : ""}`}>
          {c.marcadas > 0 && <Capsula letras="" decorativa />} {c.marcadas === 1 ? "1 marcada" : `${c.marcadas} marcadas`}
        </li>
        {estado === "con_marcas" && <li className="pulso-sig-chip is-fragil">{c.fragiles === 1 ? "1 frágil" : `${c.fragiles} frágiles`}</li>}
        <li className="pulso-sig-chip">{c.bajoUmbral} bajo el umbral</li>
      </ul>
      <p className="pulso-sig-texto">{estado === "ninguna" ? (lamina.nota || "Ninguna diferencia entre grupos es significativa. La nota lo dice en la lámina.") : descripcionComparacion(lamina, etiquetaCruce)}</p>
      {chicos.length > 0 && <p className="pulso-sig-texto is-trama">Con trama: {chicos.join(" · ")}.</p>}
      {estado === "con_marcas" ? (
        <div className="pulso-sig-acciones">
          <PulsoButton variant="secondary" size="sm" data-pulso-abre-panel={PANEL_DIFERENCIAS_LAMINA.id} data-sig-ancla="" onClick={onVerPorQue}>
            Ver por qué
          </PulsoButton>
          {redaccion && <PulsoButton variant="ghost" size="sm" onClick={copiar}><Copy size={14} aria-hidden="true" /> Copiar redacción</PulsoButton>}
        </div>
      ) : (
        <div className="pulso-sig-caja is-sugerencia">
          <p className="pulso-sig-texto">
            Este cruce no muestra diferencias. Si el informe sólo lleva cruces con diferencias relevantes, puedes quitarlo.
          </p>
          <div className="pulso-sig-acciones">
            {lamina.pares.length > 0 && (
              <PulsoButton variant="secondary" size="sm" data-pulso-abre-panel={PANEL_DIFERENCIAS_LAMINA.id} data-sig-ancla="" onClick={onVerPorQue}>
                Ver por qué
              </PulsoButton>
            )}
            <PulsoButton variant="ghost" size="sm" onClick={onQuitarCruce}>Quitar el cruce</PulsoButton>
          </div>
        </div>
      )}
    </div>
  );
}
