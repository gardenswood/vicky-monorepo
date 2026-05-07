'use strict';

/**
 * Backfill de seguimientos: convierte `clientes/* .proximoContactoAt` en documentos
 * `mensajes_programados` si no existe ya un programado cercano.
 *
 * Objetivo: que los "próximo contacto" viejos (antes de la mejora) efectivamente
 * generen un WhatsApp automático al llegar la fecha.
 *
 * Uso:
 *   node scripts/backfill-proximo-contacto.js
 *   node scripts/backfill-proximo-contacto.js --dry-run
 *   node scripts/backfill-proximo-contacto.js --limit=200
 */

const admin = require('firebase-admin');

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || 'webgardens-8655d';

function parseArgs() {
    const args = process.argv.slice(2);
    const out = { dryRun: false, limit: 200 };
    for (const a of args) {
        if (a === '--dry-run' || a === '--dryrun') out.dryRun = true;
        if (a.startsWith('--limit=')) {
            const n = parseInt(a.split('=')[1], 10);
            if (Number.isFinite(n) && n > 0) out.limit = Math.min(2000, n);
        }
    }
    return out;
}

function toDateMaybe(v) {
    if (!v) return null;
    if (v instanceof Date) return v;
    if (typeof v.toDate === 'function') return v.toDate();
    const d = new Date(v);
    return Number.isFinite(d.getTime()) ? d : null;
}

function jidFromClienteDocId(telOrJid) {
    const s = String(telOrJid || '').trim();
    if (!s) return '';
    if (s.includes('@s.whatsapp.net') || s.startsWith('ig:')) return s;
    // docId tel (solo dígitos) => jid whatsapp
    const digits = s.replace(/\D/g, '');
    if (!digits) return '';
    return `${digits}@s.whatsapp.net`;
}

function primerNombre(nombre) {
    return String(nombre || '').trim().split(/\s+/)[0] || '';
}

function servicioPublico(servicioPendiente) {
    const s = String(servicioPendiente || '').toLowerCase();
    if (s.includes('lena') || s.includes('leña')) return 'la leña';
    if (s.includes('cerco')) return 'el cerco';
    if (s.includes('pergol')) return 'la pérgola';
    if (s.includes('fogon')) return 'el sector fogonero';
    if (s.includes('banco')) return 'los bancos';
    if (s.includes('madera')) return 'los productos de madera';
    return 'el presupuesto';
}

async function existsProgramadoCerca(db, jid, runAtMs, windowMs) {
    const from = admin.firestore.Timestamp.fromMillis(runAtMs - windowMs);
    const to = admin.firestore.Timestamp.fromMillis(runAtMs + windowMs);
    // Evitar índice compuesto con jid+estado+runAt:
    // consultamos por estado+runAt (índice ya existente) y filtramos por jid en memoria.
    const snap = await db
        .collection('mensajes_programados')
        .where('estado', '==', 'pendiente')
        .where('runAt', '>=', from)
        .where('runAt', '<=', to)
        .limit(50)
        .get();
    if (snap.empty) return false;
    return snap.docs.some((d) => String(d.data()?.jid || '').trim() === String(jid || '').trim());
}

async function main() {
    const { dryRun, limit } = parseArgs();
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            projectId: PROJECT_ID,
        });
    }

    const db = admin.firestore();
    console.log('═══ Backfill próximo contacto → mensajes_programados ═══');
    console.log(`Proyecto: ${PROJECT_ID}`);
    console.log(`Modo: ${dryRun ? 'DRY RUN (no escribe)' : 'APLICAR'}`);
    console.log(`Límite: ${limit}\n`);

    const now = Date.now();
    const minRunAt = now - 2 * 24 * 3600_000; // también recupera vencidos recientes (48h)
    const maxRunAt = now + 14 * 24 * 3600_000; // próximos 14 días

    // Nota: evitamos query por proximoContactoAt (puede requerir índice según el proyecto).
    // Escaneamos y filtramos en memoria con limit.
    const clientesSnap = await db.collection('clientes').limit(limit).get();
    let candidatos = 0;
    let creados = 0;
    let omitidosPorExistente = 0;
    let omitidosSinJid = 0;
    let omitidosSinFecha = 0;

    for (const doc of clientesSnap.docs) {
        const c = doc.data() || {};
        const proximo = toDateMaybe(c.proximoContactoAt);
        if (!proximo) {
            omitidosSinFecha++;
            continue;
        }
        const runAtMs = proximo.getTime();
        if (runAtMs < minRunAt || runAtMs > maxRunAt) continue;

        const jid = String(c.remoteJid || '').trim() || jidFromClienteDocId(doc.id);
        if (!jid) {
            omitidosSinJid++;
            continue;
        }

        candidatos++;
        const yaExiste = await existsProgramadoCerca(db, jid, runAtMs, 6 * 3600_000); // ±6h
        if (yaExiste) {
            omitidosPorExistente++;
            continue;
        }

        const nom = primerNombre(c.nombre || c.pushName || '');
        const tema = servicioPublico(c.servicioPendiente);
        const texto = nom
            ? `Hola ${nom}, te escribo por lo que habíamos visto de ${tema} en Gardens Wood. ¿Pudiste definir o querés que ajustemos algo? 😊`
            : `Hola, te escribo por lo que habíamos visto de ${tema} en Gardens Wood. ¿Pudiste definir o querés que ajustemos algo? 😊`;

        const payload = {
            jid,
            texto,
            runAt: admin.firestore.Timestamp.fromMillis(runAtMs),
            estado: 'pendiente',
            origen: 'backfill_proximo_contacto',
            motivoSeguimiento: 'backfill proximoContactoAt → mensaje programado',
            nombreCliente: nom || null,
            creadoEn: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (!dryRun) {
            await db.collection('mensajes_programados').add(payload);
        }
        creados++;
        console.log(`✅ ${dryRun ? '[dry]' : ''} programado creado para ${jid} @ ${proximo.toISOString()}`);
    }

    console.log('\n═══ Resumen ═══');
    console.log(`Candidatos: ${candidatos}`);
    console.log(`Creados: ${creados}`);
    console.log(`Omitidos (ya existía uno cerca): ${omitidosPorExistente}`);
    console.log(`Omitidos (sin JID): ${omitidosSinJid}`);
    console.log(`Omitidos (sin fecha): ${omitidosSinFecha}`);

    // Forzar recarga runtime (por si el equipo quiere ver trazas)
    if (!dryRun) {
        await db.collection('config').doc('general').set(
            {
                recargarBotAt: admin.firestore.FieldValue.serverTimestamp(),
                recargarBotMotivo: 'backfill-proximo-contacto (mensajes_programados)',
            },
            { merge: true }
        );
        console.log('\n🔄 config/general.recargarBotAt actualizado.');
    }
}

main().catch((e) => {
    console.error('❌ Backfill error:', e?.message || e);
    process.exit(1);
});

