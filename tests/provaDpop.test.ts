import { p256 } from '@noble/curves/p256';
import { sha256 } from '@noble/hashes/sha256';
import { createHash, randomBytes } from 'crypto';
import { base64url, thumbprint, hashAccessToken, montarProvaDpop } from '../src/provaDpop';
import type { ChaveAparelho, JwkPublica } from '../src/tipos';

function chaveDeTeste(): ChaveAparelho & { publica: Uint8Array } {
  const privada = p256.utils.randomPrivateKey();
  const publica = p256.getPublicKey(privada, false);
  const jwk: JwkPublica = { kty: 'EC', crv: 'P-256', x: base64url(publica.slice(1, 33)), y: base64url(publica.slice(33, 65)) };
  return { jwk, publica, assinar: async (d) => p256.sign(sha256(d), privada).toCompactRawBytes() };
}

function partes(jwt: string) {
  const [h = '', p = '', s = ''] = jwt.split('.');
  const dec = (x: string) => JSON.parse(Buffer.from(x, 'base64url').toString('utf8'));
  return { header: dec(h), payload: dec(p), assinado: `${h}.${p}`, assinatura: new Uint8Array(Buffer.from(s, 'base64url')) };
}

describe('prova DPoP', () => {
  it('header typ/alg/jwk publico e assinatura ES256 valida', async () => {
    const chave = chaveDeTeste();
    const prova = await montarProvaDpop({ chave, metodo: 'POST', url: 'https://nossoservidor.nossoerp.com/auth/v1/login', agoraSeg: 1760000000, jti: 'j1' });
    const { header, payload, assinado, assinatura } = partes(prova);
    expect(header).toEqual({ typ: 'dpop+jwt', alg: 'ES256', jwk: chave.jwk });
    expect(header.jwk.d).toBeUndefined();
    expect(payload).toEqual({ htm: 'POST', htu: 'https://nossoservidor.nossoerp.com/auth/v1/login', iat: 1760000000, jti: 'j1' });
    expect(assinatura.length).toBe(64);
    expect(p256.verify(assinatura, sha256(new TextEncoder().encode(assinado)), chave.publica)).toBe(true);
  });

  it('htm em maiusculas e htu sem query e sem fragmento', async () => {
    const prova = await montarProvaDpop({ chave: chaveDeTeste(), metodo: 'get', url: 'https://x.com/nossoerp/api/v2/fotos-sync/produtos/manifesto?desde=1#a', agoraSeg: 1, jti: 'j' });
    expect(partes(prova).payload.htm).toBe('GET');
    expect(partes(prova).payload.htu).toBe('https://x.com/nossoerp/api/v2/fotos-sync/produtos/manifesto');
  });

  it('ath = base64url(sha256(token)) quando ha access token', async () => {
    const prova = await montarProvaDpop({ chave: chaveDeTeste(), metodo: 'GET', url: 'https://x.com/a', accessToken: 'abc.def.ghi', agoraSeg: 1, jti: 'j' });
    expect(partes(prova).payload.ath).toBe(createHash('sha256').update('abc.def.ghi', 'ascii').digest('base64url'));
    expect(hashAccessToken('abc.def.ghi')).toBe(partes(prova).payload.ath);
  });

  it('thumbprint RFC 7638 igual ao da central (membros em ordem lexica)', () => {
    const jwk: JwkPublica = { kty: 'EC', crv: 'P-256', x: base64url(new Uint8Array(randomBytes(32))), y: base64url(new Uint8Array(randomBytes(32))) };
    const esperado = createHash('sha256').update(`{"crv":"P-256","kty":"EC","x":"${jwk.x}","y":"${jwk.y}"}`).digest('base64url');
    expect(thumbprint(jwk)).toBe(esperado);
  });

  it('base64url igual ao do Node para todos os tamanhos de resto', () => {
    for (let n = 0; n < 40; n++) {
      const bytes = new Uint8Array(randomBytes(n));
      expect(base64url(bytes)).toBe(Buffer.from(bytes).toString('base64url'));
    }
  });
});
