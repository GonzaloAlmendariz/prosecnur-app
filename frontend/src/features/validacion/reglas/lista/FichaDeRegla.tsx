/**
 * Ficha de la regla elegida, a la derecha de Reglas (prototipo `pp-v-ficha`,
 * `vistas.js:648-659`): la frase con el tipo, lo que produce, el tratamiento,
 * el alcance y la última auditoría con su base ("7 de 142 a quienes les
 * correspondía responder"). Según la regla:
 *
 *   - Un salto muestra sus dos sentidos ("Casos que marca") y su condición en el formulario.
 *   - Una regla sin evaluar dice por qué y ofrece convertirla en regla propia.
 *   - Una propia se edita en su panel; una del formulario se activa o desactiva aquí.
 *
 * Los avisos del motor sobre la regla van enteros, con su causa.
 */
import type { ReactNode } from "react";
import {
  Asterisk,
  Calculator,
  Calendar,
  Copy,
  Filter,
  Hash,
  Inbox,
  type LucideIcon,
  Pencil,
  Plus,
  Repeat,
  Split,
} from "../../../../vendor/lucide-react";
import { CifraHallazgo } from "../../../../components/procesamiento/CifraHallazgo";
import { FraseRegla } from "../../../../components/procesamiento/FraseRegla";
import { PanelDeMesa } from "../../../../components/procesamiento/PanelDeMesa";
import { PulsoButton } from "../../../../components/PulsoButton";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { ICONO_DE_TIPO } from "../panel/QueRevisar";
import { metaDeTipo } from "../tiposDeRegla";
import { esTipoReglaPropia } from "../tiposDelMotor";
import { FraseDelCatalogo } from "./FraseDelCatalogo";
import {
  estadoDeFila,
  fechaCortaDeAuditoria,
  rotuloDeClase,
  textoDeAlcance,
  textoDeBase,
  textoDeTratamiento,
  type AvisoDelCatalogo,
  type ReglaDelCatalogo,
} from "./modeloCatalogo";

const TIPO_DEL_FORMULARIO: Readonly<Record<string, { nombre: string; icono: LucideIcon }>> = {
  obligatoria: { nombre: "Respuesta obligatoria del formulario", icono: Asterisk },
  salto: { nombre: "Salto del formulario", icono: Split },
  restriccion: { nombre: "Restricción del formulario", icono: Hash },
  filtro_opciones: { nombre: "Filtro de opciones del formulario", icono: Filter },
  calculo: { nombre: "Valor calculado del formulario", icono: Calculator },
  grupo_repetido: { nombre: "Grupo repetido del formulario", icono: Repeat },
  periodo: { nombre: "Control del operativo", icono: Calendar },
  casi_iguales: { nombre: "Control del operativo", icono: Copy },
};

function tipoDeLaRegla(regla: ReglaDelCatalogo): { nombre: string; icono: LucideIcon } {
  if (regla.origen === "propia" && esTipoReglaPropia(regla.familia)) {
    return { nombre: metaDeTipo(regla.familia)?.label ?? regla.familia_nombre, icono: ICONO_DE_TIPO[regla.familia] };
  }
  return TIPO_DEL_FORMULARIO[regla.familia] ?? { nombre: regla.familia_nombre || "Regla", icono: Hash };
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="pulso-rl-ficha-seccion">
      <h4 className="pulso-rl-seccion-rotulo">{titulo}</h4>
      {children}
    </section>
  );
}

const CAUSAS_CONVERTIBLES = new Set(["expresion_no_leida", "expresion_no_traducida", "error_al_evaluar"]);

const SENTIDOS = {
  debe: "Le correspondía y está vacía",
  nodebe: "No le correspondía y tiene respuesta",
} as const;

function QueMarca({ regla, pareja, onElegir }: { regla: ReglaDelCatalogo; pareja: ReglaDelCatalogo | null; onElegir: (id: string) => void }) {
  if (!regla.direccion) return null;
  const sentidos: Array<{ direccion: "debe" | "nodebe"; regla: ReglaDelCatalogo | null }> = [
    { direccion: "debe", regla: regla.direccion === "debe" ? regla : pareja },
    { direccion: "nodebe", regla: regla.direccion === "nodebe" ? regla : pareja },
  ];
  return (
    <Seccion titulo="Casos que marca">
      <ul className="pulso-rl-sentidos" data-qa-geometry-group="validacion/reglas-sentidos" data-qa-geometry-contract="equal">
        {sentidos.map(({ direccion, regla: r }) => {
          const n = r?.ultima_auditoria?.n_casos;
          const contada = n !== null && n !== undefined;
          const actual = r?.id === regla.id;
          // Sin auditoría (o sin la regla de ese sentido) no hay cifra: se dice por qué.
          const contenido = (
            <>
              {contada ? <b>{formatoConteo(n)}</b> : null}
              <span>{SENTIDOS[direccion]}</span>
              {!contada ? <small>{r ? (r.activa ? "Sin auditar" : "Desactivada") : "El formulario no la declara"}</small> : null}
            </>
          );
          return (
            <li key={direccion} data-qa-geometry-member="">
              {r && !actual ? (
                <button type="button" className="pulso-rl-sentido" onClick={() => onElegir(r.id)}>
                  {contenido}
                </button>
              ) : (
                <div className="pulso-rl-sentido" aria-current={actual ? "true" : undefined}>
                  {contenido}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Seccion>
  );
}

function UltimaAuditoria({ regla, auditadaEn }: { regla: ReglaDelCatalogo; auditadaEn: string | null }) {
  const ultima = regla.ultima_auditoria;
  if (!ultima || ultima.n_casos === null) return null;
  const estado = estadoDeFila(regla);
  const fecha = fechaCortaDeAuditoria(auditadaEn);
  const unidad = ultima.nivel === "registro" ? (ultima.n_casos === 1 ? "registro" : "registros") : ultima.n_casos === 1 ? "caso" : "casos";
  const base = ultima.n_base !== null
    ? `de ${formatoConteo(ultima.n_base)} ${ultima.base_definicion ?? unidad}`
    : `${unidad}, base sin contar`;
  return (
    <Seccion titulo="Última auditoría">
      <CifraHallazgo
        enmarcada
        cifra={ultima.n_casos}
        base={base}
        proporcion={ultima.porcentaje ?? 0}
        detalle={ultima.porcentaje === null ? "sin proporción" : undefined}
        tono={regla.clase === "caso_a_revisar" ? "aviso" : "inconsistencia"}
      />
      <p className="pulso-rl-ficha-nota">
        {fecha ? `Auditada el ${fecha}` : "Auditada, sin fecha registrada"}
        {estado.tipo === "casos" ? `, ${estado.decididos}.` : "."}
      </p>
    </Seccion>
  );
}

function NotaDeAuditoria({ regla, auditadaEn }: { regla: ReglaDelCatalogo; auditadaEn: string | null }) {
  const estado = estadoDeFila(regla);
  const fecha = fechaCortaDeAuditoria(auditadaEn);
  return (
    <p className="pulso-rl-ficha-nota">
      {fecha ? `Auditada el ${fecha}` : "Auditada, sin fecha registrada"}
      {estado.tipo === "casos" ? `, ${estado.decididos}.` : "."}
    </p>
  );
}

export function FichaDeRegla({
  regla,
  pareja,
  avisos,
  auditadaEn,
  ocupada,
  onElegir,
  onActivar,
  onEditar,
  onConvertir,
  onConfigurar,
  onVerEnHallazgos,
  onIrAFueraDeAuditoria,
}: {
  regla: ReglaDelCatalogo;
  pareja: ReglaDelCatalogo | null;
  avisos: readonly AvisoDelCatalogo[];
  auditadaEn: string | null;
  ocupada: boolean;
  onElegir: (id: string) => void;
  onActivar: (activa: boolean) => void;
  onEditar: () => void;
  onConvertir: () => void;
  onConfigurar: () => void;
  onVerEnHallazgos: () => void;
  onIrAFueraDeAuditoria: (variable: string) => void;
}) {
  const tipo = tipoDeLaRegla(regla);
  const Icono = tipo.icono;
  const propia = regla.origen === "propia";
  const sinEvaluar = regla.estado_evaluacion === "sin_evaluar";
  const alcance = textoDeAlcance(regla.tratamiento.alcance);
  const base = regla.ultima_auditoria ? textoDeBase(regla.ultima_auditoria) : null;
  // Solo una expresión que la auditoría no lee se rehace como regla propia; una
  // pregunta fuera de la auditoría se devuelve desde su familia.
  const convertible = sinEvaluar && !propia && !!regla.variable_revisada && CAUSAS_CONVERTIBLES.has(regla.causa_codigo ?? "");
  const excluida = sinEvaluar && regla.causa_codigo === "variable_excluida" && !!regla.variable_revisada;
  const conSentidos = !!regla.direccion;

  const pie = convertible ? (
    <PulsoButton variant="primary" size="lg" disabled={ocupada} onClick={onConvertir}>
      <Plus size={14} aria-hidden="true" />
      Convertir en regla propia
    </PulsoButton>
  ) : excluida ? (
    <PulsoButton variant="secondary" size="lg" onClick={() => onIrAFueraDeAuditoria(regla.variable_revisada ?? "")}>
      Ver en Fuera de la auditoría
    </PulsoButton>
  ) : (
    <>
      {propia ? (
        <PulsoButton variant="secondary" size="lg" disabled={ocupada} onClick={onEditar}>
          <Pencil size={14} aria-hidden="true" />
          Editar
        </PulsoButton>
      ) : regla.se_puede_desactivar ? (
        <PulsoButton variant="secondary" size="lg" disabled={ocupada} onClick={() => onActivar(!regla.activa)}>
          {regla.activa ? "Desactivar" : "Activar"}
        </PulsoButton>
      ) : null}
      <PulsoButton variant="secondary" size="lg" onClick={onVerEnHallazgos}>
        <Inbox size={14} aria-hidden="true" />
        Ver en Hallazgos
      </PulsoButton>
    </>
  );

  return (
    <PanelDeMesa
      zona="ficha"
      titulo={regla.nombre}
      etiquetaCuerpo={`Ficha de ${regla.nombre}`}
      acciones={regla.origen === "operativo" ? (
        <PulsoButton variant="secondary" size="sm" onClick={onConfigurar}>Configurar</PulsoButton>
      ) : undefined}
      pie={pie}
    >
      <div className="pulso-rl-ficha">
        <FraseRegla tipo={tipo.nombre} icono={<Icono size={14} />} tamano="compacto">
          <FraseDelCatalogo piezas={regla.frase} />
        </FraseRegla>

        <QueMarca regla={regla} pareja={pareja} onElegir={onElegir} />

        {regla.expresion_formulario ? (
          <Seccion titulo="En el formulario">
            <pre className="pulso-rl-expresion"><code>{regla.expresion_formulario}</code></pre>
          </Seccion>
        ) : null}

        {sinEvaluar ? (
          <>
            <Seccion titulo="Por qué no se evaluó">
              <p className="pulso-rl-ficha-texto">{regla.causa ?? "La regla no se pudo evaluar sobre esta base"}.</p>
            </Seccion>
            {convertible ? (
              <Seccion titulo="Siguiente paso">
                <p className="pulso-rl-ficha-texto">
                  Convertirla en una regla propia: se abre el panel con <code className="pulso-rl-codigo">{regla.variable_revisada}</code> ya elegida.
                </p>
              </Seccion>
            ) : excluida ? (
              <Seccion titulo="Siguiente paso">
                <p className="pulso-rl-ficha-texto">
                  Devolver <code className="pulso-rl-codigo">{regla.variable_revisada}</code> a la auditoría desde Fuera de la auditoría.
                </p>
              </Seccion>
            ) : null}
          </>
        ) : (
          <dl className="pulso-rl-hechos">
            <div>
              <dt>Produce</dt>
              <dd>
                <span className="pulso-rl-clase" data-clase={regla.clase === "caso_a_revisar" ? "revisar" : "inconsistencia"}>
                  {rotuloDeClase(regla.clase)}
                </span>
              </dd>
            </div>
            <div>
              <dt>Tratamiento</dt>
              <dd>{textoDeTratamiento({ accion: regla.tratamiento.accion, alcance: null })}</dd>
            </div>
            {alcance ? (
              <div>
                <dt>Alcance</dt>
                <dd>{alcance}</dd>
              </div>
            ) : null}
            {conSentidos && base ? (
              <div>
                <dt>Base</dt>
                <dd>{base}</dd>
              </div>
            ) : null}
          </dl>
        )}

        {!regla.activa ? (
          <Seccion titulo="Desactivada">
            <p className="pulso-rl-ficha-texto">
              {regla.motivo_desactivada ?? (propia ? "No entra en la próxima auditoría." : "Sin motivo registrado.")}
            </p>
          </Seccion>
        ) : null}

        {regla.activa && !sinEvaluar ? (
          regla.ultima_auditoria ? (
            // En un salto la cifra ya está en "Casos que marca" y la base en los hechos: aquí solo la fecha.
            conSentidos ? <NotaDeAuditoria regla={regla} auditadaEn={auditadaEn} /> : <UltimaAuditoria regla={regla} auditadaEn={auditadaEn} />
          ) : (
            <Seccion titulo="Última auditoría">
              <p className="pulso-rl-ficha-texto">Se evalúa al auditar.</p>
            </Seccion>
          )
        ) : null}

        {avisos.length ? (
          <Seccion titulo={avisos.length === 1 ? "Aviso" : "Avisos"}>
            <ul className="pulso-rl-avisos">
              {avisos.map((a, i) => (
                <li key={`${a.codigo}-${i}`}>
                  <span className="pulso-rl-punto" data-tono="aviso" aria-hidden="true" />
                  <span>{a.texto}</span>
                </li>
              ))}
            </ul>
          </Seccion>
        ) : null}
      </div>
    </PanelDeMesa>
  );
}
