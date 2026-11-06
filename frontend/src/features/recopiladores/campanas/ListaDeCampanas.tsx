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
import { Link } from "react-router-dom";

import type { CampanaMaterial, RegistroDeCampanas, TipoDeCampana } from "../../../api/materialCampanas";
import { TiposDeCampana } from "./DialogoNuevaCampana";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { PageFrame } from "../../../components/PageFrame";
import { PulsoButton } from "../../../components/PulsoButton";
import { AlertTriangle, Layers, Plus, RefreshCw } from "../../../vendor/lucide-react";
import type { AccionDeCampana, IdDeAccion } from "./accionesDeCampana";
import type { MiniaturaDeCorreo } from "./miniaturaDeCorreo";
import { campanaPorId, campanasArchivadas, campanasVisibles, cuentaDeCampanas } from "./modeloRegistro";
import { agruparPorPublico, procedenciaDe } from "./rondasDelRegistro";
import { TarjetaDeCampana } from "./TarjetaDeCampana";
import type { FuenteDelRegistro } from "./useRegistroDeCampanas";
import "./campanas.css";
import "../correos/correosIconos.css";
import { LoadingBlock } from "../../../components/States";

export type AvisoDeLaLista = { tono: "ok" | "error"; texto: string; enlace?: { href: string; texto: string } };

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
  /** Abre «Nueva campaña»; con un tipo, el diálogo llega con ese tipo elegido (vacío de la lista). */
  onNueva: (tipo?: TipoDeCampana) => void;
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

function Grilla({ campanas, grupo, children, extra = null }: { campanas: readonly CampanaMaterial[]; grupo: string; children: (c: CampanaMaterial) => ReactNode; extra?: ReactNode }) {
  return (
    <ul className="rec-campanas-grilla" data-qa-geometry-group={grupo} data-qa-geometry-contract="equal" aria-label="Campañas">
      {campanas.map((c) => <li key={c.id}>{children(c)}</li>)}
      {extra ? <li>{extra}</li> : null}
    </ul>
  );
}

/** Al final de la grilla: empezar otra campaña sin subir al botón de la cabecera. */
function TarjetaNueva({ onNueva }: { onNueva: () => void }) {
  return (
    <button type="button" className="rec-campana-nueva" onClick={onNueva}>
      <span className="rec-campana-nueva-icono" aria-hidden><Plus size={18} /></span>
      <strong>Nueva campaña</strong>
      <small>Aulas, territorial, telefónica, correo o supervisión</small>
    </button>
  );
}

export function ListaDeCampanas({
  registro, carga, error, fuente, aviso, onCerrarAviso, hrefDe, accionesDe, onAccion, onNueva, onReintentar, miniaturas = {}, asuntos = {},
}: Props) {
  const visibles = registro ? campanasVisibles(registro) : [];
  const archivadas = registro ? campanasArchivadas(registro) : [];
  const nombreDe = (id: string) => (registro ? campanaPorId(registro, id)?.name ?? null : null);
  const tarjeta = (c: CampanaMaterial) => (
    <TarjetaDeCampana campana={c} href={hrefDe(c)} acciones={accionesDe(c)} onAccion={onAccion} miniatura={miniaturas[c.id] ?? null} asunto={asuntos[c.id] ?? null} procedencia={procedenciaDe(c, nombreDe)} />
  );
  // Revamp v5 (ADR 0125 §5): en acreditación, un bloque por público con sus rondas en orden.
  const porPublico = agruparPorPublico(visibles);

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
            {/* D8 (checklist visual 2/11): sin campañas el primario es el del vacío; aquí queda secundario, en su sitio. */}
            <PulsoButton variant={registro && !visibles.length ? "secondary" : "primary"} size="sm" onClick={() => onNueva()} disabled={!registro} data-retorno="nueva-campana">
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
            {aviso.enlace ? <Link to={aviso.enlace.href}>{aviso.enlace.texto}</Link> : null}
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
          <LoadingBlock label="Leyendo las campañas…" />
        ) : visibles.length && porPublico.grupos.length ? (
          <>
            {porPublico.grupos.map((g) => (
              <section key={g.publico} className="rec-campanas-publico" aria-label={`Campañas de ${g.publico}`}>
                <h2 className="rec-campanas-publico-titulo">{g.publico}<small>{g.campanas.length.toLocaleString("es-PE")} {g.campanas.length === 1 ? "campaña" : "campañas"}</small></h2>
                <Grilla campanas={g.campanas} grupo={`material-campo/campanas/${g.publico}`}>{tarjeta}</Grilla>
              </section>
            ))}
            <Grilla campanas={porPublico.sueltas} grupo="material-campo/campanas" extra={<TarjetaNueva onNueva={() => onNueva()} />}>{tarjeta}</Grilla>
          </>
        ) : visibles.length ? (
          <Grilla campanas={visibles} grupo="material-campo/campanas" extra={<TarjetaNueva onNueva={() => onNueva()} />}>{tarjeta}</Grilla>
        ) : (
          <div className="rec-campanas-vacio is-con-tipos" data-qa-geometry-capacity="owned">
            {/* 5 nov 2026 (pulido de UI): el vacío ya muestra los tipos que el estudio admite, con su qué-es, y
                elegir uno abre «Nueva campaña» con ese tipo marcado. Antes era una caja chica con una frase de
                cuatro tipos seguidos y un botón que llevaba a ver esos mismos tipos en el diálogo. */}
            <EstadoVacio
              tamano="normal"
              icono={<Layers size={18} />}
              titulo="Todavía no hay campañas"
              descripcion="Elige el tipo para empezar."
            />
            <TiposDeCampana registro={registro} elegido={null} ocupado={false} onElegir={(tipo) => onNueva(tipo)} />
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
