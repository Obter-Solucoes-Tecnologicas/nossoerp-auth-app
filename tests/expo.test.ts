jest.mock('react-native', () => ({ Platform: { OS: 'web' } }), { virtual: true });

const cfg = { urlCentral: 'https://central.teste', clientId: 'app-teste' };

test('sessaoPadrao devolve a mesma instancia para a mesma config', () => {
  jest.isolateModules(() => {
    const { sessaoPadrao } = require('../src/expo');
    expect(sessaoPadrao(cfg)).toBe(sessaoPadrao({ ...cfg }));
  });
});

test('sessaoPadrao recusa segunda config diferente', () => {
  jest.isolateModules(() => {
    const { sessaoPadrao } = require('../src/expo');
    sessaoPadrao(cfg);
    expect(() => sessaoPadrao({ ...cfg, clientId: 'outro' })).toThrow('já configurada');
  });
});

test('importar o núcleo não carrega módulo nativo', () => {
  jest.isolateModules(() => {
    jest.doMock('expo-secure-store', () => { throw new Error('carregou expo-secure-store'); }, { virtual: true });
    jest.doMock('expo-crypto', () => { throw new Error('carregou expo-crypto'); }, { virtual: true });
    jest.doMock('react-native', () => { throw new Error('carregou react-native'); }, { virtual: true });
    expect(() => require('../src/index')).not.toThrow();
  });
});
