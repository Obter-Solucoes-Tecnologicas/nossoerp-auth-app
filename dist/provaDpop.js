"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.base64url = void 0;
exports.thumbprint = thumbprint;
exports.hashAccessToken = hashAccessToken;
exports.montarProvaDpop = montarProvaDpop;
const sha256_1 = require("@noble/hashes/sha256");
const base64url_1 = require("./base64url");
Object.defineProperty(exports, "base64url", { enumerable: true, get: function () { return base64url_1.base64url; } });
/** RFC 7638: membros obrigatorios em ordem lexica, sem espacos. Igual ao ValidadorDpop.Jkt da central. */
function thumbprint(jwk) {
    return (0, base64url_1.base64url)((0, sha256_1.sha256)(new TextEncoder().encode(`{"crv":"P-256","kty":"EC","x":"${jwk.x}","y":"${jwk.y}"}`)));
}
/** O `ath` da prova: base64url(SHA-256(access token)). */
function hashAccessToken(token) {
    return (0, base64url_1.base64url)((0, sha256_1.sha256)(new TextEncoder().encode(token)));
}
/** RFC 9449 §4.2: htu sem query e sem fragmento. */
function semQuery(url) {
    const corte = url.search(/[?#]/);
    return corte < 0 ? url : url.slice(0, corte);
}
/**
 * Prova DPoP (design 2026-09-29 §6.2): JWT typ=dpop+jwt, alg=ES256, jwk publico no header; claims htm, htu, iat, jti
 * e, quando acompanha um access token, ath. Uma prova por chamada: o jti nao pode repetir.
 */
async function montarProvaDpop(p) {
    const header = { typ: 'dpop+jwt', alg: 'ES256', jwk: p.chave.jwk };
    const payload = { htm: p.metodo.toUpperCase(), htu: semQuery(p.url), iat: p.agoraSeg, jti: p.jti };
    if (p.accessToken)
        payload['ath'] = hashAccessToken(p.accessToken);
    const assinado = `${(0, base64url_1.base64urlTexto)(JSON.stringify(header))}.${(0, base64url_1.base64urlTexto)(JSON.stringify(payload))}`;
    const assinatura = await p.chave.assinar(new TextEncoder().encode(assinado));
    return `${assinado}.${(0, base64url_1.base64url)(assinatura)}`;
}
