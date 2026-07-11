#!/usr/bin/env bash
set -euo pipefail

FILE="scripts/sync-franime.mjs"

if [ ! -f "$FILE" ]; then
  echo "Fichier introuvable: $FILE" >&2
  exit 1
fi

python3 - <<'PY'
from pathlib import Path

path = Path("scripts/sync-franime.mjs")
text = path.read_text(encoding="utf-8")
old = "  await db.from('sync_runs').insert(summary).catch(() => {});"
new = """  const { error: runError } = await db.from('sync_runs').insert(summary);
  if (runError) console.error('Could not save sync summary:', runError.message);"""

if old not in text:
    raise SystemExit("Ligne à corriger introuvable. Le fichier est peut-être déjà corrigé.")

path.write_text(text.replace(old, new, 1), encoding="utf-8")
print("Correction appliquée à scripts/sync-franime.mjs")
PY

git add scripts/sync-franime.mjs
git commit -m "Fix Supabase sync summary error"
git push origin main

echo "Terminé. Relance maintenant le workflow Sync authorized Franime episodes."
