# 🧳 Packliste Spanien – Familienurlaub

Eine vollständige, installierbare Progressive Web App (PWA) für die Packplanung
eines Familienurlaubs in Spanien. Gebaut mit reinem HTML, CSS und JavaScript –
ohne Frameworks, ohne externe Bibliotheken, ohne CDN-Abhängigkeiten. Läuft
komplett offline und lässt sich auf dem iPhone, Tablet oder Desktop als App
installieren.

## Inhalt

Die App enthält **910 einzelne, vollständig ausformulierte Packpunkte** in
12 Kategorien:

| Kategorie              | Punkte |
|-------------------------|-------:|
| Dokumente                | 47   |
| Papa                     | 102  |
| Mama                     | 131  |
| Tochter 1 (4 Jahre)      | 103  |
| Tochter 2 (2 Jahre)      | 100  |
| Auto                     | 70   |
| Ferienhaus               | 80   |
| Küche                    | 121  |
| Reiseapotheke            | 80   |
| Technik                  | 35   |
| Strand                   | 27   |
| Pool                     | 14   |

Jeder Punkt ist einzeln abhakbar, mit Favoriten markierbar und über die
Einstellungen als eigener Punkt erweiterbar.

## Projektstruktur

```
packliste/
├── index.html            App-Grundgerüst (Markup aller Ansichten & Sheets)
├── style.css              Gesamtes Styling: Design-Tokens, Hell-/Dunkelmodus,
│                          Glassmorphism, Responsive-Layouts, Druckansicht
├── app.js                 Gesamte App-Logik (Zustand, Rendering, Filter,
│                          Suche, Statistik, Import/Export, Theme)
├── data.js                Das komplette Datenmodell (Kategorien + Packpunkte)
├── manifest.json           PWA-Manifest (Name, Icons, Farben, Start-URL)
├── service-worker.js       Offline-Cache (Cache-First mit Hintergrund-Update)
├── icons/                  App-Icons in allen benötigten Größen
│   ├── icon-192.png
│   ├── icon-512.png
│   ├── icon-maskable-512.png
│   ├── apple-touch-icon.png
│   ├── favicon-32.png
│   └── favicon-16.png
└── README.md               Diese Datei
```

## Funktionen

**Packen & Organisieren**
- Checkboxen pro Packpunkt, Fortschrittsbalken mit Prozentanzeige (sticky im Header)
- Kategorien ein-/ausklappbar, mit eigenem Mini-Fortschrittsring
- „Alle in Kategorie abhaken“ per Klick auf den Kategorie-Kreis
- „Alles abhaken“ / „Alles zurücksetzen“ in den Einstellungen
- Eigene Packpunkte und eigene Kategorien hinzufügen (über den Plus-Button
  unten rechts bzw. in den Einstellungen)

**Suche & Filter**
- Live-Suche über alle Packpunkte (sticky Suchleiste)
- Filter nach Person (Papa, Mama, Tochter 1, Tochter 2, Familie)
- Filter nach Koffer/Zuordnung (Koffer Papa, Koffer Mama, Koffer Kinder,
  Handgepäck, Auto, Ferienhaus-Kiste, Küchen-Kiste, Reiseapotheke-Tasche,
  Strandtasche, Poolbeutel)
- Favoriten-Filter und „Offene ausblenden“

**Statistik**
- Gesamtfortschritt, Anzahl offener Punkte, Favoriten
- Fortschrittsbalken je Person und je Kategorie

**Daten**
- Automatisches Speichern im Browser (localStorage) – kein Internet nötig
- JSON-Export/-Import (z. B. zum Sichern oder Übertragen auf ein anderes Gerät)
- CSV-Export (zur Weiterverarbeitung in Excel/Numbers)
- Druckansicht für eine Papier- bzw. PDF-Version der Liste (Browser-Druckdialog
  „Als PDF sichern“)

**Design**
- Modernes, Apple-iOS-inspiriertes Design: Glassmorphism, große Karten,
  abgerundete Ecken, große Touch-Flächen, sanfte Animationen
- Farbige Kategorien mit eigenem Icon
- Floating Action Button, Bottom Navigation, sticky Suche & Fortschritt
- Hell- und Dunkelmodus (folgt automatisch dem Systemmodus, manuell umschaltbar
  über das Symbol im Header oder in den Einstellungen)
- Mobile First, optimiert für iPhone, responsiv für Tablet und Desktop

**PWA**
- Installierbar auf dem Homescreen (iOS „Zum Home-Bildschirm“, Android/Desktop
  „App installieren“)
- Vollständig offlinefähig durch Service Worker (Cache-First-Strategie)
- Eigene App-Icons in allen benötigten Auflösungen

## Installation & Nutzung

### Lokal öffnen (schnellster Weg)
Da die App einen Service Worker verwendet, muss sie über einen lokalen
Webserver aufgerufen werden (nicht per Doppelklick auf `index.html`, da
Service Worker unter `file://` nicht funktionieren).

```bash
cd packliste
python3 -m http.server 8080
```

Anschließend im Browser öffnen: `http://localhost:8080`

Alternativ mit Node.js:

```bash
npx serve .
```

### Auf dem iPhone installieren
1. Die Projektdateien auf einen Webserver hochladen (z. B. GitHub Pages,
   Netlify, eigener Server) – ein einfacher statischer Hosting-Dienst genügt.
2. Die URL in Safari auf dem iPhone öffnen.
3. Auf das Teilen-Symbol tippen → „Zum Home-Bildschirm“.
4. Die App erscheint als eigenes Icon und startet im Vollbildmodus ohne
   Safari-Oberfläche.

### Hosting-Hinweis
Alle Dateien sind rein statisch (HTML/CSS/JS/JSON) und benötigen kein Backend.
Jeder statische Hosting-Dienst reicht aus (GitHub Pages, Netlify, Vercel,
eigener Webspace). Wichtig ist lediglich, dass die Dateien über HTTPS (oder
`localhost`) ausgeliefert werden, da Service Worker HTTPS voraussetzen.

## Eigene Anpassungen

- **Weitere Packpunkte ergänzen:** entweder direkt in der App über den
  Plus-Button, oder dauerhaft im Quellcode in `data.js` im entsprechenden
  Kategorie-Block ergänzen.
- **Neue Kategorie mit Farbe/Icon fest verankern:** in `data.js` einen neuen
  Eintrag im `categories`-Array anlegen und passende `items` mit derselben
  `category`-ID ergänzen.
- **Design anpassen:** Farben, Radien und Abstände sind zentral als
  CSS-Variablen in `style.css` (Abschnitt „Design-Tokens“) definiert.

## Datenschutz

Alle Daten (Packfortschritt, Favoriten, eigene Punkte) verbleiben ausschließlich
lokal im Browser-Speicher (localStorage) des jeweiligen Geräts. Es findet keine
Übertragung an einen Server statt. Der JSON-Export dient ausschließlich dazu,
die eigenen Daten manuell zu sichern oder auf ein anderes Gerät zu übertragen.

Gute Reise nach Spanien! 🇪🇸☀️
