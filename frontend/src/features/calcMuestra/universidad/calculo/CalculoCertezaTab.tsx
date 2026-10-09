/**
 * Pestaña «¿Alcanza?» (id `calculo-certeza`), la última de Cálculo.
 *
 * La certeza vivía como un panel dentro de «Cursos-horario requeridos», debajo
 * de la tabla que dice cuántas aulas pide la fórmula. Contesta una pregunta
 * distinta y con otro método: la fórmula divide, y esto **simula el sorteo y
 * cuenta**. Decisión de Gonzalo (2026-08-27): «certeza completo se va a calculo
 * y tiene su propia pestaña bien explicada al final de las demas pestañas».
 *
 * Va la última porque es lo último que se decide: con su resultado se ajusta el
 * reparto por facultad, y recién entonces se sortea.
 */
import type { CalcMuestraAulasCerteza, CalcMuestraComponente } from "../../../../api/client";
import { CertezaCoberturaPanel } from "./CertezaCoberturaPanel";
import { ExplicacionBloque, ExplicacionPlegable } from "../ui";
import { certezaVistaDesdeEstado } from "./certezaCoberturaModel";
import { cursosHorarioDesdeResultado } from "./cursosHorarioResultadoModel";
import type { UniversityAulasScenario } from "../shared/study";
import {
  UNIVERSITY_FACULTY_COMPONENT_ID,
  UNIVERSITY_TOTAL_COMPONENT_ID,
} from "../shared/constants";
import { ShieldCheck } from "../../../../vendor/lucide-react";
import { EmptyState } from "../../../../components/States";
import "./certezaCobertura.css";
import "./calculoCerteza.css";

export function CalculoCertezaTab({
  componentes,
  currentFrameHash,
  escenario,
  certeza,
  certezaEnCurso,
  onMedirCerteza,
  onFijarAulas,
  onFijarTodas,
  marcoDesactualizado = false,
  onNavigate,
}: {
  componentes: [CalcMuestraComponente, CalcMuestraComponente];
  currentFrameHash: string | null | undefined;
  escenario: UniversityAulasScenario;
  certeza: CalcMuestraAulasCerteza | null;
  certezaEnCurso: boolean;
  onMedirCerteza?: React.ComponentProps<typeof CertezaCoberturaPanel>["onMedir"];
  onFijarAulas?: (facultad: string, aulas: number) => void;
  onFijarTodas?: () => void;
  marcoDesactualizado?: boolean;
  /** Lleva al paso previo cuando la pestaña todavía no tiene datos. */
  onNavigate?: (section: string, tab?: string) => void;
}) {
  // Mismo criterio que «Cursos-horario requeridos»: la certeza se mide sobre el
  // componente del escenario vigente, no sobre uno fijo.
  const actorId = escenario === "e2" ? UNIVERSITY_FACULTY_COMPONENT_ID : UNIVERSITY_TOTAL_COMPONENT_ID;
  const componente = componentes.find((item) => item.actor_id === actorId);
  const model = cursosHorarioDesdeResultado(componente?.resultado);
  const frameHashVigente = typeof currentFrameHash === "string" && currentFrameHash.trim()
    ? currentFrameHash.trim()
    : null;
  const frameDesactualizado = Boolean(
    model && (!frameHashVigente || model.decision.frame_hash !== frameHashVigente),
  );

  return (
    <div
      className="cmv2-calc-certeza-tab"
      data-qa-geometry-group="calc-muestra/calculo-certeza"
      /* Resultado primero y explicación plegada después (AD7-E15): panel y
         disclosure tienen alturas propias por diseño. Sin declararlo, el grupo
         cae en el contrato `equal` por defecto y el gate reportaba una deriva
         de 1.149 px que no es un defecto — y un gate que grita donde no hay
         nada deja de leerse. */
      data-qa-geometry-contract="intrinsic"
    >
      {model ? (
        <CertezaCoberturaPanel
          filasResultado={model.filas}
          vista={certezaVistaDesdeEstado(certeza, frameHashVigente)}
          busy={certezaEnCurso}
          onMedir={onMedirCerteza as NonNullable<typeof onMedirCerteza>}
          marcoDesactualizado={marcoDesactualizado || frameDesactualizado}
          onFijarAulas={onFijarAulas}
          onFijarTodas={onFijarTodas}
        />
      ) : (
        // Vacío con su camino (2026-09-27): era una línea suelta arriba de un
        // panel de 700 px; ahora dice qué falta y lleva ahí, como Perfil.
        <EmptyState
          icon={<ShieldCheck size={22} aria-hidden="true" />}
          title="Todavía no hay un cálculo por facultad sobre el que medir"
          hint="Calcula la muestra en Propuestas: con las cuotas por facultad, esta pestaña simula el sorteo y dice si los cursos-horario alcanzan."
          cta={onNavigate ? (
            <button type="button" className="pulso-empty-cta" onClick={() => onNavigate("calculo", "calculo-propuestas")}>
              Ir a Propuestas
            </button>
          ) : undefined}
        />
      )}
      <ExplicacionPlegable
        titulo="Cómo se decide si alcanza"
        resumen="por qué la división no basta y qué simula esta pantalla"
      >
        <ExplicacionBloque titulo="Por qué la división no basta" subtitulo="la cuenta directa pide menos aulas de las necesarias">
          <p>
            La pestaña anterior divide: la cuota de una facultad entre lo que rinde un
            curso-horario. Esa cuenta supone que los estudiantes de las aulas sorteadas son
            personas distintas, y no lo son: uno puede estar matriculado en tres de los cursos
            elegidos, y ahí cuenta una vez, no tres. Al ignorar ese solape, la división pide
            menos aulas de las necesarias.
          </p>
          <p>
            Hay un segundo problema. La división produce un número <em>esperado</em>, y el
            sorteo real puede caer por debajo: un diseño que alcanza la cuota en promedio falla
            la mitad de las veces.
          </p>
        </ExplicacionBloque>
        <ExplicacionBloque titulo="Qué hace esta pantalla" subtitulo="simula el sorteo y cuenta, en vez de estimar">
          <p>
            Para cada número candidato de aulas ejecuta <b>sorteos completos</b>, con el mismo
            motor que hará la selección definitiva. En cada uno cuenta los{" "}
            <b>estudiantes únicos</b> obtenidos, descontando a quienes aparecen en más de un
            aula, y los multiplica por la tasa de efectividad de la facultad. El número
            certificado es el mínimo de aulas con el que la cuota se alcanza en al menos el
            nivel exigido. No estima la probabilidad: la cuenta.
          </p>
          <p>
            La columna <b>Curva</b> es esa evidencia: cómo crece el rendimiento a medida que se
            suman aulas. Si sale marcada como plana, la corrida no está evaluando el número que
            declara, porque el rendimiento no puede quedarse quieto cuando se agregan aulas.
          </p>
          <p>
            Bajo cada mínimo se dice <b>con cuántos sorteos se decidió</b>, y no son los mismos
            en todas: en las facultades de marco grande cada sorteo cuesta más y el motor los
            reduce, así que las de mayor cuota reciben menos evidencia. Cuando el margen sobre
            el nivel exigido es menor que el error de muestreo, la fila lo declara: con esa
            evidencia no se distingue si cumple.
          </p>
          <p>
            «Llevar a N» fija esa facultad en el mínimo certificado. Invalida la selección
            vigente: hay que volver a sortear, y Selección lo dirá.
          </p>
        </ExplicacionBloque>
      </ExplicacionPlegable>
    </div>
  );
}
