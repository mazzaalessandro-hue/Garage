# Garage

Web app per tenere sotto controllo un'auto (o più di una): spese mensili di ricariche, carburante e manutenzione, scadenze con promemoria ricorrenti, chilometri e scheda del veicolo.

- Funziona con qualsiasi alimentazione: elettrica, ibrida, plug-in, benzina, diesel, GPL, metano.
- Al primo avvio chiede di registrare il veicolo.
- I dati restano **solo sul dispositivo** di chi la usa (memoria del browser): nessun account, nessun server.
- Dal menu dei veicoli si può esportare e importare un file di backup.
- Si installa sul telefono da Chrome con **Installa app** e funziona anche senza connessione.

## File

| File | A cosa serve |
|---|---|
| `index.html` | L'app |
| `manifest.webmanifest` | Nome, colori e icone per l'installazione |
| `sw.js` | Funzionamento senza connessione |
| `*.png` | Icone |

Pubblicata con GitHub Pages dal ramo `main`, cartella principale. Quando si modifica l'app, aumentare `VERSIONE` in `sw.js` perché i telefoni scarichino la versione nuova.
