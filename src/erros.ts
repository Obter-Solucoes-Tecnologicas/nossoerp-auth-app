export type CodigoErroAuth = 'nao_autenticado' | 'acesso_negado' | 'varios_bancos' | 'indisponivel' | 'relogio' | 'rede';

/** Recusa ou falha da central, com a mensagem pronta para a tela. */
export class ErroAuthCentral extends Error {
  constructor(
    public codigo: CodigoErroAuth,
    mensagem: string,
    public bancos: number[] = [],
    /** Codigo do evento na central (ex.: L-3F9K2): vai junto da mensagem, e o suporte le o motivo real por ele. */
    public referencia: string | null = null,
  ) {
    super(referencia ? `${mensagem} (ref. ${referencia})` : mensagem);
    this.name = 'ErroAuthCentral';
  }
}

/** Nao ha sessao valida (nunca entrou, saiu, revogada ou refresh recusado): o app volta ao login. */
export class SessaoEncerrada extends Error {
  constructor() {
    super('Sessão encerrada. Entre novamente.');
    this.name = 'SessaoEncerrada';
  }
}
