import { sha256 } from '@noble/hashes/sha256';
import { base64url, base64urlTexto } from './base64url';
import type { ChaveAparelho, JwkPublica } from './tipos';

export { base64url };

/** RFC 7638: membros obrigatorios em ordem lexica, sem espacos. Igual ao ValidadorDpop.Jkt da central. */
export function thumbprint(jwk: JwkPublica): string {
  return base64url(sha256(new TextEncoder().encode(`{"crv":"P-256","kty":"EC","x":"${jwk.x}","y":"${jwk.y}"}`)));
}

/** O `ath` da prova: base64url(SHA-256(access token)). */
export function hashAccessToken(token: string): string {
  return base64url(sha256(new TextEncoder().encode(token)));
}

/** RFC 9449 §4.2: htu sem query e sem fragmento. */
function semQuery(url: string): string {
  const corte = url.search(/[?#]/);
  return corte < 0 ? url : url.slice(0, corte);
}

/**
 * Prova DPoP (design 2026-09-29 §6.2): JWT typ=dpop+jwt, alg=ES256, jwk publico no header; claims htm, htu, iat, jti
 * e, quando acompanha um access token, ath. Uma prova por chamada: o jti nao pode repetir.
 */
export async function montarProvaDpop(p: {
  chave: ChaveAparelho;
  metodo: string;
  url: string;
  accessToken?: string;
  agoraSeg: number;
  jti: string;
}): Promise<string> {
  const header = { typ: 'dpop+jwt', alg: 'ES256', jwk: p.chave.jwk };
  const payload: Record<string, unknown> = { htm: p.metodo.toUpperCase(), htu: semQuery(p.url), iat: p.agoraSeg, jti: p.jti };
  if (p.accessToken) payload['ath'] = hashAccessToken(p.accessToken);
  const assinado = `${base64urlTexto(JSON.stringify(header))}.${base64urlTexto(JSON.stringify(payload))}`;
  const assinatura = await p.chave.assinar(new TextEncoder().encode(assinado));
  return `${assinado}.${base64url(assinatura)}`;
}
