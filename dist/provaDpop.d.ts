import { base64url } from './base64url';
import type { ChaveAparelho, JwkPublica } from './tipos';
export { base64url };
/** RFC 7638: membros obrigatorios em ordem lexica, sem espacos. Igual ao ValidadorDpop.Jkt da central. */
export declare function thumbprint(jwk: JwkPublica): string;
/** O `ath` da prova: base64url(SHA-256(access token)). */
export declare function hashAccessToken(token: string): string;
/**
 * Prova DPoP (design 2026-09-29 §6.2): JWT typ=dpop+jwt, alg=ES256, jwk publico no header; claims htm, htu, iat, jti
 * e, quando acompanha um access token, ath. Uma prova por chamada: o jti nao pode repetir.
 */
export declare function montarProvaDpop(p: {
    chave: ChaveAparelho;
    metodo: string;
    url: string;
    accessToken?: string;
    agoraSeg: number;
    jti: string;
}): Promise<string>;
