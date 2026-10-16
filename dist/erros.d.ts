export type CodigoErroAuth = 'nao_autenticado' | 'acesso_negado' | 'varios_bancos' | 'indisponivel' | 'relogio' | 'rede';
/** Recusa ou falha da central, com a mensagem pronta para a tela. */
export declare class ErroAuthCentral extends Error {
    codigo: CodigoErroAuth;
    bancos: number[];
    /** Codigo do evento na central (ex.: L-3F9K2): vai junto da mensagem, e o suporte le o motivo real por ele. */
    referencia: string | null;
    constructor(codigo: CodigoErroAuth, mensagem: string, bancos?: number[], 
    /** Codigo do evento na central (ex.: L-3F9K2): vai junto da mensagem, e o suporte le o motivo real por ele. */
    referencia?: string | null);
}
/** Nao ha sessao valida (nunca entrou, saiu, revogada ou refresh recusado): o app volta ao login. */
export declare class SessaoEncerrada extends Error {
    constructor();
}
