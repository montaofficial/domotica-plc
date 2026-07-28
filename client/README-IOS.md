# App iOS (Fortitude Domotica) — guida build su Mac

L'app iOS è la stessa webapp React impacchettata con **Capacitor**. Il codice è già
pronto e adattato al nativo: parla col server pubblico **https://domotica.fortitude-dev.com**
passando il cancello **Cloudflare Access** con un *service token*, e usa il login a
token dell'app. Questi passi si fanno **su un Mac con Xcode** e producono l'app da
distribuire via TestFlight.

## Prerequisiti (sul Mac)

- **macOS + Xcode** (App Store) + Command Line Tools.
- **Node.js ≥ 20** e **CocoaPods** (`sudo gem install cocoapods`).
- **Account Apple Developer** (già attivo).
- Il server è già raggiungibile pubblicamente via Cloudflare (Tunnel + Access):
  nessuna VPN, nessuna configurazione lato rete da fare.

## 1. Prendi il codice

```bash
git clone git@github.com:montaofficial/domotica-plc.git
cd domotica-plc/client
git checkout feat/ios-app
npm install
```

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

## 4. Firma e distribuisci in Xcode

```bash
npx cap open ios
```

In Xcode:
1. Target **App** → **Signing & Capabilities** → **Team**: il tuo account Apple Developer.
   Bundle ID già impostato: `digital.fortitude.domotica`.
2. **Run** sull'iPhone collegato per provarla, **oppure Product → Archive →
   Distribute App → TestFlight** per caricarla e invitare altri (es. Vlad) via email.

## Aggiornare l'app dopo modifiche

```bash
cd client
npm run ios:sync         # build + cap sync ios
npx cap open ios         # poi Run o Archive
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
