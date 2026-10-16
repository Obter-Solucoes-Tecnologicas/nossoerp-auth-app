/** Chave publica EC P-256 em JWK (RFC 7517), so os membros publicos: nunca `d`. */
export type JwkPublica = { kty: 'EC'; crv: 'P-256'; x: string; y: string };

/** A chave do aparelho que prende os tokens da central a este aparelho (DPoP, RFC 9449). */
export interface ChaveAparelho {
  jwk: JwkPublica;
  /** Assina com ES256 (SHA-256 + P-256) e devolve r||s cru, 64 bytes. */
  assinar(dados: Uint8Array): Promise<Uint8Array>;
}
