# App iOS (Fortitude Domotica) — guida build su Mac

L'app iOS è la stessa webapp React impacchettata con **Capacitor**. Il codice è già
pronto e adattato al nativo: parla col server pubblico **https://domotica.fortitude-dev.com**
passando il cancello **Cloudflare Access** con un *service token*, e usa il login a
token dell'app. Questi passi si fanno **su un Mac con Xcode** e producono l'app da
distribuire via TestFlight.

## Prerequisiti (sul Mac)

- **macOS + Xcode** (App Store) + Command Line Tools.
- **Node.js ≥ 20**.
- **CocoaPods non serve.** Da Capacitor 8 le dipendenze native sono gestite con
  **Swift Package Manager**: `npx cap add ios` genera un `Package.swift` e Xcode
  risolve i pacchetti da solo (niente `Podfile`, niente `pod install`).
- **Account Apple Developer** (già attivo).
- Il server è già raggiungibile pubblicamente via Cloudflare (Tunnel + Access):
  nessuna VPN, nessuna configurazione lato rete da fare.

## 1. Prendi il codice

```bash
git clone git@github.com:montaofficial/domotica-plc.git
cd domotica-plc/client
npm install
```

Il codice iOS è su **`main`** — il branch `feat/ios-app` è stato integrato e non
serve più farne il checkout.

## 2. Inserisci il service token di Cloudflare Access

L'app deve passare il cancello Access in automatico. Crea il file `.env.local`:

```bash
cp .env.local.example .env.local
```

e mettici i due valori del service token **domotica-app** (sono sul server in
`~/deploy-package/cf-service-token.txt`):

```
VITE_CF_ACCESS_CLIENT_ID=xxxxxxxx.access
VITE_CF_ACCESS_CLIENT_SECRET=xxxxxxxx
```

`.env.local` è git-ignored: il secret resta solo sul Mac di build, non finisce mai
nel repo né nella build web pubblica.

## 3. Genera il progetto iOS

```bash
npm run build            # compila la webapp (con il service token) in dist/
npx cap add ios          # crea il progetto Xcode in ios/ (solo la prima volta)
npm run ios:assets       # icone + splash da assets/icon.png e assets/splash.png
npx cap sync ios         # copia web + plugin nel progetto nativo
```

`cap add ios` scrive un `ios/App/Package.swift` con i plugin nativi (`@capacitor/app`,
`@capacitor/preferences`) e il pacchetto `capacitor-swift-pm`. Al primo `xcodebuild`
(o alla prima apertura in Xcode) i pacchetti vengono scaricati e risolti: la prima
build è quindi più lenta, le successive usano la cache.

## 4. Firma e distribuisci su TestFlight

Il progetto usa **automatic signing** con team `G46BS9323G` (ALEXANDRU MARCIUC) e
bundle id `digital.fortitude.domotica`, già impostati in `project.pbxproj`.

### Prerequisiti una tantum

1. **Chiave API App Store Connect** — [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
   → *Users and Access* → *Integrations* → *App Store Connect API* → *Team Keys* →
   **+**, ruolo **App Manager**. Il file `AuthKey_<KEY_ID>.p8` è scaricabile **una
   volta sola**: mettilo in `~/.appstoreconnect/private_keys/` (è lì che `altool`
   lo cerca in automatico). Annota **Key ID** e **Issuer ID**.
2. **Record dell'app su App Store Connect** — *Apps* → **+** → *New App*:
   piattaforma iOS, bundle id `digital.fortitude.domotica`, SKU a piacere. Questo
   passaggio **va fatto dal sito**: l'API di App Store Connect non espone la
   creazione di nuove app. Senza il record, l'upload fallisce con
   *"No suitable application records were found"*.

### Percorso da terminale (nessun passaggio in Xcode)

```bash
cd client/ios/App

KEY_ID=XXXXXXXXXX
ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
P8=~/.appstoreconnect/private_keys/AuthKey_$KEY_ID.p8

# Archive. Con --allowProvisioningUpdates + la chiave API, Xcode registra da solo
# il bundle id nel portale e genera il provisioning profile se mancano.
xcodebuild -scheme App -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath build/App.xcarchive \
  -allowProvisioningUpdates \
  -authenticationKeyPath "$P8" \
  -authenticationKeyID "$KEY_ID" \
  -authenticationKeyIssuerID "$ISSUER_ID" \
  archive

# Export dell'IPA
xcodebuild -exportArchive \
  -archivePath build/App.xcarchive \
  -exportPath build/ipa \
  -exportOptionsPlist ExportOptions.plist \
  -allowProvisioningUpdates \
  -authenticationKeyPath "$P8" \
  -authenticationKeyID "$KEY_ID" \
  -authenticationKeyIssuerID "$ISSUER_ID"

# Upload su TestFlight
xcrun altool --upload-app -f build/ipa/App.ipa -t ios \
  --apiKey "$KEY_ID" --apiIssuer "$ISSUER_ID"
```

`ExportOptions.plist` (accanto a `App.xcodeproj`):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>app-store-connect</string>
  <key>teamID</key>
  <string>G46BS9323G</string>
  <key>uploadSymbols</key>
  <true/>
</dict>
</plist>
```

**Ogni upload richiede un build number nuovo.** App Store Connect rifiuta un build
già caricato per la stessa versione. Prima di ri-archiviare, incrementa
`CURRENT_PROJECT_VERSION`:

```bash
cd client/ios/App && agvtool next-version -all
```

Dopo l'upload la build compare in TestFlight dopo qualche minuto di processing.
Per invitare i tester (es. Vlad) aggiungi la sua email in *TestFlight → Tester
interni/esterni* su App Store Connect.

### Percorso alternativo via Xcode (GUI)

```bash
npx cap open ios
```

Richiede che Xcode sia loggato con l'account Developer (*Xcode → Settings →
Accounts*), altrimenti l'archive fallisce con *"No Accounts: Add a new account in
Accounts settings"*. Poi: **Run** sull'iPhone collegato per provarla, oppure
**Product → Archive → Distribute App → TestFlight**.

## Aggiornare l'app dopo modifiche

```bash
cd client
npm run ios:sync         # build + cap sync ios
cd ios/App && agvtool next-version -all   # build number nuovo per l'upload
```

Poi ripeti archive → export → upload del [passo 4](#4-firma-e-distribuisci-su-testflight)
(oppure `npx cap open ios` se preferisci la strada GUI).

## Risoluzione problemi

### `Parsing capacitor.config.ts failed` — `Cannot read properties of undefined (reading 'CommonJS')`

Sintomo: `npx cap add ios` (o qualsiasi comando `cap`) muore così:

```
[error] Parsing capacitor.config.ts failed.
        TypeError: Cannot read properties of undefined (reading 'CommonJS')
```

Causa: il CLI di Capacitor legge `capacitor.config.ts` transpilandolo con l'API
programmatica di TypeScript (`ts.ModuleKind`, `ts.ScriptTarget`). Quella API esiste
in **TypeScript 5.x** ma non è più esposta allo stesso modo in **TypeScript 7.x**.
TypeScript non è una nostra dipendenza diretta: arriva in modo transitivo da
`@capacitor/assets` → `@trapezedev/project` → `ts-node`, che lo dichiara con un
range molto largo — quindi npm issa una 7.x in cima a `node_modules` e il CLI la
raccoglie.

Fix: `typescript` è **pinnato a `^5.9.0`** nelle `devDependencies` di `client/`.
Non serve fare nulla a mano, basta `npm install`. Se l'errore ricompare dopo un
aggiornamento di dipendenze, controlla che la risoluzione sia ancora una 5.x:

```bash
npm ls typescript        # deve mostrare typescript@5.x, non 7.x
```

## Note

- **Aggiornamenti in tempo reale**: sul web arrivano via WebSocket; sull'app nativa
  Cloudflare Access blocca i WebSocket (limite del WKWebView), quindi l'app **fa
  polling** ogni pochi secondi — le luci/stati restano aggiornati comunque. (Il
  real-time nativo si può aggiungere in futuro con un bypass Access sul path `/ws`.)
- **Sicurezza a strati**: Cloudflare Tunnel (niente porte aperte) → Cloudflare Access
  (service token per l'app, email OTP per il browser) → login dell'app.
- Il **web** resta invariato: la stessa build serve sia il sito che l'app.
- Per invitare **Vlad**: aggiungi la sua email alla policy Access "Utenti autorizzati"
  (dashboard Cloudflare Zero Trust → Access → Applications → Domotica), poi invitalo
  su TestFlight da App Store Connect.
