// Maquetas de la portada (W3) y de la apertura de capítulo (W4) del Word, con lo que pinta el motor (`datosPortada`,
// espejo de `.word_portada`; `.word_apertura`). Las usan Informe › Word y Word › «Así queda».

import { usePlanStore } from "../store";
import { datosPortada, fichaPortada } from "../word/modeloPortadaWord";
import { contactoEfectivo } from "../word/modeloCierreWord";

export function PortadaMaqueta({ titulo, sub, fecha }: { titulo: string; sub: string; fecha: string }) {
  const dw = usePlanStore((s) => s.documentoWord);
  const d = datosPortada({ titulo, sub, fecha }, dw);
  const texto = (<>
    {d.ante && <span className="pulso-f6-vg-pag-k">{d.ante}</span>}
    <span className="pulso-f6-vg-pag-t">{d.titulo}</span>
    {d.variante !== "B" && <span className="pulso-f6-vg-pag-regla" />}
    {d.sub && <span className="pulso-f6-vg-pag-sub">{d.sub}</span>}
  </>);
  return (<>
    <span className="pulso-f6-vg-pag-logos"><span>PUCP</span><span>PULSO PUCP</span></span>
    {d.variante === "B" && <span className="pulso-f6-vg-pag-banda" aria-hidden="true" />}
    <span className={`pulso-f6-vg-pag-portada is-${d.variante.toLowerCase()}`}>
      {texto}
      {d.variante === "C" ? (
        <span className="pulso-f6-vg-pag-ficha">
          {fichaPortada(d).map((f) => <span key={f.k}><span>{f.k}</span><b>{f.v}</b></span>)}
        </span>
      ) : (
        <span className="pulso-f6-vg-pag-quien"><b>{d.por}</b>{d.fecha && <span>{d.fecha}</span>}</span>
      )}
    </span>
  </>);
}

/** Apertura de capítulo como `.word_apertura`: B, el número grande en azul claro; A, «CAPÍTULO N». Título y entrada. */
export function AperturaMaqueta({ numero, titulo, entrada }: { numero: number; titulo: string; entrada: string }) {
  const variante = usePlanStore((s) => s.documentoWord.apertura) ?? "B";
  return (
    <span className={`pulso-f6-vg-pag-apertura is-${variante.toLowerCase()}`}>
      {variante === "B" ? <span className="pulso-f6-vg-pag-ap-num">{numero}</span> : <span className="pulso-f6-vg-pag-ap-k">Capítulo {numero}</span>}
      <span className="pulso-f6-vg-pag-h1">{titulo}</span>
      {entrada && <span className="pulso-f6-vg-pag-ap-ent">{entrada}</span>}
    </span>
  );
}

/** Contraportada como `.word_contraportada`: el logo de PULSO PUCP (o el propio) al centro y el contacto debajo. */
export function ContraportadaMaqueta() {
  const contacto = usePlanStore((s) => s.documentoWord.contacto);
  return (
    <span className="pulso-f6-vg-pag-contra">
      <b className="pulso-f6-vg-pag-contra-logo">PULSO PUCP</b>
      <span className="pulso-f6-vg-pag-contra-datos">{contactoEfectivo(contacto).map((d) => <span key={d}>{d}</span>)}</span>
    </span>
  );
}
