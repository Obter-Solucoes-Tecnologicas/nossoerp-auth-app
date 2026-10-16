"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.plataformaExpo = plataformaExpo;
exports.sessaoPadrao = sessaoPadrao;
const plataformaNativa_1 = require("./plataformaNativa");
const plataformaWeb_1 = require("./plataformaWeb");
const sessaoAuthCentral_1 = require("./sessaoAuthCentral");
__exportStar(require("./index"), exports);
let plataforma = null;
let sessao = null;
/**
 * A plataforma do aparelho (uma por processo). Os modulos nativos sao carregados so aqui, por require: importar o
 * pacote nao pode puxar expo-secure-store/expo-crypto (quebra na web e nos testes que mocam o react-native).
 */
function plataformaExpo() {
    if (plataforma)
        return plataforma;
    /* eslint-disable @typescript-eslint/no-var-requires */
    const { Platform } = require('react-native');
    if (Platform.OS === 'web') {
        plataforma = (0, plataformaWeb_1.criarPlataformaWeb)();
        return plataforma;
    }
    const SecureStore = require('expo-secure-store');
    const Crypto = require('expo-crypto');
    /* eslint-enable @typescript-eslint/no-var-requires */
    plataforma = (0, plataformaNativa_1.criarPlataformaNativa)({
        ler: (k) => SecureStore.getItemAsync(k),
        gravar: (k, v) => SecureStore.setItemAsync(k, v, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY }),
        apagar: (k) => SecureStore.deleteItemAsync(k),
    }, (n) => Crypto.getRandomBytes(n));
    return plataforma;
}
/**
 * A sessao do app na central, uma por processo: a renovacao unica depende disso (duas renovacoes com o mesmo refresh
 * sao lidas pela central como roubo e revogam a sessao). Chamar de novo com outra config e erro de programacao.
 */
function sessaoPadrao(config) {
    if (sessao) {
        if (sessao.config.clientId !== config.clientId || sessao.config.urlCentral !== config.urlCentral)
            throw new Error('sessaoPadrao já configurada com outro clientId/urlCentral');
        return sessao.instancia;
    }
    const instancia = (0, sessaoAuthCentral_1.criarSessaoAuthCentral)({
        plataforma: plataformaExpo(),
        fetch: (...a) => fetch(...a),
        urlCentral: config.urlCentral,
        clientId: config.clientId,
    });
    sessao = { config: { ...config }, instancia };
    return instancia;
}
