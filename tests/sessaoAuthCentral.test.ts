import { createHash } from 'crypto';
import { criarPlataformaNativa } from '../src/plataformaNativa';
import { criarSessaoAuthCentral, CHAVE_SESSAO, type SessaoGuardada, type TenantAuth } from '../src/sessaoAuthCentral';
import { ErroAuthCentral, SessaoEncerrada } from '../src/erros';
import { armazemEmMemoria, aleatorioDeTeste } from './apoio';

const CENTRAL = 'https://central.teste';
const AGORA = Date.parse('2026-10-14T12:00:00Z');

const TENANT: TenantAuth = {
  url_interna_api: 'https://cliente.teste/nossoerp', id_empresa_nossoerp: 1, id_banco_de_dados: 77, razao: 'Loja', fantasia: 'Loja',
  versao_servidor: '1.7.0', tenant_db_id: null, v2_dashboard: false,
};

type Chamada = { url: string; init: RequestInit };

function resposta(corpo: unknown, status = 200, data: number = AGORA) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => corpo,
    headers: { get: (n: string) => (n.toLowerCase() === 'date' ? new Date(data).toUTCString() : null) },
  } as unknown as Response;
}

const PENDURADA = 'pendurada' as const;
type Item = Response | Error | typeof PENDURADA | Promise<Response>;

function montar(respostas: Item[], opcoes: { agora?: () => number; timeoutMs?: number } = {}) {
  const chamadas: Chamada[] = [];
  const armazem = armazemEmMemoria();
  const fila = [...respostas];
  const esperas: number[] = [];
  const fetchFalso = jest.fn(async (url: string, init: RequestInit) => {
    chamadas.push({ url, init });
    const r = fila.shift();
    if (!r) throw new Error('resposta nao configurada');
    if (r instanceof Error) throw r;
    if (r === PENDURADA)
      return new Promise<Response>((_, rejeitar) => init.signal?.addEventListener('abort', () => rejeitar(new Error('abortado'))));
    return r;
  });
  const sessao = criarSessaoAuthCentral({
    plataforma: criarPlataformaNativa(armazem, aleatorioDeTeste),
    fetch: fetchFalso as unknown as typeof fetch,
    urlCentral: CENTRAL + '/',
    clientId: 'forca-de-vendas',
    agoraMs: opcoes.agora ?? (() => AGORA),
    timeoutMs: opcoes.timeoutMs ?? 50,
    esperar: async (ms) => {
      esperas.push(ms);
    },
  });
  return { sessao, chamadas, armazem, fetchFalso, esperas };
}

function jwt(prova: string) {
  const [h = '', p = ''] = prova.split('.');
  const dec = (x: string) => JSON.parse(Buffer.from(x, 'base64url').toString('utf8'));
  return { header: dec(h), payload: dec(p) };
}

function cabecalho(c: Chamada, nome: string): string {
  return (c.init.headers as Record<string, string>)[nome] ?? '';
}

const loginNovo = (extra: Record<string, unknown> = {}) =>
  resposta({ modo: 'novo', token_type: 'DPoP', access_token: 'AT1', expires_in: 600, refresh_token: 'R1', refresh_expires_in: 2592000, tenant: TENANT, ...extra });
const loginLegado = () => resposta({ modo: 'legado', token_type: 'Bearer', access_token: 'B1', expires_in: 86400, tenant: TENANT });
const PEDIDO = { cnpj: '12345678000199', usuario: 'joao', senha: 's3nha', versaoApp: '7.5.0' };

async function sessaoGuardada(armazem: ReturnType<typeof armazemEmMemoria>): Promise<SessaoGuardada> {
  return JSON.parse(armazem.dados.get(CHAVE_SESSAO) ?? 'null');
}

describe('login', () => {
  it('modo novo: manda os campos e a prova do /auth/v1/login e guarda a sessao', async () => {
    const { sessao, chamadas, armazem } = montar([loginNovo()]);
    await sessao.login(PEDIDO);

    expect(chamadas[0]?.url).toBe(CENTRAL + '/auth/v1/login');
    expect(JSON.parse(chamadas[0]?.init.body as string)).toEqual({
      client_id: 'forca-de-vendas', cnpj: '12345678000199', usuario: 'joao', senha: 's3nha', id_banco: null, versao_app: '7.5.0',
    });
    const prova = jwt(cabecalho(chamadas[0]!, 'DPoP'));
    expect(prova.payload.htm).toBe('POST');
    expect(prova.payload.htu).toBe(CENTRAL + '/auth/v1/login');
    expect(prova.payload.ath).toBeUndefined();

    const guardada = await sessaoGuardada(armazem);
    expect(guardada).toEqual({ modo: 'novo', accessToken: 'AT1', expiraEmMs: AGORA + 600000, refreshToken: 'R1', tenant: TENANT });
    expect(await sessao.atual()).toEqual(guardada);
  });

  it('manda o id_banco escolhido', async () => {
    const { sessao, chamadas } = montar([loginNovo()]);
    await sessao.login({ ...PEDIDO, idBanco: 9 });
    expect(JSON.parse(chamadas[0]?.init.body as string).id_banco).toBe(9);
  });

  it('modo legado: guarda sem refresh', async () => {
    const { sessao } = montar([loginLegado()]);
    const s = await sessao.login(PEDIDO);
    expect(s).toEqual({ modo: 'legado', accessToken: 'B1', expiraEmMs: AGORA + 86400000, refreshToken: null, tenant: TENANT });
  });

  it('409 vira varios_bancos com os ids', async () => {
    const { sessao } = montar([resposta({ erro: 'varios_bancos', mensagem: 'Escolha o banco.', bancos: [7, 9] }, 409)]);
    const erro = await sessao.login(PEDIDO).catch((e) => e);
    expect(erro).toBeInstanceOf(ErroAuthCentral);
    expect(erro.codigo).toBe('varios_bancos');
    expect(erro.bancos).toEqual([7, 9]);
    expect(erro.message).toBe('Escolha o banco.');
  });

  it.each([
    [401, 'nao_autenticado'],
    [403, 'acesso_negado'],
    [503, 'indisponivel'],
  ])('%i vira %s com a mensagem da central e nao guarda sessao', async (status, codigo) => {
    const { sessao, armazem } = montar([resposta({ erro: codigo, mensagem: 'msg da central' }, status)]);
    const erro = await sessao.login(PEDIDO).catch((e) => e);
    expect(erro.codigo).toBe(codigo);
    expect(erro.message).toBe('msg da central');
    expect(armazem.dados.has(CHAVE_SESSAO)).toBe(false);
  });

  it('a recusa mostra a referencia da central (o suporte consulta o motivo real por ela)', async () => {
    const { sessao } = montar([resposta({ erro: 'nao_autenticado', mensagem: 'Não foi possível autenticar.', referencia: 'L-3F9K2' }, 401)]);
    const erro = await sessao.login(PEDIDO).catch((e) => e);
    expect(erro.message).toBe('Não foi possível autenticar. (ref. L-3F9K2)');
    expect(erro.referencia).toBe('L-3F9K2');
  });

  it.each([403, 409, 503])('%i tambem leva a referencia', async (status) => {
    const { sessao } = montar([resposta({ erro: 'x', mensagem: 'msg', bancos: [7, 9], referencia: 'L-AB' }, status)]);
    const erro = await sessao.login(PEDIDO).catch((e) => e);
    expect(erro.message).toBe('msg (ref. L-AB)');
  });

  it('sem referencia (central antiga) a mensagem sai como veio', async () => {
    const { sessao } = montar([resposta({ erro: 'nao_autenticado', mensagem: 'msg' }, 401)]);
    expect((await sessao.login(PEDIDO).catch((e) => e)).message).toBe('msg');
  });

  it('relogio errado tambem mostra a referencia', async () => {
    const { sessao } = montar([resposta({ erro: 'nao_autenticado', mensagem: 'x', referencia: 'L-77' }, 401, AGORA - 10 * 60000)]);
    expect((await sessao.login(PEDIDO).catch((e) => e)).message).toBe('Verifique a data e hora do aparelho. (ref. L-77)');
  });

  it('401 com o relogio do aparelho fora de 120 s vira relogio', async () => {
    const { sessao } = montar([resposta({ erro: 'nao_autenticado', mensagem: 'x' }, 401, AGORA - 10 * 60000)]);
    const erro = await sessao.login(PEDIDO).catch((e) => e);
    expect(erro.codigo).toBe('relogio');
    expect(erro.message).toBe('Verifique a data e hora do aparelho.');
  });

  it('rede fora vira rede', async () => {
    const { sessao } = montar([new Error('offline')]);
    const erro = await sessao.login(PEDIDO).catch((e) => e);
    expect(erro.codigo).toBe('rede');
  });
});

describe('cabecalhos', () => {
  it('modo novo: Authorization DPoP + prova com ath, htm e htu da chamada', async () => {
    const { sessao } = montar([loginNovo()]);
    await sessao.login(PEDIDO);
    const c = await sessao.cabecalhos('get', 'https://cliente.teste/nossoerp/api/v2/x?y=1');
    expect(c['Authorization']).toBe('DPoP AT1');
    const prova = jwt(c['DPoP'] ?? '');
    expect(prova.payload.htm).toBe('GET');
    expect(prova.payload.htu).toBe('https://cliente.teste/nossoerp/api/v2/x');
    expect(prova.payload.ath).toBe(createHash('sha256').update('AT1').digest('base64url'));
    expect(prova.payload.iat).toBe(Math.floor(AGORA / 1000));
  });

  it('modo legado: so Authorization Bearer', async () => {
    const { sessao } = montar([loginLegado()]);
    await sessao.login(PEDIDO);
    expect(await sessao.cabecalhos('GET', 'https://cliente.teste/a')).toEqual({ Authorization: 'Bearer B1' });
  });

  it('cada chamada leva um jti diferente', async () => {
    const { sessao } = montar([loginNovo()]);
    await sessao.login(PEDIDO);
    const a = jwt((await sessao.cabecalhos('GET', 'https://c/a'))['DPoP'] ?? '').payload.jti;
    const b = jwt((await sessao.cabecalhos('GET', 'https://c/a'))['DPoP'] ?? '').payload.jti;
    expect(a).not.toBe(b);
  });

  it('sem sessao lanca SessaoEncerrada', async () => {
    const { sessao } = montar([]);
    await expect(sessao.cabecalhos('GET', 'https://c/a')).rejects.toBeInstanceOf(SessaoEncerrada);
  });

  it('modo legado vencido continua mandando o Bearer: o 401 do servidor dispara o reauth com a senha salva', async () => {
    let agora = AGORA;
    const { sessao } = montar([loginLegado()], { agora: () => agora });
    await sessao.login(PEDIDO);
    agora += 2 * 86400000;
    expect(await sessao.cabecalhos('GET', 'https://c/a')).toEqual({ Authorization: 'Bearer B1' });
    expect(await sessao.atual()).not.toBeNull();
  });

  it('le a sessao guardada por outra instancia (app reaberto)', async () => {
    const primeira = montar([loginNovo()]);
    await primeira.sessao.login(PEDIDO);
    const reaberta = criarSessaoAuthCentral({
      plataforma: criarPlataformaNativa(primeira.armazem, aleatorioDeTeste),
      fetch: jest.fn() as unknown as typeof fetch, urlCentral: CENTRAL, clientId: 'forca-de-vendas', agoraMs: () => AGORA,
    });
    expect((await reaberta.cabecalhos('GET', 'https://c/a'))['Authorization']).toBe('DPoP AT1');
  });
});

describe('renovacao', () => {
  const renovado = () => resposta({ token_type: 'DPoP', access_token: 'AT2', expires_in: 600, refresh_token: 'R2', refresh_expires_in: 2592000 });

  it('renova sozinho quando faltam menos de 60 s e grava o par novo', async () => {
    let agora = AGORA;
    const { sessao, chamadas, armazem } = montar([loginNovo(), renovado()], { agora: () => agora });
    await sessao.login(PEDIDO);
    agora += 570000;

    const c = await sessao.cabecalhos('GET', 'https://cliente.teste/a');
    expect(c['Authorization']).toBe('DPoP AT2');
    expect(chamadas[1]?.url).toBe(CENTRAL + '/auth/v1/token');
    expect(JSON.parse(chamadas[1]?.init.body as string)).toEqual({ grant_type: 'refresh_token', client_id: 'forca-de-vendas', refresh_token: 'R1' });
    const prova = jwt(cabecalho(chamadas[1]!, 'DPoP'));
    expect(prova.payload.htu).toBe(CENTRAL + '/auth/v1/token');
    expect(prova.payload.ath).toBeUndefined();
    const guardada = await sessaoGuardada(armazem);
    expect(guardada.refreshToken).toBe('R2');
    expect(guardada.expiraEmMs).toBe(agora + 600000);
    expect(guardada.tenant).toEqual(TENANT);
  });

  it('duas chamadas ao mesmo tempo com o token vencendo renovam UMA vez', async () => {
    let agora = AGORA;
    const { sessao, fetchFalso } = montar([loginNovo(), renovado()], { agora: () => agora });
    await sessao.login(PEDIDO);
    agora += 590000;
    const [a, b] = await Promise.all([sessao.cabecalhos('GET', 'https://c/a'), sessao.cabecalhos('GET', 'https://c/b')]);
    expect(a['Authorization']).toBe('DPoP AT2');
    expect(b['Authorization']).toBe('DPoP AT2');
    expect(fetchFalso).toHaveBeenCalledTimes(2);
  });

  it('renovar() forcado depois de um 401 troca o token mesmo longe do vencimento', async () => {
    const { sessao } = montar([loginNovo(), renovado()]);
    await sessao.login(PEDIDO);
    expect(await sessao.renovar()).toBe(true);
    expect((await sessao.cabecalhos('GET', 'https://c/a'))['Authorization']).toBe('DPoP AT2');
  });

  it('renovacao recusada (401) limpa a sessao e cabecalhos lanca SessaoEncerrada', async () => {
    let agora = AGORA;
    const { sessao, armazem } = montar([loginNovo(), resposta({ erro: 'nao_autenticado', mensagem: 'x' }, 401)], { agora: () => agora });
    await sessao.login(PEDIDO);
    agora += 590000;
    await expect(sessao.cabecalhos('GET', 'https://c/a')).rejects.toBeInstanceOf(SessaoEncerrada);
    expect(await sessao.atual()).toBeNull();
    expect(armazem.dados.has(CHAVE_SESSAO)).toBe(false);
  });

  it('renovacao com rede fora (3 tentativas) mantem a sessao e lanca rede', async () => {
    let agora = AGORA;
    const { sessao } = montar([loginNovo(), new Error('offline'), new Error('offline'), new Error('offline')], { agora: () => agora });
    await sessao.login(PEDIDO);
    agora += 590000;
    const erro = await sessao.cabecalhos('GET', 'https://c/a').catch((e) => e);
    expect(erro.codigo).toBe('rede');
    expect((await sessao.atual())?.refreshToken).toBe('R1');
  });

  it('resposta da renovacao perdida: repete com o mesmo refresh (a central aceita o reenvio em 60 s)', async () => {
    let agora = AGORA;
    const { sessao, chamadas, esperas } = montar([loginNovo(), new Error('perdida'), renovado()], { agora: () => agora });
    await sessao.login(PEDIDO);
    agora += 590000;
    expect((await sessao.cabecalhos('GET', 'https://c/a'))['Authorization']).toBe('DPoP AT2');
    const corpos = chamadas.slice(1).map((c) => JSON.parse(c.init.body as string).refresh_token);
    expect(corpos).toEqual(['R1', 'R1']);
    expect(esperas.length).toBe(1);
    expect(esperas.reduce((a, b) => a + b, 0)).toBeLessThan(60000);
  });

  it('central que nao responde: a renovacao expira e nao pendura as proximas chamadas', async () => {
    let agora = AGORA;
    const { sessao, fetchFalso } = montar([loginNovo(), PENDURADA, PENDURADA, PENDURADA, renovado()], { agora: () => agora, timeoutMs: 20 });
    await sessao.login(PEDIDO);
    agora += 590000;
    const erro = await sessao.cabecalhos('GET', 'https://c/a').catch((e) => e);
    expect(erro.codigo).toBe('rede');
    expect((await sessao.cabecalhos('GET', 'https://c/a'))['Authorization']).toBe('DPoP AT2');
    expect(fetchFalso).toHaveBeenCalledTimes(5);
  });

  it('login sem resposta da central expira com erro de rede', async () => {
    const { sessao } = montar([PENDURADA], { timeoutMs: 20 });
    const erro = await sessao.login(PEDIDO).catch((e) => e);
    expect(erro.codigo).toBe('rede');
  });

  it('renovacao em voo (depois de um 401) nao ressuscita a sessao depois de sair', async () => {
    let liberar: (r: Response) => void = () => undefined;
    const emVoo = new Promise<Response>((ok) => (liberar = ok));
    const { sessao, armazem } = montar([loginNovo(), emVoo, resposta({ ok: true })]);
    await sessao.login(PEDIDO);
    const renovacao = sessao.renovar();
    await new Promise((r) => setTimeout(r, 0));
    await sessao.sair();
    liberar(renovado());
    expect(await renovacao).toBe(false);
    expect(await sessao.atual()).toBeNull();
    expect(armazem.dados.has(CHAVE_SESSAO)).toBe(false);
  });

  it('sair durante uma renovacao por vencimento espera ela e sai com o token novo', async () => {
    let agora = AGORA;
    let liberar: (r: Response) => void = () => undefined;
    const emVoo = new Promise<Response>((ok) => (liberar = ok));
    const { sessao, chamadas } = montar([loginNovo(), emVoo, resposta({ ok: true })], { agora: () => agora });
    await sessao.login(PEDIDO);
    agora += 590000;
    const pedido = sessao.cabecalhos('GET', 'https://c/a');
    await new Promise((r) => setTimeout(r, 0));
    const saida = sessao.sair();
    liberar(renovado());
    await saida;
    await pedido;
    expect(cabecalho(chamadas[2]!, 'Authorization')).toBe('DPoP AT2');
    expect(await sessao.atual()).toBeNull();
  });

  it('renovacao em voo nao grava por cima de outro login no mesmo aparelho', async () => {
    let agora = AGORA;
    let liberar: (r: Response) => void = () => undefined;
    const emVoo = new Promise<Response>((ok) => (liberar = ok));
    const loginB = resposta({ modo: 'novo', token_type: 'DPoP', access_token: 'AT-B', expires_in: 600, refresh_token: 'R-B', tenant: TENANT });
    const { sessao } = montar([loginNovo(), emVoo, loginB], { agora: () => agora });
    await sessao.login(PEDIDO);
    agora += 590000;
    const pedidoDeA = sessao.cabecalhos('GET', 'https://c/a');
    await new Promise((r) => setTimeout(r, 0));
    await sessao.login({ ...PEDIDO, usuario: 'maria' });
    liberar(renovado());
    expect((await pedidoDeA)['Authorization']).toBe('DPoP AT-B');
    expect((await sessao.atual())?.refreshToken).toBe('R-B');
  });

  it('modo legado nao renova', async () => {
    const { sessao, fetchFalso } = montar([loginLegado()]);
    await sessao.login(PEDIDO);
    expect(await sessao.renovar()).toBe(false);
    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });
});

describe('sair', () => {
  it('chama /auth/v1/sair com DPoP e prova com ath, e limpa a sessao', async () => {
    const { sessao, chamadas } = montar([loginNovo(), resposta({ ok: true })]);
    await sessao.login(PEDIDO);
    await sessao.sair();
    expect(chamadas[1]?.url).toBe(CENTRAL + '/auth/v1/sair');
    expect(cabecalho(chamadas[1]!, 'Authorization')).toBe('DPoP AT1');
    const prova = jwt(cabecalho(chamadas[1]!, 'DPoP'));
    expect(prova.payload.htu).toBe(CENTRAL + '/auth/v1/sair');
    expect(prova.payload.ath).toBe(createHash('sha256').update('AT1').digest('base64url'));
    expect(await sessao.atual()).toBeNull();
  });

  it('com o access token vencido, renova antes de sair (a central recusa sair com token vencido)', async () => {
    let agora = AGORA;
    const { sessao, chamadas } = montar([loginNovo(), resposta({ access_token: 'AT2', expires_in: 600, refresh_token: 'R2' }), resposta({ ok: true })], { agora: () => agora });
    await sessao.login(PEDIDO);
    agora += 15 * 60000;
    await sessao.sair();
    expect(chamadas.map((c) => c.url)).toEqual([CENTRAL + '/auth/v1/login', CENTRAL + '/auth/v1/token', CENTRAL + '/auth/v1/sair']);
    expect(cabecalho(chamadas[2]!, 'Authorization')).toBe('DPoP AT2');
    expect(await sessao.atual()).toBeNull();
  });

  it('limpa mesmo se a central falhar', async () => {
    const { sessao } = montar([loginNovo(), new Error('offline')]);
    await sessao.login(PEDIDO);
    await sessao.sair();
    expect(await sessao.atual()).toBeNull();
  });

  it('modo legado nao chama a central', async () => {
    const { sessao, fetchFalso } = montar([loginLegado()]);
    await sessao.login(PEDIDO);
    await sessao.sair();
    expect(fetchFalso).toHaveBeenCalledTimes(1);
    expect(await sessao.atual()).toBeNull();
  });
});
