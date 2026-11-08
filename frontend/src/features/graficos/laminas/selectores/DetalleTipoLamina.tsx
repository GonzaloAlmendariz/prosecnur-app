// Detalle del tipo elegido en «¿Qué lámina?» (F6.2; dirección F6 §4.3, columna derecha): la composición en grande con
// sus ranuras numeradas y los gráficos acomodados, una frase de para qué sirve, qué admite y el tamaño de su texto en
// palabras, sus variantes, las medidas del estándar plegadas y el botón para aplicarla. Si el tipo nuevo deja gráficos
// o textos fuera, lo dice antes y pide confirmarlo.

import { useId, type ReactNode } from "react";
import { Check } from "../../../../vendor/lucide-react";
import type { GraficadorRef, SlideType } from "../../../../api/graficos";
import { PulsoButton } from "../../../../components/PulsoButton";
import { ComposicionLamina } from "../../iconos/ComposicionLamina";
import { composicionDe } from "../../iconos/composicion";
import { ESTANDAR_LAMINAS } from "../../iconos/estandarLaminas.generated";
import { SLIDE_GRAF_SLOTS } from "../../store";
import type { CambioTipoLamina } from "./cambioTipoLamina";
import type { ModoSelectorLamina } from "./selectoresStore";
import { etiquetaBoton, fraseDetalle, tamanoTexto } from "./detalleLamina";
import { AvisoCambio } from "./AvisoCambio";
import { ROTULO_CLASE } from "./intencionesContar";
import { MedidasEstandar } from "./MedidasEstandar";
import { RepartoGraficos } from "./RepartoGraficos";
import { rotuloRanuras, type VariantesTipo } from "./tiposLamina";

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
  /** Ficha «Datos» del gráfico de partida, si la tarjeta lo trae (FichaDatosTarjeta). */
  ficha?: ReactNode;
  onAplicar: () => void;
  onVolver: () => void;
};

export function DetalleTipoLamina(props: Props) {
  const {
    tipo, nombre, descripcion, graficos, variantes, variante, onVariante, modo, cambio, confirmando,
    nombreGrafico, nombreSlot, nombreCampo, ficha, onAplicar, onVolver,
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
  const frase = fraseDetalle(estandar?.uso, descripcion);
  const tamano = tamanoTexto(estandar?.familia);

  return (
    <div className="pulso-f6-detalle">
      <div className="pulso-f6-detalle-lienzo">
        <ComposicionLamina
          tipo={tipo}
          slots={slots}
          graficos={graficos}
          variante={variante}
          numerar
          titulo={`Composición de “${nombre}”${Object.keys(graficos).length ? " con los gráficos de la lámina" : ""}`}
        />
      </div>
      <div className="pulso-f6-detalle-texto">
        <h3>{nombre}</h3>
        <span className="pulso-f6-detalle-clase" data-clase-tarjeta="lamina">{ROTULO_CLASE.lamina}</span>
        {frase && <p>{frase}</p>}
      </div>

      <dl className="pulso-f6-ficha">
        <dt>Admite</dt>
        <dd>{rotuloRanuras(tipo)}</dd>
        {tamano && (
          <>
            <dt>Tamaño del texto</dt>
            <dd>{tamano}</dd>
          </>
        )}
      </dl>

      {ficha}

      {cambio && (
        <RepartoGraficos
          conservados={cambio.conservados}
          slots={slots}
          mismoTipo={cambio.mismoTipo}
          nombreGrafico={nombreGrafico}
          nombreSlot={nombreSlot}
        />
      )}

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


      <MedidasEstandar estandar={estandar} ranuras={comp.ranuras} slots={slots} nombreSlot={nombreSlot} />

      <div className="pulso-f6-selector-pie">
        <AvisoCambio id={idAviso} sobrantes={sobrantes} textos={textos} confirmando={confirmando}
          nombreGrafico={nombreGrafico} nombreSlot={nombreSlot} nombreCampo={nombreCampo} />
        <div className="pulso-f6-selector-acciones">
          {confirmando && <PulsoButton variant="secondary" size="lg" onClick={onVolver}>Elegir otra</PulsoButton>}
          <PulsoButton
            variant="primary"
            size="lg"
            className="pulso-f6-selector-aplicar"
            disabled={boton.deshabilitado}
            aria-describedby={hayPerdida ? idAviso : undefined}
            onClick={onAplicar}
          >
            {boton.deshabilitado && <Check size={14} aria-hidden="true" />}
            {boton.texto}
          </PulsoButton>
        </div>
      </div>
    </div>
  );
}
