# Hotel Booking System

Sistema di richiesta prenotazione per hotel con 15 camere, integrato nel sito web dell'hotel.

## Funzionalità

- Form di prenotazione completo per i clienti
- Tokenizzazione sicura dei dati carta tramite Stripe
- Pannello admin per la reception
- Configurazione pagamento flessibile (addebito, pre-autorizzazione, nessuna azione)
- Sistema di conferma/rifiuto manuale delle prenotazioni

## Requisiti

- Node.js 18+
- PostgreSQL 14+
- Account Stripe (per i pagamenti)

## Configurazione

### 1. Database

Crea un database PostgreSQL:

```sql
CREATE DATABASE hotel_booking;
```

### 2. Variabili d'ambiente

Copia il file `.env.example` in `.env` nel backend e configura:

- `DATABASE_URL`: Connessione al database PostgreSQL
- `STRIPE_SECRET_KEY`: Chiave segreta Stripe
- `STRIPE_PUBLISHABLE_KEY`: Chiave pubblica Stripe
- `JWT_SECRET`: Segreto per i token JWT

### 3. Stripe

1. Crea un account su [Stripe](https://stripe.com)
2. Ottieni le API key dal pannello Stripe
3. Inseriscile nel file `.env`

## Avvio

### Backend

```bash
cd backend
npm install
npm run dev
```

Il server avrà su `http://localhost:5000`

### Frontend

```bash
cd frontend
npm install
npm start
```

Il frontend avrà su `http://localhost:3000`

## Struttura del progetto

```
hotel-booking-system/
├── backend/
│   ├── server.js          # Server Express principale
│   ├── .env               # Variabili d'ambiente
│   └── package.json
└── frontend/
    ├── public/
    ├── src/
    │   ├── components/
    │   │   ├── BookingForm.js    # Form prenotazione clienti
    │   │   ├── AdminPanel.js     # Pannello reception
    │   │   └── Login.js          # Login reception
    │   ├── App.js
    │   └── index.js
    └── package.json
```

## Flusso di utilizzo

### Cliente

1. Accede al sito e naviga a "Prenota"
2. Compila il form con date, tipo camera, dati personali
3. Inserisce i dati della carta (tokenizzata da Stripe)
4. Invia la richiesta
5. Riceve conferma: "Richiesta ricevuta. Nessun importo addebitato."

### Reception

1. Accede al pannello admin
2. Visualizza le richieste in attesa
3. Controlla la disponibilità su Booking.com
4. Aggiorna manualmente Booking.com
5. Conferma o rifiuta la prenotazione
6. Il pagamento viene gestito secondo la configurazione

## Configurazione pagamento

Nel pannello reception è possibile configurare:

- **Addebita subito**: Carta viene addebitata al momento della conferma
- **Solo pre-autorizzazione**: Carta viene bloccata, addebito al check-in
- **Nessuna azione**: Nessun addebito, pagamento gestito manualmente

## Sicurezza

- I dati carta non vengono mai salvati nel database
- Tokenizzazione tramite Stripe (PCI DSS compliant)
- Autenticazione JWT per il pannello admin
- HTTPS consigliato per produzione

## Produzione

Per il deployment in produzione:

1. Configura HTTPS (consigliato Let's Encrypt)
2. Cambia le Stripe key da test a live
3. Configura un server PostgreSQL gestito
4. Imposta variabili d'ambiente sicure
5. Configura backup automatici del database
