import { describe, expect, it } from 'vitest';
import { looksLikeCode } from './scope';

describe('looksLikeCode', () => {
    it('catches code, fenced or not', () => {
        expect(looksLikeCode('¡Seguro! Un ejemplo:\n\n```python\nimport requests')).toBe(true);
        expect(looksLikeCode('Así:\nimport requests\nrespuesta = requests.get(url)')).toBe(true);
        expect(looksLikeCode('Usa esto:\nconst res = await fetch(url);')).toBe(true);
        expect(looksLikeCode('def suma(a, b):\n    return a + b')).toBe(true);
        expect(looksLikeCode('<script>alert(1)</script>')).toBe(true);
    });

    it('leaves transit answers alone', () => {
        const answers = [
            'Toma la **B13** en Calle 72 hacia Portal Norte. Llegas a las 8:40 am.',
            'Importante: la estación Flores está cerrada por obras.\nDesde Portal Norte toma la C15.',
            '- Camina 6 min a Calle 63\n- Toma la 8 dirección Terminal\n- Bájate en Calle 100',
            'Clase de servicio: troncal. Print de la tarifa: $3.550.',
            'La ruta E25 pasa en 4 min (a 568 mts).',
        ];
        for (const a of answers) expect(looksLikeCode(a)).toBe(false);
    });
});
