// Word › Portada (W3 del rediseño, 2026-10-15): la variante (A tipográfica, B banda, C con ficha) y sus textos. Escribe
// `documento_word.portada` y `documento_word.meta_portada` (contrato de `.graficos_opciones_documento`). El título no se
// edita aquí: es el de la lámina de portada, y subtítulo y fecha también salvo que se cambien aquí.

import { useId } from "react";
import type { DocumentoWordMetaPortada } from "../../../api/graficosConfigNormalizer";
import { usePlanStore } from "../store";
import { CampoTexto } from "./DetalleDocumento";
import { datosPortada, VARIANTES_PORTADA, type VariantePortada } from "./modeloPortadaWord";

type Clave = keyof DocumentoWordMetaPortada;

export function DetallePortada({ desdeLamina }: { desdeLamina: { titulo: string; sub: string; fecha: string } }) {
  const nombre = useId();
  const dw = usePlanStore((s) => s.documentoWord);
  const setDw = usePlanStore((s) => s.setDocumentoWord);
  const d = datosPortada(desdeLamina, dw);
  const meta = dw.meta_portada ?? {};
  const guardar = (k: Clave, v: string) => setDw({ ...dw, meta_portada: { ...meta, [k]: v } });
  const elegir = (v: VariantePortada) => setDw({ ...dw, portada: v });
  const campo = (k: Clave, etiqueta: string, placeholder: string, ayuda: string, max = 120) => (
    <CampoTexto etiqueta={etiqueta} valor={meta[k] ?? ""} placeholder={placeholder} ayuda={ayuda} max={max} onGuardar={(v) => guardar(k, v)} />
  );
  return (
    <>
      <section className="pulso-f6-informe-seccion" aria-label="Variante de la portada" data-qa-geometry-member data-seccion="word-portada">
        <h3 className="pulso-f6-w-titulo">Variante</h3>
        <div className="pulso-f6-w-variantes" role="radiogroup" aria-label="Variante de la portada">
          {VARIANTES_PORTADA.map((v) => (
            <label key={v.clave} className={`pulso-f6-w-variante${d.variante === v.clave ? " is-activa" : ""}`}>
              <input type="radio" className="pulso-sr-only" name={nombre} value={v.clave} checked={d.variante === v.clave} onChange={() => elegir(v.clave)} />
              <span className={`pulso-f6-w-variante-mini is-${v.clave.toLowerCase()}`} aria-hidden="true"><i /><i /><i /></span>
              <b>{v.nombre}</b>
              <small>{v.detalle}</small>
            </label>
          ))}
        </div>
      </section>
      <section className="pulso-f6-informe-seccion" aria-label="Textos de la portada" data-qa-geometry-member data-seccion="word-portada-textos">
        <h3 className="pulso-f6-w-titulo">Textos de la portada</h3>
        <p className="pulso-f6-informe-ayuda">El título es el de la lámina de portada: «{desdeLamina.titulo}». Vacío, cada texto usa el de la lámina o se omite.</p>
        <div className="pulso-f6-w-campos">
          {campo("ante", "Antetítulo", "Sin antetítulo", "Encima del título, en versalitas.", 80)}
          {campo("fecha", "Fecha", desdeLamina.fecha || "Sin fecha", "Vacío, la de la lámina de portada.", 60)}
          {campo("sub", "Subtítulo", desdeLamina.sub || "Sin subtítulo", "Vacío, el de la lámina de portada.", 200)}
          {campo("por", "Elaborado por", "PULSO PUCP", "Vacío, PULSO PUCP.", 120)}
          {d.variante === "C" && campo("para", "Elaborado para", "Sin dato", "Sólo en la ficha de la variante con ficha.", 120)}
          {d.variante === "C" && campo("version", "Versión", "Sin dato", "Sólo en la ficha de la variante con ficha.", 40)}
        </div>
      </section>
    </>
  );
}
