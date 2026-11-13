/**
 * El aviso de una carga que falló no muestra el código interno del error
 * (`E_DATA_XLSFORM_INCOMPATIBLE`): el cliente lo agrega al final del mensaje
 * tras un punto medio, y quien lee la carga necesita la causa, no el código.
 */
const CODIGO_AL_FINAL = /\s*\u00b7\s*E_[A-Z0-9_]+\s*$/;

export function mensajeSinCodigo(mensaje: string): string {
  return mensaje.replace(CODIGO_AL_FINAL, "").trim();
}
