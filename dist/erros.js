"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessaoEncerrada = exports.ErroAuthCentral = void 0;
/** Recusa ou falha da central, com a mensagem pronta para a tela. */
class ErroAuthCentral extends Error {
    constructor(codigo, mensagem, bancos = [], 
    /** Codigo do evento na central (ex.: L-3F9K2): vai junto da mensagem, e o suporte le o motivo real por ele. */
    referencia = null) {
        super(referencia ? `${mensagem} (ref. ${referencia})` : mensagem);
        this.codigo = codigo;
        this.bancos = bancos;
        this.referencia = referencia;
        this.name = 'ErroAuthCentral';
    }
}
exports.ErroAuthCentral = ErroAuthCentral;
/** Nao ha sessao valida (nunca entrou, saiu, revogada ou refresh recusado): o app volta ao login. */
class SessaoEncerrada extends Error {
    constructor() {
        super('Sessão encerrada. Entre novamente.');
        this.name = 'SessaoEncerrada';
    }
}
exports.SessaoEncerrada = SessaoEncerrada;
