import { p256 } from '@noble/curves/p256';
import { sha256 } from '@noble/hashes/sha256';
import { criarPlataformaNativa, CHAVE_PRIVADA } from '../src/plataformaNativa';
import { armazemEmMemoria, aleatorioDeTeste } from './apoio';

describe('plataforma nativa', () => {
  it('cria a chave uma vez e reusa a guardada', async () => {
    const armazem = armazemEmMemoria();
    const a = await criarPlataformaNativa(armazem, aleatorioDeTeste).chaveDoAparelho();
    const b = await criarPlataformaNativa(armazem, aleatorioDeTeste).chaveDoAparelho();
    expect(b.jwk).toEqual(a.jwk);
    expect(Object.keys(a.jwk).sort()).toEqual(['crv', 'kty', 'x', 'y']);
    expect(armazem.dados.has(CHAVE_PRIVADA)).toBe(true);
  });

  it('assina em r||s que a chave publica confere', async () => {
    const chave = await criarPlataformaNativa(armazemEmMemoria(), aleatorioDeTeste).chaveDoAparelho();
    const dados = new TextEncoder().encode('a.b');
    const sig = await chave.assinar(dados);
    const publica = new Uint8Array([4, ...Buffer.from(chave.jwk.x, 'base64url'), ...Buffer.from(chave.jwk.y, 'base64url')]);
    expect(sig.length).toBe(64);
    expect(p256.verify(sig, sha256(dados), publica)).toBe(true);
  });

  it('esquecerChave gera outra chave', async () => {
    const plataforma = criarPlataformaNativa(armazemEmMemoria(), aleatorioDeTeste);
    const a = await plataforma.chaveDoAparelho();
    await plataforma.esquecerChave();
    expect((await plataforma.chaveDoAparelho()).jwk).not.toEqual(a.jwk);
  });

  it('descarta semente invalida (zero) e tenta de novo', async () => {
    let chamadas = 0;
    const aleatorio = (n: number) => (chamadas++ === 0 ? new Uint8Array(n) : aleatorioDeTeste(n));
    const chave = await criarPlataformaNativa(armazemEmMemoria(), aleatorio).chaveDoAparelho();
    expect(chamadas).toBe(2);
    expect(chave.jwk.x.length).toBeGreaterThan(0);
  });
});
