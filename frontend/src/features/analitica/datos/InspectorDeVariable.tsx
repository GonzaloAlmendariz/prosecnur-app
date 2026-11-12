// El inspector de Analítica › Datos (prototipo, panel de la variable elegida):
// la etiqueta de la variable con la del formulario debajo, las etiquetas de sus
// opciones con su conteo, su sección y con cuánto dato llegó. Al pie, "Restaurar"
// y "Confirmar etiquetas", que confirma todo el borrador y no solo esta variable.
// La variable llega por `?foco=`: el inspector no guarda selección.

import type { DataReviewVariable } from "../../../api/analitica";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { BotonCerrar } from "../../../components/BotonCerrar";
import { PanelDeMesa } from "../../../components/procesamiento/PanelDeMesa";
import { PulsoButton } from "../../../components/PulsoButton";
import { PulsoSelect } from "../../../components/PulsoSelect";
import { formatoConteo } from "../../../lib/formatoNumero";
import { textoPlano } from "../../../lib/textoPlano";
import { Check, RotateCcw, Tags } from "../../../vendor/lucide-react";
import { describirCobertura } from "../coberturaVariable";
import { AvisosEtiqueta } from "../panes/revisionEtiquetas/AvisosEtiqueta";
import { opcionesEquivalentes, problemasDeEtiqueta, type ProblemaEtiqueta } from "../panes/revisionEtiquetas/detectorEtiquetas";
import { CampoDeEtiqueta } from "./CampoDeEtiqueta";
import { casosDeLaVariable } from "./modeloDeVariables";

export type SeccionElegible = { id: string; nombre: string };

export type InspectorDeVariableProps = {
  variable: DataReviewVariable | null;
  etiqueta: string;
  etiquetaDeOpcion: (code: string) => string;
  editables: boolean;
  incluida: boolean;
  /** Su sección está oculta. */
  bloqueada: boolean;
  repartida: boolean;
  /** La sección de la variable y las que el formulario declara; sin declaradas no se puede cambiar. */
  seccion: SeccionElegible | null;
  secciones: readonly SeccionElegible[];
  hayCambios: boolean;
  pendientes: number;
  onEtiqueta: (name: string, label: string) => void;
  onEtiquetaDeOpcion: (name: string, code: string, label: string) => void;
  onSeccion: (name: string, seccionId: string) => void;
  onRestaurar: (name: string) => void;
  onConfirmar: () => void;
  onCerrar: () => void;
};

function Pie({ variable, hayCambios, pendientes, onRestaurar, onConfirmar }: Pick<InspectorDeVariableProps, "variable" | "hayCambios" | "pendientes" | "onRestaurar" | "onConfirmar">) {
  return (
    <>
      <PulsoButton
        variant="secondary"
        size="lg"
        disabled={!variable || !hayCambios}
        onClick={() => variable && onRestaurar(variable.name)}
        title="Vuelve a las etiquetas del formulario en esta variable"
      >
        <RotateCcw size={14} aria-hidden="true" />
        Restaurar
      </PulsoButton>
      <PulsoButton
        variant="primary"
        size="lg"
        className="datos-confirmar"
        disabled={pendientes === 0}
        onClick={onConfirmar}
        title={pendientes === 0 ? "No hay etiquetas por confirmar. Incluir o excluir variables se guarda solo." : undefined}
      >
        <Check size={14} aria-hidden="true" />
        Confirmar etiquetas
      </PulsoButton>
    </>
  );
}

export function InspectorDeVariable(props: InspectorDeVariableProps) {
  const { variable } = props;
  const pie = <Pie {...props} />;
  if (!variable) {
    return (
      <PanelDeMesa zona="inspector" titulo="Etiquetas de la variable" pie={pie}>
        <div className="datos-inspector">
          <EstadoVacio
            icono={<Tags size={16} />}
            titulo="Elige una variable"
            descripcion="Aquí se editan su etiqueta y las de sus opciones."
          />
        </div>
      </PanelDeMesa>
    );
  }

  const cobertura = describirCobertura(variable, props.repartida);
  const opciones = variable.opciones.map((o) => ({ ...o, etiqueta: props.etiquetaDeOpcion(o.code) }));
  const equivalentes = props.editables
    ? opcionesEquivalentes(opciones.map((o) => ({ code: o.code, label: o.etiqueta })))
    : new Map<string, ProblemaEtiqueta>();
  const original = variable.label_original?.trim();
  const padre = variable.dummy_parent?.trim();
  const casos = casosDeLaVariable(variable);
  const conDato = Math.max(0, variable.n_non_missing ?? 0);
  const titulo = `${variable.name}, ${props.etiqueta.trim() || "sin etiqueta"}`;

  return (
    <PanelDeMesa
      zona="inspector"
      titulo={titulo}
      etiquetaCuerpo={`Etiquetas de ${variable.name}`}
      acciones={<BotonCerrar onClick={props.onCerrar} aria-label="Cerrar el inspector" />}
      pie={pie}
    >
      <div className="datos-inspector" data-qa-geometry-group="analitica/datos-inspector" data-qa-geometry-contract="intrinsic">
        <div className="datos-bloque">
          <label className="datos-rotulo" htmlFor="datos-etiqueta-variable">Etiqueta de la variable</label>
          <CampoDeEtiqueta
            id="datos-etiqueta-variable"
            value={props.etiqueta}
            invalid={!props.etiqueta.trim()}
            onValor={(valor) => props.onEtiqueta(variable.name, valor)}
          />
          {original && original !== props.etiqueta.trim() ? (
            <span className="datos-mas">En el formulario: "{textoPlano(original)}"</span>
          ) : null}
          <AvisosEtiqueta problemas={problemasDeEtiqueta(props.etiqueta)} onAplicar={(t) => props.onEtiqueta(variable.name, t)} />
          {padre ? (
            <span className="datos-mas">
              Opción de <code>{padre}</code>{variable.dummy_parent_label?.trim() ? `, ${textoPlano(variable.dummy_parent_label)}` : ""}
            </span>
          ) : null}
        </div>

        <div className="datos-bloque">
          <h3 className="datos-rotulo">Etiquetas de las opciones</h3>
          {props.editables ? (
            // C1: una opción con avisos de redacción crece de alto.
            <ul className="datos-opciones" data-qa-geometry-group="analitica/datos-opciones" data-qa-geometry-contract="intrinsic">
              {opciones.map((o) => {
                const avisos = [
                  ...problemasDeEtiqueta(o.etiqueta, { esOpcion: true }),
                  ...(equivalentes.get(o.code) ? [equivalentes.get(o.code) as ProblemaEtiqueta] : []),
                ];
                return (
                  <li key={o.code} className="datos-opcion">
                    <code>{o.code}</code>
                    <CampoDeEtiqueta
                      value={o.etiqueta}
                      invalid={!o.etiqueta.trim()}
                      aria-label={`Etiqueta de la opción ${o.code} de ${variable.name}`}
                      onValor={(valor) => props.onEtiquetaDeOpcion(variable.name, o.code, valor)}
                    />
                    <em title={`${formatoConteo(o.count)} ${o.count === 1 ? "caso eligió" : "casos eligieron"} esta opción`}>{formatoConteo(o.count)}</em>
                    {avisos.length > 0 ? (
                      <div className="datos-opcion-avisos">
                        <AvisosEtiqueta problemas={avisos} onAplicar={(t) => props.onEtiquetaDeOpcion(variable.name, o.code, t)} />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <span className="datos-mas">Esta variable no tiene opciones que etiquetar.</span>
          )}
        </div>

        <div className="datos-bloque">
          <span className="datos-rotulo">Sección</span>
          {props.seccion && props.secciones.some((s) => s.id === props.seccion?.id) ? (
            <PulsoSelect
              ariaLabel="Sección de la variable"
              value={props.seccion.id}
              onValueChange={(id) => props.onSeccion(variable.name, id)}
              options={props.secciones.map((s) => ({ value: s.id, label: textoPlano(s.nombre) }))}
            />
          ) : (
            <span className="datos-mas">
              {props.seccion ? textoPlano(props.seccion.nombre) : "Sin sección"}. Detecta las secciones del formulario para poder cambiarla.
            </span>
          )}
          {props.bloqueada ? <span className="datos-mas">La sección está oculta: sus variables no entran a los entregables.</span> : null}
          {!props.bloqueada && !props.incluida ? <span className="datos-mas">Excluida: no sale en los entregables.</span> : null}
        </div>

        <div className="datos-impacto" data-tono={cobertura.aviso ? "aviso" : undefined}>
          {cobertura.estado === "normal" || cobertura.estado === "vacia" ? (
            <>
              <b>{formatoConteo(conDato)}</b>
              <span>de {formatoConteo(casos)} casos {conDato === 1 ? "tiene" : "tienen"} dato.{cobertura.aviso ? ` ${cobertura.aviso.detalle}` : ""}</span>
            </>
          ) : (
            <span>{cobertura.aviso ? `${cobertura.aviso.detalle}` : "Su columna no está en la base: el dato llega en una columna por opción."}</span>
          )}
        </div>
      </div>
    </PanelDeMesa>
  );
}
