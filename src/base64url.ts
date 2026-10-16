const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** base64url sem padding (RFC 7515). Sem Buffer/btoa: roda igual no Hermes e na web. */
export function base64url(bytes: Uint8Array): string {
  const b = (k: number) => bytes[k] ?? 0;
  const c = (n: number, desloca: number) => ALFABETO.charAt((n >> desloca) & 63);
  let saida = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (b(i) << 16) | (b(i + 1) << 8) | b(i + 2);
    saida += c(n, 18) + c(n, 12) + c(n, 6) + c(n, 0);
  }
  const resto = bytes.length - i;
  if (resto === 1) {
    const n = b(i) << 16;
    saida += c(n, 18) + c(n, 12);
  } else if (resto === 2) {
    const n = (b(i) << 16) | (b(i + 1) << 8);
    saida += c(n, 18) + c(n, 12) + c(n, 6);
  }
  return saida;
}

export function base64urlTexto(texto: string): string {
  return base64url(new TextEncoder().encode(texto));
}
