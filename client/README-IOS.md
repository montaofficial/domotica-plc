# App iOS (Fortitude Domotica) — guida build su Mac

L'app iOS è la stessa webapp React impacchettata con **Capacitor**. Il codice web è
già pronto e adattato al nativo (indirizzo server + login a token + WebSocket).
Questi passi si fanno **su un Mac con Xcode** e producono l'app da installare via
TestFlight o direttamente sul dispositivo.

## Prerequisiti (sul Mac)

- **macOS + Xcode** (dall'App Store) + Command Line Tools.
- **Node.js ≥ 20** e **CocoaPods** (`sudo gem install cocoapods`).
- **Account Apple Developer** (individuale, 99$/anno) — serve per installare su
  device / TestFlight. Attivabile anche dopo aver generato il progetto.
- **Tailscale attivo** sul server (vedi `deploy-package/tailscale-setup.sh`): fornisce
  l'URL HTTPS che l'app userà per raggiungere il controller da ovunque.

## 1. Prendi il codice e imposta l'indirizzo del server

```bash
git clone git@github.com:montaofficial/domotica-plc.git
cd domotica-plc/client
git checkout feat/ios-app
npm install
```

Apri `src/lib/native.js` e metti l'URL HTTPS di Tailscale del server:

```js
export const DEFAULT_NATIVE_SERVER_URL = 'https://fortitude-domotica.<tua-tailnet>.ts.net';
```

(È l'unico valore da personalizzare. Con Tailscale è HTTPS con certificato valido,
quindi NON serve alcuna eccezione ATS in Info.plist.)

## 2. Genera il progetto iOS

```bash
npm run build            # compila la webapp in dist/
npx cap add ios          # crea il progetto Xcode in ios/ (solo la prima volta)
npm run ios:assets       # genera icone + splash da assets/icon.png e assets/splash.png
npx cap sync ios         # copia web + plugin nel progetto nativo
```

## 3. Firma e compila in Xcode

```bash
npx cap open ios
```

In Xcode:
1. Seleziona il target **App** → **Signing & Capabilities**.
2. **Team**: scegli il tuo account Apple Developer (Individual). Bundle ID già impostato:
   `digital.fortitude.domotica` (cambialo se ne vuoi un altro).
3. Collega l'iPhone e premi **Run** per provarla subito sul dispositivo, **oppure**
   **Product → Archive** → **Distribute App → TestFlight** per caricarla e invitare
   altri (es. Vlad) via email da App Store Connect.

## Aggiornare l'app dopo modifiche al codice

```bash
cd client
npm run ios:sync         # build + cap sync ios
npx cap open ios         # poi Run o Archive in Xcode
```

## Note

- **Notifiche push native**: opzionali, si aggiungono dopo (richiedono APNs +
  capability in Xcode). Per ora le notifiche arrivano già via **Telegram**, che
  funziona ovunque senza nulla di tutto questo.
- L'app **riusa il backend esistente**: nessuna modifica al server è necessaria oltre
  a quelle già fatte (CORS per l'app, token per l'app, WebSocket via subprotocol).
- Il **web** resta invariato: la stessa build serve sia il sito che l'app.
