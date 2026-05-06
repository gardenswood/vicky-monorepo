'use strict';

const INTERNAL_MARKER_RE = /\[[A-ZÁÉÍÓÚÑ0-9_ -]{2,}(?::[^\]]*)?\]/giu;

const INTERNAL_PREFIX_RE = new RegExp(
    [
        '^\\s*(?:transcripci[oó]n|transcripto|texto\\s+del\\s+audio|audio\\s+transcripto)\\s*[:：][-\\s]*',
        '^\\s*(?:resumen\\s+del\\s+audio|el\\s+audio\\s+dice|en\\s+el\\s+audio\\s+(?:dice|dijiste|coment[aá]s?))\\s*[:：-]?\\s*',
        '^\\s*(?:pensamiento|razonamiento|an[aá]lisis|nota\\s+interna|internamente)\\s*[:：][-\\s]*',
        '^\\s*(?:me\\s+(?:decis|dec[ií]s|dijiste|coment[aá]s|cont[aá]s)\\s+(?:que|en\\s+el\\s+audio))\\s*[,:：]?\\s*',
        '^\\s*(?:seg[uú]n\\s+(?:lo\\s+que|tu)\\s+(?:dijiste|mencion[aá]s|cont[aá]s|escuch[oó]))\\s*[,:：]?\\s*',
        '^\\s*(?:por\\s+lo\\s+que\\s+(?:escuch[oó]|entend[ií]|me\\s+dijiste))\\s*[,:：]?\\s*',
    ].join('|'),
    'giu'
);

const INTERNAL_LINE_RE =
    /^\s*(?:transcripci[oó]n|transcripto|texto del audio|pensamiento|razonamiento|an[aá]lisis|nota interna|internamente|me dec[ií]s que|seg[uú]n lo que dijiste|por lo que escuch[oó])\s*[:：].*$/gimu;

/**
 * Ultima barrera antes de mostrar o leer en voz alta texto al cliente.
 * Mantiene texto humano, pero quita marcadores operativos y etiquetas meta del modelo.
 */
function sanitizeCustomerFacingText(texto) {
    return String(texto || '')
        .replace(INTERNAL_LINE_RE, '')
        .replace(INTERNAL_PREFIX_RE, '')
        .replace(INTERNAL_MARKER_RE, '')
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`[^`]*`/g, '')
        .replace(/[¿¡]/g, '') // Eliminar signos de apertura para sonar más humano
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();
}

module.exports = {
    sanitizeCustomerFacingText,
};
