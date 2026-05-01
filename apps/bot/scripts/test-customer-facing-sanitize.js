'use strict';

const assert = require('assert');
const { sanitizeCustomerFacingText } = require('../customer-facing-sanitize');

const casos = [
    {
        nombre: 'quita marcadores conocidos',
        input: 'Te paso el precio. [CRM:caliente|seguimiento|alta|zona norte|lena]',
        expected: 'Te paso el precio.',
    },
    {
        nombre: 'quita marcadores desconocidos',
        input: 'Dale, te cuento. [PENSAMIENTO:conviene pedir zona]',
        expected: 'Dale, te cuento.',
    },
    {
        nombre: 'quita encabezado de transcripcion',
        input: 'Transcripción: necesito 500kg de leña\n\nPara 500kg te puedo orientar así.',
        expected: 'Para 500kg te puedo orientar así.',
    },
    {
        nombre: 'quita linea interna completa',
        input: 'Nota interna: cliente apurado\n\nPerfecto, te paso opciones.',
        expected: 'Perfecto, te paso opciones.',
    },
    {
        nombre: 'quita bloques de codigo',
        input: 'Te paso la info:\n```json\n{"secret":true}\n```\nListo.',
        expected: 'Te paso la info:\n\nListo.',
    },
];

for (const caso of casos) {
    assert.strictEqual(sanitizeCustomerFacingText(caso.input), caso.expected, caso.nombre);
}

console.log(`OK sanitizeCustomerFacingText (${casos.length} casos)`);
