// La cabecera visible de cada pestaña de Seguimiento: el título con `TabHeading`
// (el rail es de íconos) y una fila de cifras en tarjeta que dice, antes de hacer
// nada, dónde está el estudio. Mismo patrón que Aulas > Accesos.
//
// Contrato de Superficie: `.../<pestaña>/cifras` (equal), cuatro tarjetas pares.

import type { ReactNode } from "react";

import { CifrasEnTarjeta, type CifraEnTarjeta } from "../../../components/CifrasEnTarjeta";
import { TabHeading } from "../../../components/TabHeading";
import { formatoConteo } from "../../../lib/formatoNumero";
import type { LucideIcon } from "../../../vendor/lucide-react";
import { conteoConPct, fechaHoraLegible } from "./modeloSeguimiento";
import { cifrasDeCorreoPersonal, cifrasDeHorarios, cifrasDeRespondieron } from "./modeloTablero";
import type { PestanaDeSeguimiento } from "./navegacionSeguimiento";
import { useSeguimientoStore } from "./store";

const SIN_LEER = "Sin leer";

function Texto({ children }: { children: ReactNode }) {
  return <span className="rec-seg-cifra-texto">{children}</span>;
}

export function CabeceraDeSeguimiento({ pestana, titulo, detalle, icono }: {
  pestana: PestanaDeSeguimiento;
  titulo: string;
  detalle: string;
  icono: LucideIcon;
}) {
  const estado = useSeguimientoStore((s) => s.estado);
  const resultados = useSeguimientoStore((s) => s.resultados);

  let cifras: CifraEnTarjeta[] = [];
  if (estado && pestana === "respondieron") {
    const c = cifrasDeRespondieron(estado.campanas);
    cifras = [
      { id: "enlace", rotulo: "Personas con enlace", valor: formatoConteo(c.conEnlace), de: c.personas, nota: "de los contactos efectivos" },
      c.respondieron === null
        ? { id: "respondieron", rotulo: "Respondieron", valor: <Texto>{SIN_LEER}</Texto>, nota: "todavía no se lee ninguna campaña" }
        : {
          id: "respondieron", rotulo: "Respondieron", valor: formatoConteo(c.respondieron), de: c.baseLeida,
          avance: { valor: c.respondieron, total: c.baseLeida, etiqueta: "Respondieron" },
          nota: c.leidas < c.campanas ? `con enlace, en ${formatoConteo(c.leidas)} de ${formatoConteo(c.campanas)} campañas leídas` : "con enlace",
        },
      { id: "a-medias", rotulo: "A medias", valor: c.aMedias === null ? <Texto>{SIN_LEER}</Texto> : formatoConteo(c.aMedias), nota: "siguen recibiendo recordatorios" },
      { id: "lectura", rotulo: "Última lectura", valor: <Texto>{c.ultimaLectura ? fechaHoraLegible(c.ultimaLectura) : "Todavía no"}</Texto> },
    ];
  }
  if (estado && pestana === "horarios") {
    const c = cifrasDeHorarios(estado, resultados);
    cifras = [
      { id: "personas", rotulo: "Personas en la prueba", valor: estado.horario.sorteado_en ? formatoConteo(c.personas) : <Texto>Sin asignar</Texto> },
      c.comparados === null
        ? { id: "comparados", rotulo: "Recordatorios comparados", valor: <Texto>Sin resultados</Texto>, nota: `${formatoConteo(c.recordatorios)} en el plan` }
        : { id: "comparados", rotulo: "Recordatorios comparados", valor: formatoConteo(c.comparados), de: c.recordatorios },
      {
        id: "borradores", rotulo: "Borradores creados", valor: formatoConteo(c.borradores), de: c.conHora,
        ...(c.conHora ? { avance: { valor: c.borradores, total: c.conHora, etiqueta: "Borradores creados" } } : { nota: "el plan todavía no tiene horas" }),
      },
      {
        id: "ganador", rotulo: "Resultado", valor: <Texto>{c.ganador ?? "Sin resultados"}</Texto>,
        ...(c.ganador && c.ganador !== "Sin diferencia clara" ? { tono: "listo" as const, nota: "último recordatorio comparado" } : {}),
      },
    ];
  }
  if (estado && pestana === "correo-personal") {
    const c = cifrasDeCorreoPersonal(estado.campanas);
    const asignados = c.personal + c.control;
    cifras = [
      { id: "personal", rotulo: "Correo personal", valor: asignados ? conteoConPct(c.personal, asignados) : <Texto>Sin asignar</Texto> },
      { id: "control", rotulo: "Control", valor: asignados ? conteoConPct(c.control, asignados) : <Texto>Sin asignar</Texto> },
      {
        id: "cargados", rotulo: "Cargados en Mailchimp", valor: formatoConteo(c.cargados), de: c.personal,
        ...(c.personal ? { avance: { valor: c.cargados, total: c.personal, etiqueta: "Cargados en Mailchimp" } } : {}),
      },
      {
        id: "rechazados", rotulo: "Rechazados", valor: formatoConteo(c.rechazados),
        ...(c.rechazados ? { tono: "aviso" as const, nota: "no se reintentan" } : {}),
      },
    ];
  }

  return (
    <>
      <TabHeading eyebrow="Seguimiento" titulo={titulo} detalle={detalle} icono={icono} />
      {cifras.length ? <CifrasEnTarjeta cifras={cifras} grupo={`material-campo/correo/seguimiento/${pestana}/cifras`} /> : null}
    </>
  );
}
