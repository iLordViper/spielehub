# Veröffentlichen auf GitHub Pages

Der Hub bekommt ein **eigenes** Repository `spielehub`. Das alte Repository `brainclash` bleibt unangetastet, damit die alte Adresse und alle bisherigen Einladungslinks weiter funktionieren.

## Erstes Mal

1. Auf github.com (angemeldet als `iLordViper`) oben rechts **+ → New repository**.
2. Name: `spielehub`, **Public**, ohne README anlegen → **Create repository**.
3. Auf der leeren Repo-Seite **uploading an existing file** anklicken.
4. Den **Inhalt** des Ordners `Documents\spielehub` hineinziehen (die Ordner `brainclash`, `shared`, `docs`, `tools` und alle Dateien – nicht den Ordner `spielehub` selbst, und nicht den versteckten Ordner `.git`).
5. **Commit changes**.
6. **Settings → Pages**: Source „Deploy from a branch“, Branch `main`, Ordner `/ (root)` → **Save**.
7. Nach 1–2 Minuten läuft der Hub unter `https://ilordviper.github.io/spielehub/`.

In Firebase ist nichts zu tun: Die Adresse `ilordviper.github.io` ist dort schon freigegeben, weil die alte Brainclash-Seite sie benutzt.

## Updates

Geänderte Dateien wieder per **Add file → Upload files** in den passenden Ordner hochladen. GitHub ersetzt gleichnamige Dateien. Vorher `HUB_VERSION` in `index.html` hochzählen und `CHANGELOG.md` ergänzen.

Wenn Freunde gerade spielen: Ein Update greift erst, wenn sie die Seite neu laden. Laufende Duelle bleiben in der Datenbank erhalten.

## Später: alte Adresse umleiten (optional)

Sobald alle den Hub benutzen, kann `ilordviper.github.io/brainclash/` auf den Hub umleiten. Dann gibt es nur noch eine Brainclash-Fassung zu pflegen. Wichtig: Die Umleitung muss den Teil nach `#` mitnehmen, sonst gehen Einladungslinks (`#vs-…`, `#live-…`, `#party-…`) verloren:

```html
<!doctype html><meta charset="utf-8"><title>Brainclash</title>
<script>location.replace('https://ilordviper.github.io/spielehub/brainclash/'+location.hash)</script>
<a href="https://ilordviper.github.io/spielehub/brainclash/">Brainclash ist umgezogen – hier weiter</a>
```

Diese Datei würde die `index.html` im alten Repo `brainclash` ersetzen. **Erst machen, wenn du es willst.** Die alte Fassung ist in `Documents\spielehub-sicherungen\` gesichert.
