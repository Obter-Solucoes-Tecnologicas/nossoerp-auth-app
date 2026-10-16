"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.base64url = exports.hashAccessToken = exports.thumbprint = exports.montarProvaDpop = exports.SessaoEncerrada = exports.ErroAuthCentral = exports.criarPlataformaWeb = exports.CHAVE_PRIVADA = exports.criarPlataformaNativa = exports.CHAVE_SESSAO = exports.criarSessaoAuthCentral = void 0;
/**
 * Nucleo do SDK: nada aqui importa react-native nem expo-* (roda em Node, na web e nos testes). A montagem para o app
 * Expo fica em `@nossoerp/auth-app/expo`.
 */
var sessaoAuthCentral_1 = require("./sessaoAuthCentral");
Object.defineProperty(exports, "criarSessaoAuthCentral", { enumerable: true, get: function () { return sessaoAuthCentral_1.criarSessaoAuthCentral; } });
Object.defineProperty(exports, "CHAVE_SESSAO", { enumerable: true, get: function () { return sessaoAuthCentral_1.CHAVE_SESSAO; } });
var plataformaNativa_1 = require("./plataformaNativa");
Object.defineProperty(exports, "criarPlataformaNativa", { enumerable: true, get: function () { return plataformaNativa_1.criarPlataformaNativa; } });
Object.defineProperty(exports, "CHAVE_PRIVADA", { enumerable: true, get: function () { return plataformaNativa_1.CHAVE_PRIVADA; } });
var plataformaWeb_1 = require("./plataformaWeb");
Object.defineProperty(exports, "criarPlataformaWeb", { enumerable: true, get: function () { return plataformaWeb_1.criarPlataformaWeb; } });
var erros_1 = require("./erros");
Object.defineProperty(exports, "ErroAuthCentral", { enumerable: true, get: function () { return erros_1.ErroAuthCentral; } });
Object.defineProperty(exports, "SessaoEncerrada", { enumerable: true, get: function () { return erros_1.SessaoEncerrada; } });
var provaDpop_1 = require("./provaDpop");
Object.defineProperty(exports, "montarProvaDpop", { enumerable: true, get: function () { return provaDpop_1.montarProvaDpop; } });
Object.defineProperty(exports, "thumbprint", { enumerable: true, get: function () { return provaDpop_1.thumbprint; } });
Object.defineProperty(exports, "hashAccessToken", { enumerable: true, get: function () { return provaDpop_1.hashAccessToken; } });
Object.defineProperty(exports, "base64url", { enumerable: true, get: function () { return provaDpop_1.base64url; } });
