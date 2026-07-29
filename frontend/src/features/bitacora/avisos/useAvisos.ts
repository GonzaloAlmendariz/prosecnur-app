// Orquestación de avisos (ADR 0047).
//
// Une el motor puro con el libro persistido. Todo lo que decide QUÉ avisar vive
// en `motor.ts`; acá está solo el CUÁNDO y el CÓMO se presenta.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  apiBitacoraAvisoDescartar,
  apiBitacoraAvisoPosponer,
  apiBitacoraAvisosReclamar,
  type BitacoraAvisosPayload,
  type BitacoraEstado,
} from "../../../api/bitacora";
import { toast } from "../../../components/toasterStore";
import { agruparVencidos, evaluarAvisos, instanteDe, type Aviso, type GrupoAvisos } from "./motor";

/** Cadencia del latido mientras la app está abierta. */
const INTERVALO_MS = 60_000;

/**
 * Umbral a partir del cual se colapsa en un solo toast agregado.
 *
 * Abrir la app tras días cerrada produce decenas de avisos: una cascada de
 * toasts individuales es ruido. Con pocos, mostrarlos sueltos es más útil que
 * obligar a abrir un panel.
 */
const UMBRAL_AGREGADO = 3;

/**
 * Claves ya reclamadas por ESTA pestaña, a nivel de módulo.
 *
 * Segundo candado del disparo único. El libro del backend cubre entre sesiones;
 * este `Set` cubre dentro de una: dos evaluaciones concurrentes —el intervalo y
 * un `visibilitychange` que caen juntos— pedirían las mismas claves antes de
 * que la primera respuesta llegue.
 */
const clavesEnVuelo = new Set<string>();

export type ControlAvisos = {
  vencidos: Aviso[];
  proximos: Aviso[];
  grupos: GrupoAvisos[];
  posponer: (aviso: Aviso, minutos: number) => Promise<void>;
  descartar: (aviso: Aviso) => Promise<void>;
  evaluarAhora: () => void;
};

export function useAvisos(
  estado: BitacoraEstado | null,
  abrirCentro: () => void,
): ControlAvisos {
  const [libro, setLibro] = useState<BitacoraAvisosPayload | null>(estado?.avisos ?? null);
  const [proximos, setProximos] = useState<Aviso[]>([]);
  const [tick, setTick] = useState(0);

  /**
   * Lo que la campana y el centro muestran se DERIVA del libro, no del cálculo.
   *
   * Derivarlo del cálculo tenía un defecto: apenas se reclamaba un aviso, la
   * clave pasaba a `silenciadas` y la evaluación siguiente ya no lo encontraba,
   * así que la campana volvía a cero un instante después de sonar. Un aviso
   * disparado sigue pendiente hasta que el usuario lo posponga o lo descarte, y
   * eso es exactamente lo que el libro sabe.
   */
  const vencidos = useMemo<Aviso[]>(() => {
    if (!estado || !libro) return [];
    const porId = new Map(estado.plan.tasks.map((t) => [t.id, t]));
    return libro.pendientes
      .map((p) => {
        const tarea = porId.get(p.task_id);
        // Un aviso cuya tarea ya no existe no se puede mostrar ni accionar; lo
        // limpia el garbage collector de la fase 5, no la campana.
        if (!tarea) return null;
        // `cuando` es el instante en que el aviso DEBÍA sonar, reconstruido
        // desde su recordatorio, no `fired_at`. Con la app cerrada varios días
        // los dos difieren, y mostrar el segundo diría "debía avisar" con la
        // hora en que el usuario abrió la app, que no es lo que preguntó.
        const r = (tarea.reminders ?? []).find((x) => x.id === p.reminder_id);
        const ancla = r?.anchor === "end" ? tarea.end_time : tarea.start_time;
        const disparadoEn = new Date(p.fired_at);
        const vencimiento = instanteDe(p.occurrence, ancla, 0) ?? disparadoEn;
        const cuando = instanteDe(p.occurrence, ancla, r?.offset_minutes ?? 0) ?? vencimiento;
        return {
          clave: p.clave,
          taskId: p.task_id,
          reminderId: p.reminder_id,
          ocurrencia: p.occurrence,
          cuando,
          vencimiento,
          actividad: tarea.activity,
          fase: tarea.fase ?? "",
        } satisfies Aviso;
      })
      .filter((a): a is Aviso => a !== null)
      .sort((a, b) => a.cuando.getTime() - b.cuando.getTime());
  }, [estado, libro]);

  // El callback de apertura cambia en cada render del consumidor; guardarlo en
  // una ref evita que el efecto de evaluación se reinicie por eso.
  const abrirRef = useRef(abrirCentro);
  abrirRef.current = abrirCentro;

  // Montaje, no vigencia del efecto. `estado` cambia varias veces al arrancar
  // (la sección refetchea), y guardar las escrituras de estado con la vigencia
  // del efecto dejaba la campana en cero aunque el aviso ya se hubiera
  // reclamado y mostrado. Lo único que hay que evitar es escribir tras
  // desmontar.
  const montadoRef = useRef(true);
  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (estado?.avisos) setLibro(estado.avisos);
  }, [estado?.avisos]);

  const evaluarAhora = useCallback(() => setTick((t) => t + 1), []);

  // Latido: al montar, cada minuto, y al volver a la pestaña. Lo último importa
  // porque un portátil suspendido no ejecuta intervalos.
  useEffect(() => {
    const id = window.setInterval(evaluarAhora, INTERVALO_MS);
    const alVolver = () => {
      if (document.visibilityState === "visible") evaluarAhora();
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [evaluarAhora]);

  useEffect(() => {
    if (!estado || !libro) return;

    void (async () => {
      const ahora = new Date();
      const silenciadas = new Set(libro.silenciadas);
      const pospuestas = new Map(
        libro.pospuestas
          .map((p) => [p.clave, new Date(p.hasta)] as const)
          .filter(([, d]) => !Number.isNaN(d.getTime())),
      );

      const resultado = evaluarAvisos({
        tareas: estado.plan.tasks,
        ahora,
        disparadas: silenciadas,
        pospuestas,
      });

      if (montadoRef.current) setProximos(resultado.proximos);

      const porReclamar = resultado.vencidos.filter((a) => !clavesEnVuelo.has(a.clave));
      if (porReclamar.length === 0) return;
      porReclamar.forEach((a) => clavesEnVuelo.add(a.clave));

      try {
        // RECLAMAR ANTES DE PRESENTAR. La implementación natural —mostrar y
        // luego persistir— deja una ventana en la que recargar re-dispara.
        const res = await apiBitacoraAvisosReclamar(porReclamar.map((a) => a.clave));

        const mias = new Set(res.reclamadas);
        const aMostrar = porReclamar.filter((a) => mias.has(a.clave));

        // PRESENTAR SIEMPRE, aunque el efecto ya no esté vigente. El reclamo ya
        // ocurrió en el servidor: si acá se saliera por `!vigente`, el aviso
        // quedaría silenciado para siempre sin haberse mostrado nunca. Y el
        // deck de toasts es un store global que sobrevive a este componente,
        // así que emitir desde un efecto obsoleto es seguro.
        presentar(aMostrar, abrirRef.current);

        // El estado de React sí se guarda: escribirlo tras el desmontaje o tras
        // un cambio de `estado` sería trabajar sobre datos que ya no aplican.
        if (!montadoRef.current) return;
        setLibro(res.avisos);
      } catch {
        // Si la reclamación falla, se sueltan las claves para reintentar en el
        // latido siguiente. Quedarse con ellas silenciaría el aviso para
        // siempre por un error de red.
        porReclamar.forEach((a) => clavesEnVuelo.delete(a.clave));
      }
    })();
  }, [estado, libro, tick]);

  const posponer = useCallback(async (aviso: Aviso, minutos: number) => {
    const hasta = new Date();
    hasta.setMinutes(hasta.getMinutes() + minutos);
    const res = await apiBitacoraAvisoPosponer(aviso.clave, hasta.toISOString());
    clavesEnVuelo.delete(aviso.clave);
    setLibro(res.avisos);
  }, []);

  const descartar = useCallback(async (aviso: Aviso) => {
    const res = await apiBitacoraAvisoDescartar(aviso.clave);
    setLibro(res.avisos);
  }, []);

  return {
    vencidos,
    proximos,
    grupos: agruparVencidos(vencidos, new Date()),
    posponer,
    descartar,
    evaluarAhora,
  };
}

/**
 * Presenta los avisos recién reclamados.
 *
 * Pocos: uno por aviso, que es lo accionable. Muchos: UN toast agregado que
 * abre el centro, porque una cascada de doce notificaciones no se lee, se
 * cierra.
 */
function presentar(avisos: readonly Aviso[], abrirCentro: () => void): void {
  if (avisos.length === 0) return;

  if (avisos.length > UMBRAL_AGREGADO) {
    toast.aviso(`${avisos.length} avisos vencidos`, {
      detalle: "Se acumularon mientras la app estuvo cerrada.",
      accion: { label: "Ver", onSelect: abrirCentro },
      duracion: 0,
    });
    return;
  }

  for (const aviso of avisos) {
    toast.aviso(aviso.actividad, {
      detalle: descripcionDeVencimiento(aviso),
      accion: { label: "Ver", onSelect: abrirCentro },
      duracion: 0,
    });
  }
}

// `hour12: false` a propósito: en es-PE el formato de 12 horas rinde
// "09:00 a. m.", con puntos y espacios que en un toast se leen como ruido.
const FORMATO_VENCIMIENTO = new Intl.DateTimeFormat("es-PE", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function descripcionDeVencimiento(aviso: Aviso): string {
  return `Vence ${FORMATO_VENCIMIENTO.format(aviso.vencimiento).replace(".", "")}`;
}
