// Maqueta de la portada del Word en sus tres variantes (W3 del rediseño, 2026-10-15), con los datos que pinta el motor
// (`datosPortada`, espejo de `.word_portada`). La usan Informe › Word y Word › «Así queda».

import { usePlanStore } from "../store";
import { datosPortada, fichaPortada } from "../word/modeloPortadaWord";

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
