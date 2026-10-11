// Detalle del tipo elegido en «¿Qué lámina?» (F6.2; dirección F6 §4.3, columna derecha): la composición en grande con
// sus ranuras numeradas y los gráficos acomodados, qué admite, la escala de su familia, sus variantes, sus medidas del
// estándar y el botón para aplicarla. Si el tipo nuevo deja gráficos o textos fuera, lo dice antes y pide confirmarlo.

import { useId } from "react";
import { AlertTriangle, Lock } from "../../../../vendor/lucide-react";
import type { GraficadorRef, SlideType } from "../../../../api/graficos";
import { PulsoButton } from "../../../../components/PulsoButton";
import { ComposicionLamina } from "../../iconos/ComposicionLamina";
import { composicionDe } from "../../iconos/composicion";
import { ESTANDAR_LAMINAS } from "../../iconos/estandarLaminas.generated";
import { SLIDE_GRAF_SLOTS } from "../../store";
import type { CambioTipoLamina } from "./cambioTipoLamina";
import type { ModoSelectorLamina } from "./selectoresStore";
import { rotuloRanuras, type VariantesTipo } from "./tiposLamina";

const num = (n: number): string => n.toLocaleString("es", { maximumFractionDigits: 3 });

type Props = {
  tipo: SlideType;
  nombre: string;
  descripcion: string;
  graficos: Readonly<Record<string, string>>;
  variantes: VariantesTipo | null;
  variante: string | null;
  onVariante: (v: string) => void;
  modo: ModoSelectorLamina;
  /** Plan del cambio contra la lámina actual (sólo al cambiar). */
  cambio: CambioTipoLamina | null;
  /** La variante que la lámina tiene hoy (si el tipo es el actual). */
  varianteActual: string | null;
  confirmando: boolean;
  nombreGrafico: (g: GraficadorRef) => string;
  nombreSlot: (slot: string) => string;
  nombreCampo: (clave: string) => string;
  onAplicar: () => void;
  onVolver: () => void;
};

function etiquetaBoton(p: Pick<Props, "modo" | "cambio" | "variantes" | "variante" | "varianteActual" | "confirmando">): { texto: string; deshabilitado: boolean } {
  if (p.modo === "insertar") return { texto: "Insertar esta lámina", deshabilitado: false };
  if (p.cambio?.mismoTipo) {
    if (!p.variantes) return { texto: "Es la lámina actual", deshabilitado: true };
    return { texto: "Usar esta variante", deshabilitado: p.variante === p.varianteActual };
  }
  const n = p.cambio?.sobrantes.length ?? 0;
  if (p.confirmando && n > 0) return { texto: `Cambiar y quitar ${n === 1 ? "1 gráfico" : `${n} gráficos`}`, deshabilitado: false };
  if (p.confirmando) return { texto: "Cambiar de todos modos", deshabilitado: false };
  return { texto: "Usar esta lámina", deshabilitado: false };
}

export function DetalleTipoLamina(props: Props) {
  const {
    tipo, nombre, descripcion, graficos, variantes, variante, onVariante, modo, cambio, confirmando,
    nombreGrafico, nombreSlot, nombreCampo, onAplicar, onVolver,
  } = props;
  const idVariantes = useId();
  const idAviso = useId();
  const slots = SLIDE_GRAF_SLOTS[tipo] ?? [];
  const comp = composicionDe(tipo, slots);
  const estandar = comp.base ? ESTANDAR_LAMINAS[comp.base] : undefined;
  const sobrantes = cambio && !cambio.mismoTipo ? cambio.sobrantes : [];
  const textos = cambio && !cambio.mismoTipo ? cambio.textosSobrantes : [];
  const hayPerdida = sobrantes.length > 0 || textos.length > 0;
  const boton = etiquetaBoton(props);
  const ranurasMedibles = comp.ranuras;

  return (
    <div className="pulso-f6-detalle">
      <div className="pulso-f6-detalle-lienzo">
        <ComposicionLamina
          tipo={tipo}
          slots={slots}
          graficos={graficos}
          variante={variante}
          numerar
          titulo={`Composición de «${nombre}»${Object.keys(graficos).length ? " con los gráficos de la lámina" : ""}`}
        />
      </div>
      <div className="pulso-f6-detalle-texto">
        <h3>{nombre}</h3>
        {(estandar?.uso || descripcion) && <p>{estandar?.uso ? `${estandar.uso}. ${descripcion}`.trim() : descripcion}</p>}
      </div>

      <dl className="pulso-f6-ficha">
        <dt>Admite</dt>
        <dd>{rotuloRanuras(tipo)}{comp.poblacion ? " · ícono del público" : ""}</dd>
        {estandar?.familia && (
          <>
            <dt>Escala de la familia</dt>
            <dd>{num(estandar.familia.escala)} · cifra {num(estandar.familia.cifra_pt)} pt · rótulo {num(estandar.familia.rotulo_pt)} pt</dd>
            <dt>Grosor de barra</dt>
            <dd>{num(estandar.familia.barra_in)} in</dd>
          </>
        )}
        {estandar?.cifra_valor_pt && (
          <>
            <dt>Cifra destacada</dt>
            <dd>{num(estandar.cifra_valor_pt)} pt</dd>
          </>
        )}
      </dl>

      {variantes && (
        <fieldset className="pulso-f6-variantes" aria-describedby={idVariantes}>
          <legend className="pulso-f6-selector-leyenda">{variantes.label}</legend>
          {variantes.opciones.map((o) => (
            <label key={o.valor} className="pulso-f6-variante">
              <input
                type="radio"
                className="pulso-f6-radio-oculto"
                name={`${idVariantes}-variante`}
                value={o.valor}
                checked={variante === o.valor}
                onChange={() => onVariante(o.valor)}
              />
              <ComposicionLamina tipo={tipo} slots={slots} variante={o.valor} />
              <span>{o.label}</span>
              {o.detalle && <small>{o.detalle}</small>}
            </label>
          ))}
          <span id={idVariantes} className="pulso-sr-only">Cambia la composición de la lámina; el contenido no cambia.</span>
        </fieldset>
      )}

      {comp.fuente !== "estructura" && (
        <p className="pulso-f6-nota">
          <Lock size={14} aria-hidden="true" />
          <span>Lo fija el recetario: dónde va cada ranura y lo que ocupa el gráfico adentro.</span>
        </p>
      )}

      {ranurasMedibles.length > 0 && (
        <details className="pulso-f6-medidas">
          <summary>Medidas del estándar</summary>
          <table>
            <caption>Ranuras en pulgadas de la lámina de 13,333 × 7,5</caption>
            <thead>
              <tr><th scope="col">Ranura</th><th scope="col">x</th><th scope="col">y</th><th scope="col">Ancho</th><th scope="col">Alto</th></tr>
            </thead>
            <tbody>
              {ranurasMedibles.map((r, i) => {
                const k = r.slot ? slots.indexOf(r.slot) + 1 : 0;
                const rotulo = r.tipo === "texto" ? "Texto" : `${r.tipo === "cifras" ? "Cifra" : "Gráfico"} ${k || ""}${r.slot ? ` · ${nombreSlot(r.slot)}` : ""}`.trim();
                return (
                  <tr key={`${r.tipo}-${i}`}>
                    <th scope="row">{rotulo}</th>
                    <td>{num(r.x)}</td><td>{num(r.y)}</td><td>{num(r.w)}</td><td>{num(r.h)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </details>
      )}

      <div className="pulso-f6-selector-pie">
        {hayPerdida && (
          <div className="pulso-f6-aviso-cambio" id={idAviso} role={confirmando ? "alert" : undefined}>
            <strong>
              <AlertTriangle size={14} aria-hidden="true" />{" "}
              {confirmando ? "Confirma el cambio: esto no pasa a la lámina nueva" : "Al cambiar, esto no pasa a la lámina nueva"}
            </strong>
            <ul>
              {sobrantes.map((g) => (
                <li key={g.slot}>{nombreGrafico(g.grafico)} <span>(ranura {nombreSlot(g.slot)})</span></li>
              ))}
              {textos.map((t) => <li key={t}>Texto «{nombreCampo(t)}»</li>)}
            </ul>
            <span>Los demás gráficos se conservan. Puedes deshacerlo después.</span>
          </div>
        )}
        {confirmando && <PulsoButton variant="secondary" size="sm" onClick={onVolver}>Elegir otra</PulsoButton>}
        <PulsoButton
          variant="primary"
          size="sm"
          disabled={boton.deshabilitado}
          aria-describedby={hayPerdida ? idAviso : undefined}
          onClick={onAplicar}
        >
          {boton.texto}
        </PulsoButton>
      </div>
    </div>
  );
}
