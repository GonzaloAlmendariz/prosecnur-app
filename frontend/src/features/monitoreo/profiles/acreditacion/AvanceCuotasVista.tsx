import { useId, useMemo, type ReactNode } from "react";

import { Alert } from "../../../../components/Alert";
import { EstadoVacio } from "../../../../components/EstadoVacio";
import { PulsoButton } from "../../../../components/PulsoButton";
import { Database, Loader2, Plus, Target } from "../../../../vendor/lucide-react";
import { AvanceCuotasDetalle } from "./AvanceCuotasDetalle";
import { AvanceCuotasResumen } from "./AvanceCuotasResumen";
import { cifra, cuotaElegida, type EstadoCuotas, faseCuotas, marcaReadinessCuotas } from "./avanceCuotasModelo";
import { paletaDePublicos } from "./paletaPublicos";
import "./paletaPublicos.css";
import "./AvanceCuotas.css";

// Presentación de Avance › Cuotas. Sin efectos: el contenedor (`AvanceCuotas`)
// carga, guarda y conecta el panel a la dirección. Arriba, la tira de
// indicadores (una por cuota) elige qué cuota se detalla abajo; el panel es el
// único dueño del scroll.

export type AvanceCuotasVistaProps = {
  s: EstadoCuotas;
  /** Cuota elegida (`?foco=`); vacío = la primera. */
  foco: string;
  /** El panel de configuración ya montado, o `null`. */
  panel: ReactNode;
  onElegir: (id: string) => void;
  onAgregar: () => void;
  onEditar: (id: string) => void;
  onReintentar: () => void;
};

export function AvanceCuotasVista({ s, foco, panel, onElegir, onAgregar, onEditar, onReintentar }: AvanceCuotasVistaProps) {
  const ids = useId();
  const estado = s.estado;
  const fase = faseCuotas({ estado, cargando: s.cargando, error: s.error });
  const paleta = useMemo(() => paletaDePublicos([
    ...(estado?.publicos ?? []).map((p) => p.actor),
    ...(estado?.cuotas ?? []).map((q) => q.actor),
  ]), [estado]);
  const elegida = estado ? cuotaElegida(estado.cuotas, foco) : null;
  const publicosConCuota = new Set((estado?.cuotas ?? []).map((q) => q.actor)).size;

  return (
    <section
      className="pulso-panel mon-fill-panel mon-advance-panel mon-cuotas"
      aria-labelledby={`${ids}-titulo`}
      aria-busy={fase === "cargando"}
      data-qa-scroll-owner="monitoreo-cuotas"
    >
      <span hidden data-audit-ready={marcaReadinessCuotas(fase)} />
      <header className="mon-cuotas-cabecera">
        <div className="mon-cuotas-cabecera-titulo">
          <span className="mon-cuotas-cabecera-icono" aria-hidden><Target size={16} /></span>
          <div>
            <span className="mon-cuotas-versalita">Avance</span>
            <h2 id={`${ids}-titulo`}>Cuotas</h2>
          </div>
        </div>
        {estado?.cuotas.length ? (
          <p className="mon-cuotas-cabecera-meta">
            {cifra(estado.cuotas.length)} {estado.cuotas.length === 1 ? "cuota" : "cuotas"} en {cifra(publicosConCuota)} {publicosConCuota === 1 ? "público" : "públicos"}
          </p>
        ) : null}
        {estado?.publicos.length ? (
          <PulsoButton variant="secondary" size="sm" className="mon-cuotas-agregar" onClick={onAgregar}>
            <Plus size={14} aria-hidden /> Agregar cuota
          </PulsoButton>
        ) : null}
      </header>

      {s.aviso ? <p className="mon-cuotas-confirmacion" role="status">{s.aviso}</p> : null}
      {s.error && estado ? <Alert kind="error">{s.error}</Alert> : null}
      {estado && estado.avisos.length && fase !== "sin-universo" ? (
        <Alert kind="warn">
          <ul className="mon-cuotas-avisos">{estado.avisos.map((a) => <li key={a}>{a}</li>)}</ul>
        </Alert>
      ) : null}

      {fase === "cargando" ? (
        <p className="mon-cuotas-cargando" role="status"><Loader2 size={14} className="pulso-spin" aria-hidden /> Leyendo las cuotas…</p>
      ) : null}
      {fase === "error" ? (
        <div className="mon-cuotas-vacio" data-qa-geometry-capacity="owned">
          <EstadoVacio
            tamano="normal"
            icono={<Target size={18} />}
            titulo="No se pudieron leer las cuotas"
            descripcion={s.error}
            accion={<PulsoButton variant="secondary" size="sm" onClick={onReintentar}>Reintentar</PulsoButton>}
          />
        </div>
      ) : null}
      {fase === "preparando" ? (
        <div className="mon-cuotas-vacio" data-qa-geometry-capacity="owned">
          <EstadoVacio
            tamano="normal"
            icono={<Database size={18} />}
            titulo="Monitoreo está preparando el cruce"
            descripcion="Las cuotas aparecen apenas termine de cruzar el universo; esta vista se actualiza sola."
          />
        </div>
      ) : null}
      {fase === "sin-universo" ? (
        <div className="mon-cuotas-vacio" data-qa-geometry-capacity="owned">
          <EstadoVacio
            tamano="normal"
            icono={<Database size={18} />}
            titulo="Falta el universo cruzado"
            descripcion={estado?.avisos[0] || "Sincroniza las fuentes de Monitoreo para leer la base de cada público."}
          />
        </div>
      ) : null}
      {fase === "sin-cuotas" ? (
        <div className="mon-cuotas-vacio" data-qa-geometry-capacity="owned">
          <EstadoVacio
            tamano="normal"
            icono={<Target size={18} />}
            titulo="Sin cuotas configuradas"
            descripcion="Una cuota fija metas por categoría de una variable de la base: dedicación, unidad, puesto."
            accion={<PulsoButton variant="primary" size="sm" onClick={onAgregar}><Plus size={14} aria-hidden /> Agregar cuota</PulsoButton>}
          />
        </div>
      ) : null}

      {fase === "listo" && estado && elegida ? (
        <div
          className="mon-cuotas-cuerpo"
          data-qa-geometry-group="monitoreo/acreditacion/avance/cuotas"
          data-qa-geometry-contract="intrinsic"
        >
          <AvanceCuotasResumen cuotas={estado.cuotas} elegida={elegida.id} paleta={paleta} onElegir={onElegir} />
          <AvanceCuotasDetalle key={elegida.id} cuota={elegida} paleta={paleta} onEditar={onEditar} />
        </div>
      ) : null}
      {panel}
    </section>
  );
}
