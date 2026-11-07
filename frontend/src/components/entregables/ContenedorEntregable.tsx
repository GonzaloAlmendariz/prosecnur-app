// ContenedorEntregable — lo que pasa después del clic en «Generar», igual en
// toda la app (ADR 0133, fase 4; prototipo aprobado, vistas «Espera» y «Por
// contenedor»).
//
// Una sola señal en movimiento: la línea de avance del borde inferior. El botón
// que disparó solo se deshabilita; aquí no hay spinner. Al terminar, el mismo
// contenedor muestra el archivo con acciones neutras del mismo peso; si falla,
// la causa, el código copiable y «Reintentar». Nada resaltado ni subrayado.
//
// Tres formas según el contenedor del botón:
//  - `bloque`: en el flujo, bajo la fila de acciones, al ancho del contenedor;
//    apila sus acciones si es angosto.
//  - `anclada`: flota bajo el botón o menú que la abrió sin mover la página
//    (el padre es `position: relative`).
//  - `fila`: dentro de la celda de acción de una tabla: línea fina, luego
//    mini-ícono y Abrir/Carpeta; el error en la misma fila.
//
// QA: `data-entregable-fase` (en_curso | lista | fallo) y `data-entregable-forma`.

import { useEffect, useRef, type ReactNode } from "react";
import { AlertCircle, Check, Copy, RotateCw, X } from "../../vendor/lucide-react";
import { BarraDeAvance } from "../BarraDeAvance";
import { PulsoButton } from "../PulsoButton";
import { carpetaDelEntregable } from "../../api/jobs";
import { copiarTexto } from "../../lib/portapapeles";
import { toast } from "../toasterStore";
import { AccionesArchivo } from "./AccionesArchivo";
import { carpetaDeRuta, pesoLegible, textoDelAvance } from "./generacionModelo";
import { TileFormato } from "./TileFormato";
import type { ArchivoEntregable, EstadoGeneracion, FormaContenedor } from "./tipos";
import "./entregables.css";

type Props = {
  estado: EstadoGeneracion;
  forma: FormaContenedor;
  onCerrar: () => void;
  /** Contenido extra al pie del archivo listo (p. ej. los archivos de cada base) o del fallo. */
  pie?: ReactNode;
};

function Linea({ estado }: { estado: Extract<EstadoGeneracion, { fase: "en_curso" }> }) {
  const pct = estado.porcentaje;
  return (
    <div className="pulso-entregable-linea">
      {pct == null
        ? <BarraDeAvance etiqueta={`Avance de ${estado.titulo}`} indeterminada />
        : <BarraDeAvance etiqueta={`Avance de ${estado.titulo}`} valor={pct} total={100} />}
    </div>
  );
}

function Cerrar({ onCerrar }: { onCerrar: () => void }) {
  return (
    <button type="button" className="pulso-entregable-cerrar" aria-label="Cerrar" title="Cerrar" onClick={onCerrar}>
      <X size={14} aria-hidden="true" />
    </button>
  );
}

function copiarCodigo(codigo: string) {
  copiarTexto(codigo).then(
    () => toast.exito("Código copiado"),
    () => toast.error("No se pudo copiar el código"),
  );
}

function MetaArchivo({ archivo, rutaDescargada }: { archivo: ArchivoEntregable; rutaDescargada: string | null }) {
  const peso = pesoLegible(archivo.tamano);
  const ruta = archivo.guardadoEn ?? rutaDescargada;
  const carpeta = archivo.guardadoEn
    ? carpetaDelEntregable(archivo.guardadoEn, null)
    : rutaDescargada ? carpetaDeRuta(rutaDescargada) : null;
  return (
    <div className="pulso-entregable-meta">
      <span className="pulso-entregable-ok">
        <Check size={13} aria-hidden="true" />
        {archivo.guardadoEn ? "Guardado" : "Descargado"}
      </span>
      {peso && <span>{peso}</span>}
      {carpeta && <span className="pulso-entregable-carpeta" title={ruta ?? undefined}>{carpeta}</span>}
    </div>
  );
}

function FilaArchivo({ archivo, rutaDescargada }: { archivo: ArchivoEntregable; rutaDescargada: string | null }) {
  return (
    <li className="pulso-entregable-fila" data-qa-geometry-member="true">
      <TileFormato formato={archivo.formato} />
      <div className="pulso-entregable-cuerpo">
        <div className="pulso-entregable-nombre">{archivo.nombre}</div>
        <MetaArchivo archivo={archivo} rutaDescargada={rutaDescargada} />
        {archivo.avisoGuardado && <p className="pulso-entregable-nota">{archivo.avisoGuardado}</p>}
      </div>
      <AccionesArchivo archivo={archivo} rutaDescargada={rutaDescargada} />
    </li>
  );
}

function FormaFila({ estado }: { estado: Exclude<EstadoGeneracion, { fase: "inactiva" }> }) {
  if (estado.fase === "en_curso") {
    return (
      <>
        <Linea estado={estado} />
        <span className="pulso-entregable-fila-texto">{textoDelAvance(estado)}</span>
      </>
    );
  }
  if (estado.fase === "lista") {
    const archivo = estado.archivos[0];
    return (
      <>
        {archivo && <TileFormato formato={archivo.formato} chico />}
        <span className="pulso-entregable-fila-texto" title={archivo?.nombre}>
          {archivo?.guardadoEn ? "Guardado" : "Descargado"}
        </span>
        {archivo && <AccionesArchivo archivo={archivo} rutaDescargada={estado.rutaDescargada ?? null} compacta />}
      </>
    );
  }
  return (
    <>
      <AlertCircle size={14} className="pulso-entregable-alerta" aria-hidden="true" />
      <span className="pulso-entregable-fila-texto" title={estado.codigo ?? undefined}>{estado.causa}</span>
      {estado.reintentar && (
        <PulsoButton variant="icon" size="sm" aria-label="Reintentar" title="Reintentar" onClick={estado.reintentar}>
          <RotateCw size={14} aria-hidden="true" />
        </PulsoButton>
      )}
    </>
  );
}

/**
 * En forma bloque, el contenedor aparece donde está el botón; si el botón está al fondo de la pantalla, el
 * contenedor nace fuera de la vista. Al aparecer y al cambiar de fase se trae a la vista dentro de su dueño de
 * scroll (`block: "nearest"`: no se mueve si ya se ve). Con movimiento reducido, sin desplazamiento suave.
 */
function useTraerALaVista(fase: EstadoGeneracion["fase"], activo: boolean) {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!activo || fase === "inactiva" || !el || typeof el.scrollIntoView !== "function") return;
    const reducido = typeof window !== "undefined" && typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reducido ? "auto" : "smooth" });
  }, [fase, activo]);
  return ref;
}

export function ContenedorEntregable({ estado, forma, onCerrar, pie }: Props) {
  const ref = useTraerALaVista(estado.fase, forma === "bloque");
  if (estado.fase === "inactiva") return null;
  const comun = {
    className: "pulso-entregable",
    "data-entregable-forma": forma,
    "data-entregable-fase": estado.fase,
    role: estado.fase === "fallo" ? "alert" : "status",
    "aria-label": estado.titulo,
  } as const;

  if (forma === "fila") {
    return <div {...comun}><FormaFila estado={estado} /></div>;
  }

  if (estado.fase === "en_curso") {
    return (
      <section ref={ref} {...comun} aria-busy="true">
        <div className="pulso-entregable-fila">
          <TileFormato formato={estado.formato ?? null} />
          <div className="pulso-entregable-cuerpo">
            <div className="pulso-entregable-nombre">{estado.titulo}</div>
            <div className="pulso-entregable-meta"><span>{textoDelAvance(estado)}</span></div>
          </div>
          {estado.cancelar && (
            <div className="pulso-entregable-acciones">
              <PulsoButton variant="secondary" size="sm" className="pulso-entregable-texto" onClick={estado.cancelar}>
                Cancelar
              </PulsoButton>
            </div>
          )}
        </div>
        <Linea estado={estado} />
      </section>
    );
  }

  if (estado.fase === "lista") {
    const varios = estado.archivos.length > 1;
    return (
      <section ref={ref} {...comun}>
        <ul
          className="pulso-entregable-archivos"
          {...(varios ? { "data-qa-geometry-group": "entregables/archivos", "data-qa-geometry-contract": "equal" } : {})}
        >
          {estado.archivos.map((archivo) => (
            <FilaArchivo key={archivo.fileId} archivo={archivo} rutaDescargada={estado.rutaDescargada ?? null} />
          ))}
        </ul>
        {pie && <div className="pulso-entregable-pie">{pie}</div>}
        <Cerrar onCerrar={onCerrar} />
      </section>
    );
  }

  const codigo = estado.codigo ?? null;
  return (
    <section ref={ref} {...comun}>
      <div className="pulso-entregable-fila">
        <TileFormato formato={estado.formato ?? null} />
        <div className="pulso-entregable-cuerpo">
          <div className="pulso-entregable-nombre">{estado.titulo}</div>
          <div className="pulso-entregable-meta pulso-entregable-meta--fallo">
            <AlertCircle size={13} className="pulso-entregable-alerta" aria-hidden="true" />
            <span>{estado.causa}</span>
          </div>
        </div>
      </div>
      {(codigo || estado.reintentar || pie) && (
        <div className="pulso-entregable-pie">
          {codigo && (
            <>
              <code className="pulso-entregable-codigo">{codigo}</code>
              <PulsoButton variant="icon" size="sm" aria-label="Copiar el código" title="Copiar el código" onClick={() => copiarCodigo(codigo)}>
                <Copy size={14} aria-hidden="true" />
              </PulsoButton>
            </>
          )}
          {pie}
          <span className="pulso-entregable-crece" />
          {estado.reintentar && (
            <PulsoButton variant="secondary" size="sm" className="pulso-entregable-texto" onClick={estado.reintentar}>
              Reintentar
            </PulsoButton>
          )}
        </div>
      )}
      <Cerrar onCerrar={onCerrar} />
    </section>
  );
}
