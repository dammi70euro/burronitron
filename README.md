# BURRONITRON

Daredario e l'avventura nei canyon in quattro atti: un flipper che gira tutto nel browser.
Niente server, niente build: HTML + Canvas + Web Audio, pronto per GitHub Pages.

## Come si gioca

| Azione | Tastiera | Telefono |
|---|---|---|
| Flipper sinistro | `Z`, `Shift` sinistro, `←` | tocca la metà sinistra |
| Flipper destro | `/`, `Shift` destro, `→` | tocca la metà destra |
| Lancio | tieni premuto `SPAZIO` e rilascia | tieni premuto START (o la metà destra) |
| Scuoti | `X`, `↑` (attento al TILT) | tre dita |
| Vista 3D/piatta | `V` | pulsante 3D |
| Pausa / audio / musica | `P` / `M` / `B` | pulsanti sul backglass |

### Le regole

- **Quattro atti**: I *Sul bordo* (25 colpi ai bumper), II *Il salto* (3 orbite a sinistra),
  III *L'arrampicata* (abbatti 2 volte gli appigli), IV *Il tramonto* (multiball a 3 palle con jackpot).
  Completato l'obiettivo, entra nella **BUCA** per passare all'atto successivo.
- **D·A·R·I·O**: accendi le 5 corsie in alto per aumentare il moltiplicatore bonus (i flipper spostano le luci).
- **T·R·O·N**: colpisci i 4 target viola, la prima volta vinci una **extra ball**.
- **Skill shot**: col lancio, fai cadere la palla nella corsia che lampeggia.
- **Kickback** nell'outlane sinistro, si riaccende abbattendo gli appigli.
- **Combo**: colpi diversi (orbita, buca, appigli) in rapida sequenza.
- Dopo il tramonto si riparte dall'atto I con punti moltiplicati per il livello.

## Pubblicare su GitHub Pages

1. Fai push del repository su GitHub.
2. *Settings → Pages → Build and deployment*: Source **Deploy from a branch**, branch `main`, cartella `/ (root)`.
3. Dopo un minuto il gioco è su `https://<utente>.github.io/<repo>/`.

## Provarlo in locale

Aprire `index.html` con doppio clic funziona, ma le voci vanno meglio con un piccolo server:

```bash
python -m http.server 8000
```

e poi apri http://localhost:8000.

## Struttura

- `index.html`, `style.css`: cabinato, backglass, overlay
- `js/game.js`: tavolo, fisica e regole
- `js/render.js`: disegno e interfaccia
- `js/audio.js`: effetti sintetizzati, musica di sfondo (`assets/background.mp3` in loop) e voci (associazioni in `VOICES`)
- `assets/img`: grafiche ottimizzate (il piano `canyon.jpg` è ricavato dall'immagine originale)
- `assets/voci`: le voci convertite in mp3 (gli originali sono in `vocals/`); `vocalsN.mp3` vengono pescati a caso, il numero è in `VOCALS_COUNT` in `js/audio.js`
