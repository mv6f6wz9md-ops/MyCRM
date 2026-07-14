/* ==========================================================================
   Firebase-Konfiguration für die gemeinsame Bearbeitung (Sync).
   ==========================================================================

   Trage hier die Config-Werte deines eigenen Firebase-Projekts ein:
   Firebase Console -> Projekteinstellungen -> "Meine Apps" -> Web-App
   (</> Symbol) -> "SDK-Setup und Konfiguration" -> Config kopieren.

   Falls du bereits ein Firebase-Projekt für ClientOS oder FamilyHub nutzt,
   kannst du entweder dasselbe Projekt wiederverwenden (dann landet die
   Packliste in derselben Firestore-Datenbank, aber in einer eigenen
   Collection "packlisten" – es gibt keine Überschneidung mit deinen
   anderen Apps) oder ein neues, eigenes Projekt anlegen.

   Solange hier noch "DEIN_API_KEY" steht, bleibt die App automatisch im
   reinen Offline-/Lokal-Modus (kein Sync, keine Fehlermeldungen).
   ========================================================================== */

const firebaseConfig = {
  apiKey: "AIzaSyDoGq92bpbPgKMpE5ZAIeNC5r52j_B1_xc",
  authDomain: "packliste-8f4a1.firebaseapp.com",
  projectId: "packliste-8f4a1",
  storageBucket: "packliste-8f4a1.firebasestorage.app",
  messagingSenderId: "449772649761",
  appId: "1:449772649761:web:fee350a1eb1474c7ad9260"
};
