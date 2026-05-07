#!/usr/bin/env node
/**
 * Exporta/importa configuración operativa de Vicky entre Firebase y Git.
 *
 * Uso:
 *   node scripts/sync-vicky-config.js export
 *   node scripts/sync-vicky-config.js import
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const ROOT = path.join(__dirname, '..');
const SNAPSHOT_DIR = path.join(ROOT, 'config-snapshots');
const SNAPSHOT_FILE = path.join(SNAPSHOT_DIR, 'vicky-runtime-config.json');
const SKILLS_DIR = path.join(ROOT, 'vicky-skills');

function initAdmin() {
    if (admin.apps.length) return;
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || 'webgardens-8655d',
    });
}

function serialize(value) {
    if (value == null) return value;
    if (typeof value.toDate === 'function') return value.toDate().toISOString();
    if (Array.isArray(value)) return value.map(serialize);
    if (typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, serialize(v)]));
    }
    return value;
}

function readSkillFiles() {
    const indexPath = path.join(SKILLS_DIR, 'index.json');
    const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    return index.skills.map((skill) => {
        const contenido = fs.readFileSync(path.join(SKILLS_DIR, skill.archivo), 'utf8');
        return {
            ...skill,
            contenido,
        };
    });
}

async function exportConfig() {
    initAdmin();
    const db = admin.firestore();
    fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });

    const [prompts, promociones, general, serviciosSnap, skillsSnap] = await Promise.all([
        db.collection('config').doc('prompts').get(),
        db.collection('config').doc('promociones').get(),
        db.collection('config').doc('general').get(),
        db.collection('servicios').get(),
        db.collection('vicky_skills').get(),
    ]);

    const payload = {
        exportedAt: new Date().toISOString(),
        source: 'firebase',
        config: {
            prompts: serialize(prompts.exists ? prompts.data() : {}),
            promociones: serialize(promociones.exists ? promociones.data() : {}),
            general: serialize(general.exists ? general.data() : {}),
        },
        servicios: Object.fromEntries(serviciosSnap.docs.map((doc) => [doc.id, serialize(doc.data())])),
        vickySkills: Object.fromEntries(skillsSnap.docs.map((doc) => [doc.id, serialize(doc.data())])),
    };

    fs.writeFileSync(SNAPSHOT_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    console.log(`Snapshot exportado: ${path.relative(ROOT, SNAPSHOT_FILE)}`);
}

async function importConfig() {
    initAdmin();
    const db = admin.firestore();
    const FieldValue = admin.firestore.FieldValue;
    const batch = db.batch();
    const skills = readSkillFiles();

    for (const skill of skills) {
        const ref = db.collection('vicky_skills').doc(skill.id);
        batch.set(ref, {
            id: skill.id,
            nombre: skill.nombre,
            contenido: skill.contenido,
            activo: skill.activo !== false,
            orden: Number(skill.orden) || 100,
            archivo: skill.archivo,
            actualizadoEn: FieldValue.serverTimestamp(),
            origen: 'git',
        }, { merge: true });
    }

    await batch.commit();
    console.log(`Skills importadas a Firebase: ${skills.map((s) => s.id).join(', ')}`);

    // Sin esto, el bot puede seguir con el system prompt viejo en RAM hasta redeploy:
    // el poll de runtime solo recarga si cambia config/general.recargarBotAt (u otros timestamps).
    await db.collection('config').doc('general').set(
        {
            recargarBotAt: FieldValue.serverTimestamp(),
            recargarBotMotivo: 'sync-vicky-config.js import (skills Git → Firestore)',
            ultimaActualizacion: FieldValue.serverTimestamp(),
        },
        { merge: true }
    );
    console.log('config/general.recargarBotAt actualizado → el bot recargará prompt/skills en el próximo poll (~60s).');
}

async function main() {
    const action = process.argv[2];
    if (action === 'export') return exportConfig();
    if (action === 'import') return importConfig();
    console.error('Uso: node scripts/sync-vicky-config.js <export|import>');
    process.exit(1);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
