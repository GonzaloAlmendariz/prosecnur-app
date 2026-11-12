/**
 * El panel de regla propia (rebanada V2 del plan de fidelidad; prototipo
 * `panelRegla`, `vistas.js:529-604`). Un `Sideover` ancho con dos estados:
 *
 *   - "Qué quieres revisar": el tipo de una regla nueva y las sugeridas.
 *   - La regla: su nombre (editable), la frase, "Condiciones", "Resultado" y
 *     "Casos que marca hoy" con el conteo previo del motor.
 *
 * Reemplaza al asistente de tres pasos de `components/ReglaEditor.tsx`. Lo que
 * guarda lo arma `borradorDeRegla.ts` y es, para las mismas entradas, lo que
 * guardaba el asistente. Quien lo monta decide dónde se abre (la dirección,
 * con `usePanelRegla`) y qué se hace al guardar.
 */
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { FichaPregunta } from "../../../../components/procesamiento/FichaPregunta";
import { FraseRegla } from "../../../../components/procesamiento/FraseRegla";
import { Dialog } from "../../../../components/Dialog";
import { EstadoVacio } from "../../../../components/EstadoVacio";
import { CargaDeBloque } from "../../../../components/CargaDeBloque";
import { PulsoButton } from "../../../../components/PulsoButton";
import { PulsoInput } from "../../../../components/PulsoInput";
import { Sideover } from "../../../../components/Sideover";
import { AlertTriangle, Pencil, Play } from "../../../../vendor/lucide-react";
import type { ExploradorVariable, ReglaSemilla } from "../../types";
import { fraseDeReglaPropia, type PiezaDeFrase } from "../../customRuleNarrative";
import {
  borradorInicial,
  cuerpoAGuardar,
  cuerpoParaProbar,
  lectorDeTipos,
  nombreDelBorrador,
  reducirBorrador,
  validarBorrador,
  variablesEfectivas,
} from "../borradorDeRegla";
import { etiquetaDeOpcion, OpcionesProvider, useOpcionesDeVariables } from "../campos/opcionesDeVariable";
import { tieneOpciones, tipoDeFicha } from "../campos/tipoDeFicha";
import { metaDeTipo } from "../tiposDeRegla";
import type { ReglaPropia, ReglaPropiaAGuardar, TipoReglaPropia } from "../tiposDelMotor";
import { CasosQueMarca, conteoSinDatos } from "./CasosQueMarca";
import { Condiciones } from "./Condiciones";
import { ICONO_DE_TIPO, QueRevisar } from "./QueRevisar";
import { Resultado } from "./Resultado";
import { useConteoPrevio } from "./useConteoPrevio";
import { useCatalogoDeReglas } from "./useCatalogoDeReglas";
import { sinEvaluarDelFormulario } from "../../../../api/validacionCatalogo";
import "./panel.css";

export type AlGuardarRegla = (cuerpo: ReglaPropiaAGuardar, opciones: { auditar: boolean }) => Promise<void>;

export type PanelReglaProps = {
  abierto: boolean;
  onCerrar: () => void;
  /** La regla que se edita; `null` para una nueva. */
  inicial: ReglaPropia | null;
  /** Se pidió editar una regla que no está en la lista de esta base. */
  focoInexistente?: string | null;
  /** El tipo de una nueva, si ya se eligió (`tipo=` en la dirección). */
  tipoElegido?: TipoReglaPropia | null;
  /** La pregunta con que llega armada una nueva (`pregunta=`). */
  pregunta?: string | null;
  /** Elegir el tipo de una nueva (lo escribe en la dirección); `null` vuelve a "Qué quieres revisar". */
  onElegirTipo?: (tipo: TipoReglaPropia | null) => void;
  variables: readonly ExploradorVariable[];
  baseNombre: string | null;
  semillas: readonly ReglaSemilla[];
  onGuardar: AlGuardarRegla;
  /** "Ver en Explorar": abre la pregunta revisada. */
  onVerEnExplorar?: (variable: string) => void;
  /** Para el QA y las pruebas: la raíz lleva `data-pulso-panel`. */
  panelProps?: { "data-pulso-panel": string };
  /** Las preguntas todavía se están leyendo. */
  cargandoPreguntas?: boolean;
  /** "Ver" en la fila de las reglas del formulario sin evaluar. */
  onVerSinEvaluar?: () => void;
};

/** La clave que reinicia el borrador: otra regla, o una nueva con otro arranque. */
function claveDelBorrador(p: Pick<PanelReglaProps, "inicial" | "focoInexistente" | "pregunta">, semilla: ReglaSemilla | null) {
  return [p.inicial?.id ?? "nueva", p.focoInexistente ?? "", p.pregunta ?? "", semilla?.nombre ?? ""].join("\u0000");
}

export function PanelRegla(props: PanelReglaProps) {
  const [semilla, setSemilla] = useState<ReglaSemilla | null>(null);
  // Cerrar y volver a abrir empieza de cero: la clave cambia y el borrador se rehace.
  const clave = props.abierto ? claveDelBorrador(props, semilla) : "cerrado";
  if (!props.abierto && semilla) setSemilla(null);
  return (
    <OpcionesProvider baseNombre={props.baseNombre}>
      <EditorDelPanel key={clave} {...props} semilla={semilla} onUsarSemilla={setSemilla} />
    </OpcionesProvider>
  );
}

function FraseDeLaRegla({ piezas, variables }: { piezas: readonly PiezaDeFrase[]; variables: readonly ExploradorVariable[] }) {
  const porNombre = new Map(variables.map((v) => [v.name, v]));
  return (
    <>
      {piezas.map((p, i) => {
        if (p.tipo === "pregunta") {
          const meta = porNombre.get(p.variable);
          // Sin etiqueta propia, el código una sola vez.
          const conEtiqueta = !!meta?.label && meta.label !== p.variable;
          return (
            <FichaPregunta
              key={i}
              tipo={tipoDeFicha(meta?.tipo)}
              codigo={conEtiqueta ? p.variable : undefined}
              etiqueta={conEtiqueta ? meta.label : p.variable}
            />
          );
        }
        // Un valor corto (una fecha, un número) no se parte entre dos líneas.
        if (p.tipo === "valor") {
          return (
            <strong key={i} className={p.texto.length <= 24 ? "pulso-panel-regla-valor-entero" : undefined}>
              {p.texto}
            </strong>
          );
        }
        if (p.tipo === "conector") return <em key={i}>{p.texto}</em>;
        return <span key={i}>{p.texto}</span>;
      })}
    </>
  );
}

function EditorDelPanel({
  abierto,
  panelProps,
  inicial,
  focoInexistente,
  tipoElegido = null,
  pregunta = null,
  onElegirTipo,
  variables,
  baseNombre,
  semillas,
  onGuardar,
  onCerrar,
  onVerEnExplorar,
  cargandoPreguntas = false,
  onVerSinEvaluar,
  semilla,
  onUsarSemilla,
}: PanelReglaProps & { semilla: ReglaSemilla | null; onUsarSemilla: (s: ReglaSemilla | null) => void }) {
  const [borrador, despachar] = useReducer(reducirBorrador, { inicial, tipo: tipoElegido, pregunta, semilla }, borradorInicial);
  const [eligiendoTipo, setEligiendoTipo] = useState(false);
  const [editandoNombre, setEditandoNombre] = useState(false);
  const [envio, setEnvio] = useState<{ guardando: boolean; error: string }>({ guardando: false, error: "" });
  const tipoDeVariable = useMemo(() => lectorDeTipos(variables), [variables]);

  // Sin tipo, o tras "Cambiar": "Qué quieres revisar". El tipo de una nueva
  // también se escribe en la dirección (`tipo=`), para que el enlace la reabra.
  const nueva = !inicial;
  const vistaTipo = !focoInexistente && (eligiendoTipo || !borrador.tipo);
  const meta = metaDeTipo(borrador.tipo);

  const cuerpoDeConteo = useMemo(
    () => (vistaTipo || focoInexistente ? null : cuerpoParaProbar(borrador, tipoDeVariable)),
    [borrador, tipoDeVariable, vistaTipo, focoInexistente],
  );
  const { estado: conteo, reintentar } = useConteoPrevio(cuerpoDeConteo, baseNombre);
  const sinDatos = conteoSinDatos(conteo);
  const catalogo = useCatalogoDeReglas(abierto && !cargandoPreguntas && nueva && vistaTipo, baseNombre);
  const sinEvaluar = catalogo ? sinEvaluarDelFormulario(catalogo) : null;

  // Cerrar con cambios pide confirmar. Esc con un desplegable abierto lo cierra
  // Radix (el desplegable es la capa de arriba): aquí no se intercepta nada.
  const [inicioDelBorrador] = useState(() => JSON.stringify(borrador));
  const conCambios = JSON.stringify(borrador) !== inicioDelBorrador;
  const [confirmar, setConfirmar] = useState(false);
  function intentarCerrar() {
    if (conCambios) setConfirmar(true);
    else onCerrar();
  }

  const variablesDeLaRegla = variablesEfectivas(borrador);
  // Las etiquetas de las respuestas que nombra la frase: las de la regla y las del filtro.
  const conLista = [...new Set([...variablesDeLaRegla, ...borrador.gateConditions.map((g) => g.variable)])].filter((v) =>
    tieneOpciones(variables.find((x) => x.name === v)?.tipo),
  );
  const opciones = useOpcionesDeVariables(conLista);
  const piezas = fraseDeReglaPropia(
    { tipo: borrador.tipo, variables: variablesDeLaRegla, params: borrador.params, gate_conditions: borrador.gateConditions },
    (variable, codigo) => {
      const opcion = opciones.get(variable)?.find((o) => o.code === codigo);
      return opcion ? opcion.label || codigo : etiquetaDeOpcion(undefined, codigo);
    },
  );

  function elegirTipo(tipo: TipoReglaPropia) {
    despachar({ tipo: "elegir-tipo", valor: tipo });
    setEligiendoTipo(false);
    if (nueva) onElegirTipo?.(tipo);
  }

  async function guardar(auditar: boolean) {
    const error = validarBorrador(borrador);
    if (error) {
      setEnvio({ guardando: false, error });
      return;
    }
    const cuerpo = cuerpoAGuardar(borrador, inicial, tipoDeVariable, variables);
    if (!cuerpo) return;
    setEnvio({ guardando: true, error: "" });
    try {
      await onGuardar(cuerpo, { auditar });
      setEnvio({ guardando: false, error: "" });
    } catch (e) {
      setEnvio({ guardando: false, error: e instanceof Error ? e.message : String(e) });
    }
  }

  const base = baseNombre ? ` de ${baseNombre}` : "";
  const antetitulo = nueva && !focoInexistente ? `Nueva regla propia${base}` : `Regla propia${base}`;
  const Icono = borrador.tipo ? ICONO_DE_TIPO[borrador.tipo] : null;
  const revisada = variablesDeLaRegla[0] ?? null;

  let titulo;
  let cuerpo;
  let pie;
  if (cargandoPreguntas) {
    titulo = <span className="pulso-panel-regla-titulo">{nueva ? "Qué quieres revisar" : "Regla propia"}</span>;
    // Retiene la readiness de la pestaña mientras llegan las preguntas (readinessAnidada).
    cuerpo = <CargaDeBloque label="Cargando las preguntas de la base" />;
    pie = (
      <PulsoButton variant="secondary" size="lg" onClick={onCerrar}>
        Cancelar
      </PulsoButton>
    );
  } else if (focoInexistente) {
    titulo = <span className="pulso-panel-regla-titulo">Regla no encontrada</span>;
    cuerpo = (
      <div className="pulso-panel-regla-vacio">
        <EstadoVacio
          icono={<AlertTriangle size={20} />}
          titulo={`La regla ${focoInexistente} no está en esta base`}
          descripcion="Puede ser de otra base o haberse eliminado."
        />
      </div>
    );
    pie = (
      <PulsoButton variant="secondary" size="lg" onClick={onCerrar}>
        Cerrar
      </PulsoButton>
    );
  } else if (vistaTipo) {
    titulo = <span className="pulso-panel-regla-titulo">Qué quieres revisar</span>;
    cuerpo = (
      <div className="pulso-panel-regla-tipo">
        <QueRevisar
          tipoActual={borrador.tipo}
          tipoDeLaRegla={inicial?.tipo ?? null}
          semillas={nueva ? semillas : null}
          sinEvaluar={nueva ? sinEvaluar : null}
          onVerSinEvaluar={onVerSinEvaluar}
          onElegir={elegirTipo}
          onUsarSemilla={(s) => onUsarSemilla(s)}
        />
      </div>
    );
    pie = (
      <PulsoButton variant="secondary" size="lg" onClick={eligiendoTipo ? () => setEligiendoTipo(false) : intentarCerrar}>
        {eligiendoTipo ? "Volver a la regla" : "Cancelar"}
      </PulsoButton>
    );
  } else {
    const nombre = nombreDelBorrador(borrador, variables);
    titulo = editandoNombre ? (
      <PulsoInput
        className="pulso-panel-regla-nombre"
        autoFocus
        value={borrador.nombre}
        placeholder={nombre}
        aria-label="Nombre de la regla"
        onChange={(e) => despachar({ tipo: "nombre", valor: e.target.value })}
        onBlur={() => setEditandoNombre(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            setEditandoNombre(false);
          }
        }}
      />
    ) : (
      <span className="pulso-panel-regla-titulo">
        <span className="pulso-panel-regla-titulo-texto">{nombre}</span>
        <PulsoButton variant="icon" size="sm" aria-label="Cambiar el nombre" title="Cambiar el nombre" onClick={() => setEditandoNombre(true)}>
          <Pencil size={13} aria-hidden="true" />
        </PulsoButton>
      </span>
    );
    cuerpo = (
      <div className="pulso-panel-regla-dos" data-qa-geometry-group="validacion/regla-panel" data-qa-geometry-contract="intrinsic">
        <div className="pulso-panel-regla-col" data-qa-geometry-member="">
          <FraseRegla
            tipo={meta?.rotulo ?? ""}
            icono={Icono ? <Icono size={15} /> : undefined}
            accion={
              <PulsoButton variant="link" size="sm" onClick={() => setEligiendoTipo(true)}>
                Cambiar
              </PulsoButton>
            }
          >
            {piezas ? <FraseDeLaRegla piezas={piezas} variables={variables} /> : <span className="pulso-panel-regla-frase-pendiente">{meta?.descripcion}</span>}
          </FraseRegla>
          <Condiciones borrador={borrador} despachar={despachar} variables={variables} />
          <Resultado borrador={borrador} despachar={despachar} />
        </div>
        <div className="pulso-panel-regla-col pulso-panel-regla-col--casos" data-qa-geometry-member="">
          <CasosQueMarca
            estado={conteo}
            onReintentar={reintentar}
            inconsistencia={borrador.hallazgoKind === "inconsistencia_usuario"}
            variables={variables}
            onVerEnExplorar={revisada && onVerEnExplorar ? () => onVerEnExplorar(revisada) : null}
          />
        </div>
      </div>
    );
    pie = (
      <>
        <PulsoButton variant="secondary" size="lg" onClick={intentarCerrar} disabled={envio.guardando}>
          Cancelar
        </PulsoButton>
        <PulsoButton
          variant={sinDatos ? "primary" : "secondary"}
          size="lg"
          className={sinDatos ? "pulso-panel-regla-principal" : undefined}
          onClick={() => void guardar(false)}
          disabled={envio.guardando}
        >
          Guardar
        </PulsoButton>
        {sinDatos ? null : (
          <PulsoButton variant="primary" size="lg" className="pulso-panel-regla-principal" onClick={() => void guardar(true)} disabled={envio.guardando}>
            <Play size={14} aria-hidden="true" />
            Guardar y auditar
          </PulsoButton>
        )}
      </>
    );
  }

  const pista = envio.error ? (
    <span className="pulso-panel-regla-error" role="alert">
      {envio.error}
    </span>
  ) : vistaTipo ? (
    <span>Obligatorias, saltos, restricciones, filtros de opciones y valores calculados ya salen del formulario.</span>
  ) : focoInexistente ? null : (
    <span>{sinDatos ? "Se audita cuando haya respuestas." : "Sus casos entran a Hallazgos al auditar."}</span>
  );

  return (
    <Sideover
      open={abierto}
      onOpenChange={(siguiente) => {
        if (!siguiente) intentarCerrar();
      }}
      title={titulo}
      subtitle={antetitulo}
      className="pulso-panel-regla"
      bodyClassName="pulso-panel-regla-cuerpo"
      closeLabel="Cerrar la regla"
      dismissible={!envio.guardando}
      footer={pie}
      footerHint={pista}
    >
      <div className="pulso-panel-regla-contenido" data-pulso-panel={panelProps?.["data-pulso-panel"]}>
        {cuerpo}
      </div>
      <Dialog
        open={confirmar}
        onOpenChange={setConfirmar}
        size="sm"
        tono="aviso"
        title="Descartar los cambios de la regla"
        closeLabel="Cerrar la confirmación"
        footer={
          <>
            <PulsoButton variant="secondary" onClick={() => setConfirmar(false)}>
              Seguir editando
            </PulsoButton>
            <PulsoButton
              variant="danger"
              confirm
              onClick={() => {
                setConfirmar(false);
                onCerrar();
              }}
            >
              Descartar los cambios
            </PulsoButton>
          </>
        }
      >
        <p className="pulso-panel-regla-confirmar">Al cerrar se pierde lo que cambiaste desde que abriste la regla.</p>
      </Dialog>
    </Sideover>
  );
}
