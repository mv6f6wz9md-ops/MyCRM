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

const FIREBASE_CONFIG = {
  apiKey: "DEIN_API_KEY",
  authDomain: "DEIN_PROJEKT.firebaseapp.com",
  projectId: "DEIN_PROJEKT",
  storageBucket: "DEIN_PROJEKT.appspot.com",
  messagingSenderId: "DEINE_SENDER_ID",
  appId: "DEINE_APP_ID",
};
