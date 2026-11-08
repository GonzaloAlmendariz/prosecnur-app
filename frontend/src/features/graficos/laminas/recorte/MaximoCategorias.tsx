// «Máximo de categorías» como slider sobre la lista ordenada (oleada I2, ítem 5): reusa CifraDeslizable y useCifraEnVivo
// (la cifra se mueve en vivo y se confirma al soltar). Debajo, la lista completa en el orden de la lámina con el % de
// cada categoría y una línea de corte; lo que queda fuera se atenúa y se resume («Fuera: Otro, No sabe (7%)»). R7-10: si
// el resto se agrupa, «Otros 54%» es una fila SOBRE la línea (N = filas visibles) y las que van a Otros se marcan debajo. Las categorías y cifras son del motor (modeloRecorte.ts); sin detalle, el control
// de siempre (`respaldo`).
//
// Superficie intrínseca (C1): crece con su lista; la línea se mueve con transform sobre filas de alto fijo.

import { useRef, type CSSProperties, type ReactNode } from "react";
import { CifraDeslizable } from "../reglaPreguntas/CifraDeslizable";
import { useCifraEnVivo } from "../reglaPreguntas/useCifraEnVivo";
import { CifraEstado } from "../cifrasInspector/CifraEstado";
import { textoPct } from "../cifrasInspector/modeloCifras";
import { useDetalleCifras } from "../cifrasInspector/useDetalleCifras";
import { EN_OTROS, filasVista, recorteDe, textoFuera, TODAS, variantesRecorte, VISTA } from "./modeloRecorte";
import "../numeroDeslizable.css";
import "../reglaPreguntas/reglaPreguntas.css";
import "./recorte.css";

type Props = {
  id: string;
  rotulo: string;
  marcas?: ReactNode;
  graficador: string;
  scope: "active" | "consolidated";
  args: Readonly<Record<string, unknown>>;
  argName: string;
  valor: unknown;
  porDefecto?: unknown;
  min?: number;
  onCambio: (v: number) => void;
  respaldo: ReactNode;
};

export function MaximoCategorias({ id, rotulo, marcas, graficador, scope, args, argName, valor, porDefecto, min = 1, onCambio, respaldo }: Props) {
  const destino = useRef(onCambio);
  const nTodas = useRef(0);
  const guardado = typeof valor === "number" ? valor : typeof porDefecto === "number" ? porDefecto : nTodas.current || 1;
  const cifra = useCifraEnVivo(guardado, `${id}:${argName}`, (v) => destino.current(v));
  const det = useDetalleCifras(graficador, scope, variantesRecorte(args, argName, cifra.enVivo ? cifra.valor : null));
  const todas = det[TODAS];
  const vista = det[VISTA];
  const recorte = recorteDe(todas?.detalle ?? null, vista?.detalle ?? null);
  const n = recorte?.filas.length ?? 0;
  nTodas.current = n;
  if (!recorte || n <= min) return <>{respaldo}</>;
  const max = Math.max(min, n);
  const valorVisto = Math.min(max, Math.max(min, cifra.valor));
  const mover = (v: number) => { destino.current = onCambio; cifra.mover(v); };
  const vigente = !!vista?.vigente;
  const visto = filasVista(recorte);
  const estilo = { "--pulso-f6-corte": visto.corte } as CSSProperties;
  const resumen = textoFuera(recorte);
  return (
    <div className="pulso-f6-dato pulso-f6-numdesl pulso-f6-recorte" data-campo={argName}
      data-qa-geometry-group="graficos/f6-recorte" data-qa-geometry-contract="intrinsic">
      <CifraDeslizable id={id} rotulo={rotulo} valor={valorVisto}
        recorrido={{ pista: { min, max }, valores: { min, max } }} campo={{ min, max: TOPE_CAMPO }} paso={1} grande={2}
        onMover={mover} onSoltar={cifra.soltar} />
      {marcas ? <span className="pulso-f6-numdesl-marcas">{marcas}</span> : null}
      <ol className={`pulso-f6-recorte-lista${vigente ? "" : " is-anterior"}`} style={estilo} aria-label={`Categorías del gráfico, ${rotulo.toLowerCase()}`}>
        {visto.filas.map((f) => f.tipo === "otros" ? (
          <li key={`otros:${f.clave}`} className="pulso-f6-recorte-fila is-otros" data-qa="recorte-otros">
            <span className="pulso-f6-recorte-nombre" title={f.clave}>{f.clave}</span>
            <span className="pulso-f6-cifra-pct">{textoPct(f.valor, recorte.decimales)}</span>
          </li>
        ) : (
          <li key={f.clave} className={`pulso-f6-recorte-fila${f.fuera ? " is-fuera" : ""}`}>
            <span className="pulso-f6-recorte-nombre" title={f.clave}>{f.clave}</span>
            {f.enOtros && <span className="pulso-f6-recorte-en-otros" data-qa="recorte-en-otros">{EN_OTROS}</span>}
            <span className="pulso-f6-cifra-pct">{textoPct(f.valor, recorte.decimales)}</span>
            {f.fuera && !f.enOtros && <span className="pulso-sr-only">, fuera del gráfico</span>}
          </li>
        ))}
        {visto.corte < visto.filas.length && <li className="pulso-f6-recorte-linea" aria-hidden="true" />}
      </ol>
      <CifraEstado texto={resumen} vigente={vigente} esperando={!!vista && !vista.vigente && resumen !== null} qa="recorte-fuera" className="pulso-f6-recorte-estado" />
    </div>
  );
}

/** El número escrito admite más que la lista (el máximo que conserva todas); el slider, hasta la lista. */
const TOPE_CAMPO = 999;
