"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHAVE_PRIVADA = void 0;
exports.criarPlataformaNativa = criarPlataformaNativa;
const p256_1 = require("@noble/curves/p256");
const sha256_1 = require("@noble/hashes/sha256");
const utils_1 = require("@noble/hashes/utils");
const base64url_1 = require("./base64url");
exports.CHAVE_PRIVADA = 'authcentral_chave_aparelho';
function chaveDe(privada) {
    const publica = p256_1.p256.getPublicKey(privada, false);
    return {
        jwk: { kty: 'EC', crv: 'P-256', x: (0, base64url_1.base64url)(publica.slice(1, 33)), y: (0, base64url_1.base64url)(publica.slice(33, 65)) },
        // Assinatura deterministica (RFC 6979): nao precisa de aleatorio, so a geracao da chave precisa.
        assinar: async (dados) => p256_1.p256.sign((0, sha256_1.sha256)(dados), privada).toCompactRawBytes(),
    };
}
/**
 * Mobile: P-256 em JS puro (@noble/curves), privada no SecureStore (Keystore/Keychain cifram em repouso). Design
 * 2026-09-29 §10; plano da fase 3, ruling 3.
 */
function criarPlataformaNativa(armazem, aleatorio) {
    let emMemoria = null;
    return {
        armazem,
        bytesAleatorios: aleatorio,
        async chaveDoAparelho() {
            if (emMemoria)
                return emMemoria;
            const guardada = await armazem.ler(exports.CHAVE_PRIVADA);
            if (guardada)
                return (emMemoria = chaveDe((0, utils_1.hexToBytes)(guardada)));
            let privada = aleatorio(32);
            while (!p256_1.p256.utils.isValidPrivateKey(privada))
                privada = aleatorio(32);
            await armazem.gravar(exports.CHAVE_PRIVADA, (0, utils_1.bytesToHex)(privada));
            return (emMemoria = chaveDe(privada));
        },
        async esquecerChave() {
            emMemoria = null;
            await armazem.apagar(exports.CHAVE_PRIVADA);
        },
    };
}
