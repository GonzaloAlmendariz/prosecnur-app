/**
 * ¿El Sheets del operativo está al día?
 *
 * Gonzalo, 2026-09-17, con la pantalla y la hoja abiertas y Derecho diciendo
 * 19 aulas en una y 17 en la otra: «no entiendo, se supone que traer respuestas
 * actualiza todo». Y lo hace. Lo que faltaba era poder COMPROBARLO: la app no
 * guardaba en ningún sitio que hubiera publicado, así que ante dos cifras
 * distintas no había manera de saber cuál era más nueva.
 *
 * La comparación que contesta no es de relojes sino de CORTES: con qué
 * sincronización se escribió la hoja y por cuál va la app. Dos publicaciones
 * pueden tener horas distintas y el mismo corte —no hay nada nuevo que decir— y
 * ahí la hoja está al día aunque su reloj sea viejo.
 */

export type SelloDePublicacion = {
  publicado_en?: string;
  synced_at?: string;
  hojas?: number;
  partes?: number;
};

export type EstadoDelSheets = {
  estado: "sin_publicar" | "al_dia" | "atrasado";
  texto: string;
};

function hora(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function dia(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit" });
}

export function estadoDelSheets(
  sello: SelloDePublicacion | null | undefined,
  syncedAt: string | undefined,
): EstadoDelSheets {
  const publicado = sello?.publicado_en ?? "";
  if (!publicado) {
    return {
      estado: "sin_publicar",
      texto: "El Sheets no se ha publicado desde esta sesión: lo que hay allí puede ser de otro día.",
    };
  }
  const corteHoja = sello?.synced_at ?? "";
  const corteApp = syncedAt ?? "";
  const cuando = `${dia(publicado)} ${hora(publicado)}`.trim();
  if (corteApp && corteHoja && corteApp !== corteHoja) {
    return {
      estado: "atrasado",
      // El detalle importa: decir sólo «desactualizado» obliga a adivinar por
      // cuánto, y por un minuto no se corre a publicar.
      texto: `El Sheets va atrasado: se publicó con el corte de las ${hora(corteHoja)} y la app ya va por el de las ${hora(corteApp)}. Vuelve a traer respuestas para escribirlo.`,
    };
  }
  return {
    estado: "al_dia",
    texto: `Sheets al día · publicado el ${cuando} con el corte de las ${hora(corteHoja)}`,
  };
}
