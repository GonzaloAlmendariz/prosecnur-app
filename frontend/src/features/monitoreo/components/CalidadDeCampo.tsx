/**
 * Las señales de cómo se está trabajando, separadas de las de avance.
 *
 * Las siete alertas del módulo responden «cuánto falta». Estas responden «cómo
 * se está recolectando», y la diferencia no es de matiz: una brecha de cuota se
 * resuelve al cierre y un formulario desactualizado solo se puede resolver hoy.
 * Puestas en la misma lista se leerían igual, y la única que corre contra el
 * reloj se perdería entre las que no.
 *
 * Por eso vive en su propio bloque, con su propio encabezado y su propia
 * jerarquía: lo bloqueante arriba, cada aviso con a quién llamar y qué
 * preguntarle. Un aviso sin destinatario no es un aviso.
 */

import { AlertTriangle, PhoneCall, ShieldAlert, Users } from "lucide-react";

import type {
  MonitoreoCalidadCampo,
  MonitoreoCalidadCampoAlerta,
} from "../../../api/monitoreo";

import "./calidadDeCampo.css";

/**
 * Por qué no hay avisos. No es una cortesía: «no declaraste quién recolecta» y
 * «el campo está limpio» son estados opuestos, y un bloque vacío sin explicar
 * se lee siempre como el segundo.
 */
export function textoDelVacio(motivo: string): { titulo: string; detalle: string } | null {
  if (motivo === "sin_datos") {
    return {
      titulo: "Todavía no hay datos que revisar",
      detalle: "Sincroniza una fuente y estas señales aparecen solas.",
    };
  }
  if (motivo === "sin_rol_de_agente") {
    return {
      titulo: "Falta declarar quién recolecta",
      detalle:
        "Sin esa variable no se puede decir a quién llamar. Se declara una vez en Validación, en «Qué es un caso en este estudio», y sirve para todo el proyecto.",
    };
  }
  if (motivo === "sin_llaves_de_identidad") {
    return {
      titulo: "Sin señales sobre el equipo",
      detalle:
        "Falta declarar qué identifica a la persona encuestada para poder detectar encuestas que se pisan. El resto de las señales ya está corriendo.",
    };
  }
  if (motivo === "sin_hallazgos") {
    return {
      titulo: "Nada que revisar en cómo se está trabajando",
      detalle:
        "Todo el equipo usa la versión vigente del formulario, los nombres están escritos igual y no hay encuestas superpuestas.",
    };
  }
  return null;
}

const ICONO: Record<string, typeof Users> = {
  formulario_desactualizado: ShieldAlert,
  identidad_agente: Users,
  envio_sin_padron: Users,
  padron_sin_envio: PhoneCall,
  cruce_identidad: AlertTriangle,
};

/** El rótulo dice de qué trata el aviso; el mensaje ya dice el resto. */
export function rotuloDeTipo(tipo: string): string {
  if (tipo === "formulario_desactualizado") return "Formulario desactualizado";
  if (tipo === "identidad_agente") return "Nombre del encuestador";
  if (tipo === "envio_sin_padron") return "Fuera del padrón";
  if (tipo === "padron_sin_envio") return "Sin enviar nada";
  if (tipo === "cruce_identidad") return "Encuestas que se pisan";
  return "Calidad de campo";
}

/** Cuántas instancias de un mismo problema se muestran antes de resumir. */
const MAX_VISIBLES = 4;

/**
 * Tres nombres mal escritos no son tres problemas: son un problema con tres
 * casos. Agrupar por tipo evita que el bloque crezca sin techo en un estudio
 * con doce variantes y empuje fuera de pantalla el aviso que sí corre contra
 * el reloj. El orden del backend se respeta: el primer tipo que aparece manda,
 * y como los bloqueantes vienen primero, quedan arriba.
 */
export function agruparPorTipo(alertas: MonitoreoCalidadCampoAlerta[]) {
  const grupos: { tipo: string; severidad: string; items: MonitoreoCalidadCampoAlerta[] }[] = [];
  for (const alerta of alertas) {
    const previo = grupos.find((g) => g.tipo === alerta.tipo);
    if (previo) {
      previo.items.push(alerta);
      // Un solo caso bloqueante tiñe al grupo: no se puede diluir en el resto.
      if (alerta.severidad === "bloqueante") previo.severidad = "bloqueante";
    } else {
      grupos.push({ tipo: alerta.tipo, severidad: alerta.severidad, items: [alerta] });
    }
  }
  return grupos;
}

function Grupo({
  tipo,
  severidad,
  items,
}: {
  tipo: string;
  severidad: string;
  items: MonitoreoCalidadCampoAlerta[];
}) {
  const Icono = ICONO[tipo] ?? AlertTriangle;
  const bloqueante = severidad === "bloqueante";
  const visibles = items.slice(0, MAX_VISIBLES);
  const resto = items.length - visibles.length;
  return (
    <li className="mon-calidad-aviso" data-severidad={bloqueante ? "alta" : "media"}>
      <Icono size={15} aria-hidden="true" focusable="false" />
      <div className="mon-calidad-aviso-cuerpo">
        <p className="mon-calidad-aviso-rotulo">
          <span>{rotuloDeTipo(tipo)}</span>
          {items.length > 1 ? <b>{items.length} casos</b> : null}
          {bloqueante ? <em>no se corrige después</em> : null}
        </p>
        {visibles.map((alerta, index) => (
          <div className="mon-calidad-caso" key={`${alerta.actor}-${index}`}>
            <p className="mon-calidad-aviso-mensaje">{alerta.mensaje}</p>
            {alerta.detalle?.pregunta ? (
              // Lo que separa esta lista de un tablero: qué preguntar, literal,
              // para poder llamar sin traducir nada.
              <p className="mon-calidad-aviso-pregunta">{alerta.detalle.pregunta}</p>
            ) : null}
          </div>
        ))}
        {resto > 0 ? (
          <p className="mon-calidad-resto">
            y {resto} {resto === 1 ? "caso más" : "casos más"} del mismo tipo
          </p>
        ) : null}
      </div>
    </li>
  );
}

export default function CalidadDeCampo({
  calidad,
}: {
  calidad?: MonitoreoCalidadCampo | null;
}) {
  const alertas = calidad?.alertas ?? [];
  const vacio = alertas.length ? null : textoDelVacio(calidad?.motivo ?? "sin_datos");
  const bloqueantes = calidad?.resumen?.bloqueantes ?? 0;

  return (
    <section
      className="mon-calidad"
      data-audit-ready="monitoreo-calidad-campo"
      aria-labelledby="mon-calidad-titulo"
    >
      <header className="mon-calidad-head">
        <div>
          <h3 id="mon-calidad-titulo">Cómo se está trabajando</h3>
          <p>
            Lo que se puede corregir mientras el campo sigue abierto. Las alertas
            de avance responden cuánto falta; estas, cómo se está recolectando.
          </p>
        </div>
        {alertas.length ? (
          <span
            className="mon-calidad-conteo"
            data-alta={bloqueantes > 0 ? "1" : undefined}
          >
            {alertas.length} {alertas.length === 1 ? "aviso" : "avisos"}
          </span>
        ) : null}
      </header>

      {vacio ? (
        // C3 del Contrato de Superficie: la superficie contiene su propio vacío
        // y dice cuál de los vacíos es.
        <div className="mon-calidad-vacio" role="note">
          <strong>{vacio.titulo}</strong>
          <span>{vacio.detalle}</span>
        </div>
      ) : (
        <ul className="mon-calidad-lista" aria-live="polite">
          {agruparPorTipo(alertas).map((grupo) => (
            <Grupo
              key={grupo.tipo}
              tipo={grupo.tipo}
              severidad={grupo.severidad}
              items={grupo.items}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
