/**
 * Rótulos de los datos que cada pieza del contrato telefónico espera
 * (`TelefonicoSourcesModel.ts`, `expected`). Las claves son internas
 * («atencion», «telefono») y no se muestran: la vista pinta el rótulo.
 * Un test falla si el contrato agrega una clave sin rótulo.
 */

export const ROTULO_DE_DATO: Readonly<Record<string, string>> = {
  llave: "Llave del caso",
  sede: "Sede",
  atencion: "Atención",
  tramite: "Trámite",
  origen: "Origen",
  telefono: "Teléfono",
  responsable: "Responsable",
  estado: "Status",
  intento: "Intentos",
  fecha: "Fecha",
  observacion: "Observación",
  codpulso: "CodPulso",
  consentimiento: "Consentimiento",
  respuesta: "Respuesta",
};

/** Rótulo de una clave, o null si no lo tiene (el test lo impide en el contrato). */
export function rotuloDeDato(clave: string): string | null {
  return ROTULO_DE_DATO[clave.trim().toLowerCase()] ?? null;
}
