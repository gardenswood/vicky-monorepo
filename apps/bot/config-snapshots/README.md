# Config Snapshots

Esta carpeta guarda snapshots versionables de configuración operativa de Vicky exportada desde Firebase.

Uso recomendado:

```bash
npm run config:export
git add apps/bot/config-snapshots apps/bot/vicky-skills
git commit -m "sync: export vicky runtime config"
```

Los snapshots no reemplazan Firestore: sirven como auditoría y respaldo en Git.
