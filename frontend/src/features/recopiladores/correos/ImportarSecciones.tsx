// «Importar de otro estudio…» de «Mis secciones» (GOAL editor profesional, L9;
// ADR 0113): se elige un `.pulso`, se ve lo que trae y se copian las secciones
// elegidas, con sus fotos, a este estudio. El otro `.pulso` sólo se lee.

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import {
  apiMailSectionsImportPeek, type MailSectionsImportPeek, type MailSectionsImportResult,
} from "../../../api/materialMailMisSecciones";
import { PulsoButton } from "../../../components/PulsoButton";
import type { RecentProject } from "../../project/types";
import { FolderOpen } from "../../../vendor/lucide-react";
import { ROTULO_DE_BLOQUE } from "./modeloCorreo";
import "./correosSecciones.css";
import "./correosImportarSecciones.css";

type Props = {
  /** Copia las elegidas; devuelve el resumen o `null` si falló (el error lo muestra la lista). */
  onImportar: (path: string, sectionIds: string[]) => Promise<MailSectionsImportResult | null>;
  onListo: (resumen: MailSectionsImportResult) => void;
  onCerrar: () => void;
};

const mensaje = (e: unknown) => (e instanceof Error ? e.message : "No se pudo leer ese estudio.");
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Lo que dice cada sección del otro estudio: su tipo, sus fotos y por qué no se puede elegir. */
export function detalleImportable(s: MailSectionsImportPeek["sections"][number]): string {
  const tipo = s.block.type === "__no_reconocido" ? "" : ROTULO_DE_BLOQUE[s.block.type];
  if (!s.importable) return "No se puede leer en esta versión";
  if (s.already_here) return [tipo, "ya está en este estudio"].filter(Boolean).join(" · ");
  const fotos = s.photos === 0 ? "" : s.photos_missing ? "le falta su foto" : s.photos === 1 ? "con su foto" : `con sus ${s.photos} fotos`;
  return [tipo, fotos].filter(Boolean).join(" · ");
}

/** Resumen de una importación en una línea: «Se importaron 2 secciones de «X». 1 ya estaba.» */
export function resumenDeImportacion(r: MailSectionsImportResult): string {
  const de = `de «${r.project_name}»`;
  const partes = [
    r.imported === 0 ? `No se importó nada ${de}.` : r.imported === 1 ? `Se importó 1 sección ${de}.` : `Se importaron ${r.imported} secciones ${de}.`,
  ];
  if (r.already_here) partes.push(r.already_here === 1 ? "1 ya estaba." : `${r.already_here} ya estaban.`);
  if (r.photos_renamed) partes.push(r.photos_renamed === 1 ? "Una foto entró con otro nombre: aquí ya había una distinta con el suyo." : `${r.photos_renamed} fotos entraron con otro nombre: aquí ya había otras con el suyo.`);
  if (r.photos_missing) partes.push(r.photos_missing === 1 ? "A una le falta su foto." : `A ${r.photos_missing} les falta su foto.`);
  return partes.join(" ");
}

export function ImportarSecciones({ onImportar, onListo, onCerrar }: Props) {
  const id = useId();
  const escritorio = typeof window !== "undefined" ? window.prosecnurApi : undefined;
  const [recientes, setRecientes] = useState<RecentProject[]>([]);
  const [ruta, setRuta] = useState("");
  const [vista, setVista] = useState<{ path: string; peek: MailSectionsImportPeek } | null>(null);
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  const [ocupado, setOcupado] = useState<"leyendo" | "importando" | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Al abrir y al pasar de elegir a revisar, el foco entra al panel.
  const raiz = useRef<HTMLElement | null>(null);
  useEffect(() => {
    raiz.current?.querySelector<HTMLElement>("input:not([disabled]), button:not([disabled])")?.focus({ preventScroll: true });
  }, [vista]);

  useEffect(() => {
    let vivo = true;
    escritorio?.getRecentProjects().then((l) => { if (vivo) setRecientes(l.slice(0, 6)); }).catch(() => undefined);
    return () => { vivo = false; };
  }, [escritorio]);

  const leer = async (path: string) => {
    if (!path.trim() || ocupado) return;
    setOcupado("leyendo");
    setError(null);
    try {
      const peek = await apiMailSectionsImportPeek(path.trim());
      setVista({ path: path.trim(), peek });
      setElegidas(new Set(peek.sections.filter((s) => s.importable && !s.already_here).map((s) => s.section_id)));
    } catch (e) {
      setError(mensaje(e));
    } finally {
      setOcupado(null);
    }
  };

  const buscar = async () => {
    const path = await escritorio?.openProjectDialog();
    if (path) await leer(path);
  };

  const importar = async (event: FormEvent) => {
    event.preventDefault();
    if (!vista || !elegidas.size || ocupado) return;
    setOcupado("importando");
    const out = await onImportar(vista.path, [...elegidas]);
    setOcupado(null);
    if (out) onListo(out);
  };

  // Escape cierra este panel, no la biblioteca entera.
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    if (vista) setVista(null); else onCerrar();
  };

  const alternar = (sectionId: string) => setElegidas((prev) => {
    const next = new Set(prev);
    if (next.has(sectionId)) next.delete(sectionId); else next.add(sectionId);
    return next;
  });

  if (vista) {
    const { peek } = vista;
    const sobran = elegidas.size > peek.room;
    return (
      <form ref={(el) => { raiz.current = el; }} className="rec-sec-importar" role="group" aria-label="Importar de otro estudio" onSubmit={importar} onKeyDown={onKeyDown}>
        <span className="rec-sec-importar-titulo">De «{peek.project_name}»</span>
        {peek.same_project ? <p className="rec-sec-importar-nota">Es este mismo estudio.</p> : null}
        {!peek.sections.length ? <p className="rec-sec-importar-nota">Ese estudio no tiene secciones guardadas.</p> : (
          <ul className="rec-sec-importar-lista">
            {peek.sections.map((s) => {
              const libre = s.importable && !s.already_here;
              return (
                <li key={s.section_id}>
                  <label className={`rec-sec-importar-item${libre ? "" : " is-apagada"}`}>
                    <input type="checkbox" checked={libre && elegidas.has(s.section_id)} disabled={!libre} onChange={() => alternar(s.section_id)} />
                    <span className="rec-sec-importar-texto">
                      <span className="rec-sec-importar-nombre">{s.name}</span>
                      <span className="rec-sec-importar-desc">{detalleImportable(s)}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        {sobran ? <p className="rec-mail-problemas" role="alert">Caben {peek.room} más en este estudio.</p> : null}
        <span className="rec-sec-agregar">
          <PulsoButton type="submit" variant="primary" size="sm" disabled={!elegidas.size || sobran || ocupado !== null}>
            {ocupado === "importando" ? "Importando…" : elegidas.size ? `Importar ${plural(elegidas.size, "sección", "secciones")}` : "Importar"}
          </PulsoButton>
          <PulsoButton type="button" variant="ghost" size="sm" onClick={() => setVista(null)}>Elegir otro</PulsoButton>
          <PulsoButton type="button" variant="ghost" size="sm" onClick={onCerrar}>Cancelar</PulsoButton>
        </span>
        <p className="rec-capa-img-ayuda">Se copian con sus fotos. El otro estudio no cambia.</p>
      </form>
    );
  }

  return (
    <div ref={(el) => { raiz.current = el; }} className="rec-sec-importar" role="group" aria-label="Importar de otro estudio" onKeyDown={onKeyDown}>
      <span className="rec-sec-importar-titulo">Importar de otro estudio</span>
      {recientes.length ? (
        <ul className="rec-sec-importar-lista" aria-label="Estudios recientes">
          {recientes.map((r) => (
            <li key={r.path}>
              <button type="button" className="rec-sec-importar-item is-boton" title={r.path} disabled={ocupado !== null} onClick={() => { void leer(r.path); }}>
                <span className="rec-sec-importar-texto">
                  <span className="rec-sec-importar-nombre">{r.name}</span>
                  <span className="rec-sec-importar-desc">{r.path}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {escritorio ? (
        <span className="rec-sec-agregar">
          <PulsoButton type="button" variant="secondary" size="sm" disabled={ocupado !== null} onClick={() => { void buscar(); }}>
            <FolderOpen size={13} aria-hidden /> {ocupado === "leyendo" ? "Leyendo…" : "Buscar otro .pulso…"}
          </PulsoButton>
          <PulsoButton type="button" variant="ghost" size="sm" onClick={onCerrar}>Cancelar</PulsoButton>
        </span>
      ) : (
        <form className="rec-sec-importar-ruta" onSubmit={(e) => { e.preventDefault(); void leer(ruta); }}>
          <label htmlFor={`${id}-ruta`}>Ruta del .pulso</label>
          <input id={`${id}-ruta`} type="text" value={ruta} placeholder="/ruta/al/estudio.pulso" onChange={(e) => setRuta(e.target.value)} />
          <span className="rec-sec-agregar">
            <PulsoButton type="submit" variant="primary" size="sm" disabled={!ruta.trim() || ocupado !== null}>
              {ocupado === "leyendo" ? "Leyendo…" : "Leer"}
            </PulsoButton>
            <PulsoButton type="button" variant="ghost" size="sm" onClick={onCerrar}>Cancelar</PulsoButton>
          </span>
        </form>
      )}
      {error ? <p className="rec-mail-problemas" role="alert">{error}</p> : null}
    </div>
  );
}
