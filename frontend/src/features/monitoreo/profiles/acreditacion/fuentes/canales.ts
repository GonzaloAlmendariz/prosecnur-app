// El vocabulario de canales de acreditación, en un solo sitio.
//
// Estaba definido dos veces, literal e idéntico, dentro de
// `AcreditacionMonitoreoPage.tsx` y `TelefonicoMonitoreoPage.tsx` — los dos
// monolitos de perfil—, y ninguna otra superficie podía usarlo sin copiarlo una
// tercera vez. El bloque de Actores necesita exactamente estas opciones para
// declarar si un actor tiene canal telefónico, así que la tercera copia era el
// desenlace por defecto.
//
// Aquí vive la lista canónica y las cuatro funciones que la interpretan. Los
// monolitos la importan; no la redeclaran.

import { Link2, ListChecks, Mail, PhoneCall, QrCode, SlidersHorizontal } from "../../../../../vendor/lucide-react";
import type { LucideIcon } from "../../../../../vendor/lucide-react";
import { normalizeSourceMatch } from "../formato";

export type AcreditacionChannelToneKey =
  | "correo"
  | "telefono"
  | "presencial"
  | "enlace"
  | "kobo"
  | "desconocido";

export type AcreditacionChannelOption = {
  value: string;
  label: string;
  key: AcreditacionChannelToneKey;
  modality: "email" | "presencial" | "whatsapp" | "mixto" | "telefono" | "sms";
  icon: LucideIcon;
};

export const ACREDITACION_CHANNEL_OPTIONS: AcreditacionChannelOption[] = [
  { value: "Correo", label: "Correo", key: "correo", modality: "email", icon: Mail },
  { value: "Presencial (Ficha QR)", label: "Ficha QR", key: "presencial", modality: "presencial", icon: QrCode },
  { value: "Enlace personalizado (Whatsapp)", label: "Enlace", key: "enlace", modality: "whatsapp", icon: Link2 },
  { value: "Kobo", label: "Kobo", key: "kobo", modality: "mixto", icon: ListChecks },
  { value: "Telefónico", label: "Telefónico", key: "telefono", modality: "telefono", icon: PhoneCall },
];

/**
 * A qué canal se refiere un texto, tolerando cómo lo escribió cada plataforma.
 *
 * Los valores llegan de fuentes distintas —SurveyMonkey, Kobo, una hoja hecha a
 * mano— y ninguna se puso de acuerdo: «email», «Correo institucional», «mail».
 */
export function acreditacionChannelKey(value: string): AcreditacionChannelToneKey {
  const normalized = normalizeSourceMatch(value);
  if (!normalized || normalized === "sin canal" || normalized === "sin dato" || normalized === "desconocido") return "desconocido";
  if (normalized.includes("kobo")) return "kobo";
  if (normalized.includes("telefon")) return "telefono";
  if (normalized.includes("presencial") || normalized.includes("qr")) return "presencial";
  if (normalized.includes("correo") || normalized.includes("email") || normalized.includes("mail")) return "correo";
  if (normalized.includes("whatsapp") || normalized.includes("sms") || normalized.includes("web") || normalized.includes("link") || normalized.includes("enlace")) return "enlace";
  return "desconocido";
}

/**
 * El nombre corto del canal.
 *
 * Devuelve el literal «Sin canal» para lo que no reconoce, y no el texto crudo:
 * `acreditacionChannelDisplay` compara contra esa cadena exacta para decidir si
 * cae de vuelta al valor original. Cambiar este retorno rompe esa decisión en
 * silencio.
 */
export function acreditacionChannelLabel(value: string) {
  const key = acreditacionChannelKey(value);
  if (key === "correo") return "Correo";
  if (key === "telefono") return "Telefónico";
  if (key === "presencial") return "Ficha QR";
  if (key === "enlace") return "Enlace";
  if (key === "kobo") return "Kobo";
  return "Sin canal";
}

/** La opción canónica de un valor cualquiera, con Correo como último recurso. */
export function channelOptionForValue(value: unknown): AcreditacionChannelOption {
  const key = acreditacionChannelKey(String(value ?? ""));
  return ACREDITACION_CHANNEL_OPTIONS.find((option) => option.key === key)
    ?? ACREDITACION_CHANNEL_OPTIONS[0];
}

/**
 * Cómo se pinta un canal, incluyendo el caso «no declarado».
 *
 * A diferencia de `channelOptionForValue`, aquí un valor desconocido NO se
 * disfraza de Correo: se muestra tal cual con el ícono neutro, porque un canal
 * sin declarar tiene que verse sin declarar.
 */
export function channelVisualForValue(value: unknown, emptyLabel = "Elegir canal") {
  const raw = String(value ?? "").trim();
  const key = acreditacionChannelKey(raw);
  if (key === "desconocido") {
    return { key, label: raw || emptyLabel, icon: SlidersHorizontal as LucideIcon };
  }
  const option = ACREDITACION_CHANNEL_OPTIONS.find((item) => item.key === key) ?? ACREDITACION_CHANNEL_OPTIONS[0];
  return { key: option.key, label: option.label, icon: option.icon };
}

/** Si un canal es telefónico, que es lo que habilita el barrido de un actor. */
export function esCanalTelefonico(value: unknown) {
  return acreditacionChannelKey(String(value ?? "")) === "telefono";
}
