// La lista de campañas: el aterrizaje de Material de campo (ADR 0111 §2).
//
// Contrato de Superficie:
// - C1: `material-campo/lista` (intrinsic) es la página; `material-campo/campanas`
//   (equal), una tarjeta por campaña como
//   miembro; `material-campo/campanas-archivadas` igual, dentro de su
//   `details` cerrado.
// - C2: la grilla iguala el marco de las tarjetas con 1, 2 o 20 campañas; el
//   avance y los hechos viven dentro.
// - C3: sin campañas, el vacío está en su propia caja con «Nueva campaña».
// - C4: la página es el único dueño del scroll (`layout="document"`).
// - C5: vacío legítimo —el proyecto todavía no prepara material—.

import type { ReactNode } from "react";

import type { CampanaMaterial, RegistroDeCampanas } from "../../../api/materialCampanas";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { PageFrame } from "../../../components/PageFrame";
import { PulsoButton } from "../../../components/PulsoButton";
import { AlertTriangle, Layers, Plus, RefreshCw } from "../../../vendor/lucide-react";
import type { AccionDeCampana, IdDeAccion } from "./accionesDeCampana";
import type { MiniaturaDeCorreo } from "./miniaturaDeCorreo";
import { campanasArchivadas, campanasVisibles, cuentaDeCampanas } from "./modeloRegistro";
import { TarjetaDeCampana } from "./TarjetaDeCampana";
import type { FuenteDelRegistro } from "./useRegistroDeCampanas";
import "./campanas.css";
import "../correos/correosIconos.css";

export type AvisoDeLaLista = { tono: "ok" | "error"; texto: string };

type Props = {
  registro: RegistroDeCampanas | null;
  carga: "cargando" | "lista" | "error";
  error: string;
  fuente: FuenteDelRegistro | null;
  aviso: AvisoDeLaLista | null;
  onCerrarAviso: () => void;
  hrefDe: (campana: CampanaMaterial) => string;
  accionesDe: (campana: CampanaMaterial) => readonly AccionDeCampana[];
  onAccion: (accion: IdDeAccion, campana: CampanaMaterial) => void;
  onNueva: () => void;
  onReintentar: () => void;
  /** Miniatura real de cada correo, por id de campaña. */
  miniaturas?: Record<string, MiniaturaDeCorreo | null>;
  /** El asunto de cada correo, por id de campaña: subtítulo cuando no hay actor (F1). */
  asuntos?: Record<string, string>;
};

/** La readiness de la lista: falsa mientras lee; el vacío se publica como tal. */
export function listoDeLaLista(registro: RegistroDeCampanas | null, carga: Props["carga"]): string | false {
  if (carga === "error") return "vacio:error-campanas";
  if (!registro) return false;
  return campanasVisibles(registro).length ? "material-campo/campanas" : "vacio:sin-campanas";
}

function Grilla({ campanas, grupo, children }: { campanas: readonly CampanaMaterial[]; grupo: string; children: (c: CampanaMaterial) => ReactNode }) {
  return (
    <ul className="rec-campanas-grilla" data-qa-geometry-group={grupo} data-qa-geometry-contract="equal" aria-label="Campañas">
      {campanas.map((c) => <li key={c.id}>{children(c)}</li>)}
    </ul>
  );
}

export function ListaDeCampanas({
  registro, carga, error, fuente, aviso, onCerrarAviso, hrefDe, accionesDe, onAccion, onNueva, onReintentar, miniaturas = {}, asuntos = {},
}: Props) {
  const visibles = registro ? campanasVisibles(registro) : [];
  const archivadas = registro ? campanasArchivadas(registro) : [];
  const tarjeta = (c: CampanaMaterial) => (
    <TarjetaDeCampana campana={c} href={hrefDe(c)} acciones={accionesDe(c)} onAccion={onAccion} miniatura={miniaturas[c.id] ?? null} asunto={asuntos[c.id] ?? null} />
  );

  return (
    <PageFrame
      title="Campañas"
      lead="Cada campaña es un operativo con sus propios materiales."
      layout="document"
      scrollOwner="page"
      headerMode="sr-only"
      auditReady={listoDeLaLista(registro, carga)}
      className="rec-page rec-campanas-pagina"
    >
      {/* Cabecera, grilla (o vacío) y archivadas: secciones independientes apiladas. */}
      <div className="rec-campanas" data-qa-geometry-group="material-campo/lista" data-qa-geometry-contract="intrinsic">
        {/* Un solo encabezado de página: qué es y la acción que la llena. */}
        <header className="rec-campanas-cabeza">
          {/* Título y acción en la misma fila, alineados; la línea de qué es va debajo. */}
          <div className="rec-campanas-cabeza-fila">
            {/* El h1 lo pone PageFrame (sr-only) con el mismo título: este no se repite al lector. */}
            <p className="rec-campanas-titulo" aria-hidden>Campañas</p>
            <PulsoButton variant="primary" size="sm" onClick={onNueva} disabled={!registro} data-retorno="nueva-campana">
              <Plus size={14} aria-hidden /> Nueva campaña
            </PulsoButton>
          </div>
          <p className="rec-campanas-lead">Cada campaña es un operativo con sus propios materiales.</p>
          {registro && fuente === "derivada" ? (
            <p className="rec-campanas-nota" role="status">
              {cuentaDeCampanas(visibles.length)} leídas de lo que el proyecto ya tiene: esta versión del backend no registra campañas.
            </p>
          ) : null}
        </header>

        {aviso ? (
          <p className={`rec-campanas-aviso${aviso.tono === "error" ? " is-error" : ""}`} role={aviso.tono === "error" ? "alert" : "status"}>
            <span>{aviso.texto}</span>
            <PulsoButton variant="ghost" size="sm" onClick={onCerrarAviso}>Entendido</PulsoButton>
          </p>
        ) : null}

        {carga === "error" ? (
          <div className="rec-campanas-vacio" data-qa-geometry-capacity="owned">
            <EstadoVacio
              tamano="normal"
              icono={<AlertTriangle size={18} />}
              titulo="No se pudo leer la lista de campañas"
              descripcion={error}
              accion={<PulsoButton variant="secondary" size="sm" onClick={onReintentar}><RefreshCw size={14} aria-hidden /> Reintentar</PulsoButton>}
            />
          </div>
        ) : !registro ? (
          <div className="rec-loading" data-qa-geometry-capacity="owned">Leyendo las campañas…</div>
        ) : visibles.length ? (
          <Grilla campanas={visibles} grupo="material-campo/campanas">{tarjeta}</Grilla>
        ) : (
          <div className="rec-campanas-vacio" data-qa-geometry-capacity="owned">
            <EstadoVacio
              tamano="normal"
              icono={<Layers size={18} />}
              titulo="Todavía no hay campañas"
              descripcion="Un campo en aulas con fichas QR o un correo para un grupo: elige el tipo y empieza."
              accion={<PulsoButton variant="primary" size="sm" onClick={onNueva} data-retorno="nueva-campana"><Plus size={14} aria-hidden /> Nueva campaña</PulsoButton>}
            />
          </div>
        )}

        {archivadas.length ? (
          <details className="rec-campanas-archivadas">
            <summary>Archivadas ({archivadas.length})</summary>
            <Grilla campanas={archivadas} grupo="material-campo/campanas-archivadas">{tarjeta}</Grilla>
          </details>
        ) : null}
      </div>
    </PageFrame>
  );
}
