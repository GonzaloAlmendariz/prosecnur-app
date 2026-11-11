import type { ReactNode } from "react";
import type { PreguntaAbierta } from "../../../api/codificacion";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { Panel } from "../../../components/Panel";
import { FichaPregunta } from "../../../components/procesamiento/FichaPregunta";
import { PulsoButton } from "../../../components/PulsoButton";
import { textoPlano } from "../../../lib/textoPlano";
import { tipoEnPalabras } from "../../../components/procesamiento/BloquePregunta";
import { Check, Link2, Link2Off, MousePointer2 } from "../../../vendor/lucide-react";
import { ModoSoControl } from "./ModoSoControl";
import {
  admiteCambiarTexto,
  columnaOtros,
  ejemplosDeUnidad,
  faltaModo,
  papelesDePareja,
  selectorDeEmparejar,
  tipoDeFicha,
  type ModoSo,
  type Unidad,
} from "./modeloUnidades";
import { SmDummyPicker } from "./SmDummyPicker";

export type InspectorUnidadProps = {
  unidad: Unidad | null;
  ocupada: boolean;
  /** El interruptor de incluir en codificación con su salida de no categorizar, o nada si no aplica. */
  incluir: ReactNode;
  onEmparejar: (unidad: Unidad) => void;
  onCambiar: (unidad: Unidad) => void;
  onDesemparejar: (unidad: Unidad) => void;
  onElegirModo: (padre: PreguntaAbierta, modo: ModoSo) => void;
  onElegirOtros: (padre: PreguntaAbierta, columna: string) => void;
};

type Identidad = { clave: string; tipo: string; codigo: string; etiqueta: string; notas: string[] };

function identidades(unidad: Unidad): Identidad[] {
  const p = unidad.principal;
  if (unidad.clase === "pareja") {
    const papeles = papelesDePareja(p);
    const aporta = unidad.aporta;
    return [
      { clave: p.parent, tipo: p.tipo, codigo: p.parent, etiqueta: textoPlano(p.parent_label), notas: [papeles.recibe] },
      {
        clave: `aporta:${unidad.columnaTexto}`,
        tipo: aporta?.tipo ?? "text",
        codigo: aporta?.parent ?? unidad.columnaTexto,
        etiqueta: aporta ? textoPlano(aporta.parent_label) : "",
        notas: [papeles.aporta],
      },
    ];
  }
  const notas: string[] = [];
  if (p.col_efectiva && p.col_efectiva !== p.parent) notas.push(`Texto leído desde ${p.col_efectiva}`);
  if (unidad.arquetipo === "auto") notas.push("Autocodifica con su diccionario");
  return [{ clave: p.parent, tipo: p.tipo, codigo: p.parent, etiqueta: textoPlano(p.parent_label), notas }];
}

/**
 * El inspector de la unidad seleccionada: quiénes son sus preguntas, qué se respondió y los controles
 * que deciden su codificación. Llega hasta el borde inferior de la superficie; su cuerpo es el único que
 * se desplaza y el pie con las acciones queda siempre a la vista.
 */
export function InspectorUnidad({
  unidad, ocupada, incluir, onEmparejar, onCambiar, onDesemparejar, onElegirModo, onElegirOtros,
}: InspectorUnidadProps) {
  if (!unidad) {
    return (
      <Panel noPadding className="pulso-preg-inspector" aria-label="Pregunta seleccionada">
        <div className="pulso-preg-insp-cuerpo">
          <EstadoVacio
            tamano="normal"
            icono={<MousePointer2 size={18} />}
            titulo="Sin pregunta seleccionada"
            descripcion="Selecciona una fila de la lista para emparejarla o decidir si se codifica."
          />
        </div>
      </Panel>
    );
  }

  const p = unidad.principal;
  const esPareja = unidad.clase === "pareja";
  const fichas = identidades(unidad);
  const muestras = ejemplosDeUnidad(unidad);
  const selector = selectorDeEmparejar(unidad);
  const otros = columnaOtros(p);
  const opciones = p.opciones_sm ?? [];
  const conOpciones = esPareja && opciones.length > 0;
  // Lo que decide cómo se codifica la pareja: el modo de una de opción única, la opción "Otros" de una múltiple.
  const modo =
    esPareja && p.tipo === "select_one" ? (
      <section className="pulso-preg-insp-seccion">
        <h4 className="pulso-preg-insp-rotulo">Modo de codificación</h4>
        <ModoSoControl
          parent={p.parent}
          childCol={unidad.columnaTexto}
          current={p.modo_so === "padre" || p.modo_so === "hijo" ? p.modo_so : null}
          busy={ocupada}
          onChange={(elegido) => onElegirModo(p, elegido)}
        />
      </section>
    ) : null;
  const opcionOtros = conOpciones ? (
    <SmDummyPicker key={p.parent} padre={p} opciones={opciones} busy={ocupada} selectedCol={otros} onSelect={(col) => onElegirOtros(p, col)} />
  ) : null;
  const decision = (
    <>
      {modo}
      {opcionOtros}
    </>
  );
  const pendiente = faltaModo(unidad) || (conOpciones && otros === "");
  // El título dice qué es la unidad; el texto de sus preguntas va debajo, entero y una sola vez.
  const titulo = esPareja ? "Pregunta emparejada" : unidad.arquetipo === "no-aplica" ? "Pregunta desactivada" : "Pregunta suelta";

  return (
    <Panel noPadding className="pulso-preg-inspector" aria-label="Pregunta seleccionada" aria-busy={ocupada || undefined}>
      <header className="pulso-preg-insp-cab">
        <h3 className="pulso-preg-insp-titulo">{titulo}</h3>
      </header>

      <div className="pulso-preg-insp-cuerpo">
        <section className="pulso-preg-insp-seccion" aria-label={esPareja ? "Preguntas de la pareja" : "Pregunta"}>
          <ul className="pulso-preg-identidad">
            {fichas.map((f) => (
              <li key={f.clave}>
                <FichaPregunta
                  tipo={tipoDeFicha(f.tipo)}
                  codigo={f.etiqueta ? f.codigo : undefined}
                  etiqueta={f.etiqueta || f.codigo}
                  className="pulso-preg-ficha"
                />
                <span className="pulso-preg-lado-pie">
                  <span>{tipoEnPalabras(tipoDeFicha(f.tipo))}</span>
                  {f.notas.map((nota) => (
                    <span key={nota}>{nota}</span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Lo que falta decidir va primero, antes de los ejemplos: la opción "Otros" de una múltiple o el
            modo de una única. Ya decidido, baja después de los ejemplos. */}
        {pendiente ? decision : null}

        {muestras.length > 0 ? (
          <section className="pulso-preg-insp-seccion">
            <h4 className="pulso-preg-insp-rotulo">Ejemplos de respuestas</h4>
            <ul className="pulso-preg-ejemplos">
              {muestras.map((texto, i) => (
                <li key={`${i}:${texto}`}>{texto}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {pendiente ? null : decision}

        {/* Sin la lista de opciones no hay selector: se muestra la columna que ya está puesta. */}
        {esPareja && opciones.length === 0 && otros ? (
          <section className="pulso-preg-insp-seccion">
            <h4 className="pulso-preg-insp-rotulo">Opción "Otros, especifique"</h4>
            <p className="pulso-preg-otros-fija">
              <Check size={14} aria-hidden="true" />
              <code>{otros}</code>
            </p>
          </section>
        ) : null}

        {incluir ? (
          <section className="pulso-preg-insp-seccion">
            <h4 className="pulso-preg-insp-rotulo">Codificación</h4>
            {incluir}
          </section>
        ) : null}
      </div>

      {esPareja ? (
        <footer className="pulso-preg-insp-pie">
          {/* El selector de columna de texto es de una pregunta cerrada: sin ella, la pareja solo se deshace. */}
          {admiteCambiarTexto(unidad) ? (
            <PulsoButton variant="secondary" size="lg" disabled={ocupada} onClick={() => onCambiar(unidad)}>
              Cambiar texto
            </PulsoButton>
          ) : null}
          <PulsoButton variant="secondary" size="lg" disabled={ocupada} onClick={() => onDesemparejar(unidad)}>
            <Link2Off size={14} aria-hidden="true" />
            Desemparejar
          </PulsoButton>
        </footer>
      ) : selector ? (
        <footer className="pulso-preg-insp-pie">
          <PulsoButton
            variant={p.candidatos_texto?.length ? "primary" : "secondary"}
            size="lg"
            disabled={ocupada}
            onClick={() => onEmparejar(unidad)}
          >
            <Link2 size={14} aria-hidden="true" />
            Emparejar con
          </PulsoButton>
        </footer>
      ) : null}
    </Panel>
  );
}
