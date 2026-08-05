import React, { createContext, useContext, useState } from 'react';

const LanguageContext = createContext();

const translations = {
  it: {
    'nav.home': 'Home',
    'nav.book': 'Prenota',
    'nav.reception': 'Reception',
    'nav.logout': 'Esci',

    'hero.eyebrow': 'Via Milano 96 · Napoli Centro Storico',
    'hero.title': 'Dormi nel cuore di Napoli.',
    'hero.lede':
      'Un albergo accogliente nel centro storico, a 300 metri dalla stazione Napoli Centrale. Gestito dalla stessa famiglia dal 1973, in un edificio dei primi del Novecento.',
    'hero.address': 'Check-in 13:00–19:00 · Check-out entro le 10:00',
    'hero.caption': 'Cartolina dal golfo',
    'hero.stamp': 'NAPOLI',

    'pos.label': 'Posizione',
    'pos.value': 'Centro storico · Via Milano 96',
    'station.label': 'Stazione',
    'station.value': 'Napoli Centrale a 300 m — ~5 min a piedi',
    'rating.label': 'Voto ospiti',
    'rating.value': '7,5 su 662 recensioni',

    'city.eyebrow': 'La città intorno',
    'city.title': 'Benvenuto a Napoli',
    'city.p':
      'Dalla tua stanza il golfo, Pompei e il castello più famoso della città ti aspettano a pochi passi.',
    'city.golfo.title': 'Golfo di Napoli',
    'city.golfo.note': 'La veduta che ti accompagna al mattino, con il Vesuvio all’orizzonte.',
    'city.pompei.title': 'Pompei',
    'city.pompei.note': 'A 25 minuti di treno, la città romana più visitata al mondo.',
    'city.maschio.title': 'Maschio Angioino',
    'city.maschio.note': 'Il castello aragonese che domina piazza Municipio.',

    'story.eyebrow': 'La nostra storia',
    'story.title': 'Un albergo di famiglia',
    'story.p':
      'Costruito nei primi del Novecento, l’Hotel Vittorio Veneto è gestito dalla stessa famiglia dal 1973. Un’accoglienza che sa di casa, a due passi dalla stazione e dal centro storico di Napoli.',
    'story.period.label': 'Gestione familiare dal',
    'story.period.value': '1973',
    'story.building.label': 'Edificio',
    'story.building.value': 'dei primi del 1900',

    'rooms.eyebrow': 'L’albergo',
    'rooms.title': 'Le nostre camere',
    'rooms.p':
      'Dalla singola con bagno condiviso alla tripla con balcone. Ogni camera ha TV, scrivania e l’atmosfera del centro storico.',
    'rooms.booking.title': 'Il tuo soggiorno',
    'rooms.booking.p':
      'Controlla le date e invia la richiesta: la reception conferma entro poche ore. Nessun addebito prima della conferma.',
    'rooms.booking.cta': 'Prenota ora',
    'rooms.perNight': '/notte',
    'rooms.directBadge': '–10% prenotazione diretta',
    'rooms.guest.1': '1 ospite',
    'rooms.guest.2': '2 ospiti',
    'rooms.guest.3': '3 ospiti',

    'services.eyebrow': 'Servizi inclusi',
    'services.title': 'Quello che trovi da noi',
    'service.wifi.t': 'Wi-Fi gratuito',
    'service.wifi.d': 'Connessione in tutte le aree comuni',
    'service.breakfast.t': 'Colazione in camera',
    'service.breakfast.d': 'Su richiesta, ogni mattina',
    'service.luggage.t': 'Deposito bagagli',
    'service.luggage.d': 'Lib, prima del check-in e dopo il check-out',
    'service.cleaning.t': 'Pulizia giornaliera',
    'service.cleaning.d': 'Camere e cambio biancheria',
    'service.ac.t': 'Aria condizionata',
    'service.ac.d': 'Nelle camere con bagno privato',
    'service.checkin.t': 'Check-in rapido',
    'service.checkin.d': 'Epress check-in dalle 13:00',

    'map.eyebrow': 'Dove siamo',
    'map.title': 'Via Milano 96, Napoli',
    'map.p':
      'Nel cuore del centro storico, a 300 metri dalla stazione Napoli Centrale e a pochi passi dalle strade più vive della città.',
    'map.titleAttr': 'Posizione Hotel Vittorio Veneto',

    'desc.singola.shared': 'TV, scrivania e armadio. Bagno condiviso al piano. 12 m².',
    'desc.twinshared': 'Letto matrimoniale o due letti, balcone e scrivania. 15 m².',
    'desc.singola.priv': 'Aria condizionata, TV e bagno privato con bidet. 12 m².',
    'desc.doppia': 'Bagno privato, TV e balcone affacciato sulla via. 15 m².',
    'desc.tripla': 'Perfetta per famiglie: matrimoniale più letto singolo. 18 m².',

    'booking.eyebrow': 'Richiesta di prenotazione',
    'booking.quote': 'Calcola preventivo',
    'booking.completeFields': 'Completa tutti i campi (date, camera, nome, email e documento) per procedere.',
    'label.idDocument': 'Documento d\'identità (foto o PDF)',
    'idDocument.uploaded': 'Caricato',
    'idDocument.hint': 'Obbligatorio per legge, max 5 MB.',
    'booking.title': 'Prenota la tua camera',
    'booking.p':
      'Scegli le date e i dati della carta. Non ti addebitiamo nulla adesso: la reception conferma prima, il pagamento avviene solo dopo la conferma.',
    'booking.loading': 'Elaborazione in corso...',
    'booking.submit': 'Invia richiesta di prenotazione',

    'label.checkin': 'Data Check-in',
    'label.checkout': 'Data Check-out',
    'label.roomtype': 'Tipologia Camera',
    'label.guests': 'Numero Ospiti',
    'label.name': 'Nome e Cognome',
    'label.email': 'Email',
    'label.phone': 'Telefono',
    'label.notes': 'Note o Richieste Speciali',
    'label.card': 'Dati Carta di Credito',
    'notes.ph': 'Es: Richieste particolari, cuscini extra, etc.',
    'price.nocharge': 'Nessun addebito ora. Il pagamento avviene solo dopo la conferma dell\u2019hotel.',
    'price.dynamic': 'tariffa per giorno',
    'price.discount': 'sconto diretto sul sito',
    'price.firstnight.pre': 'Addebito alla carta oggi:',
    'price.firstnight.post': '(prima notte). Il resto si paga in struttura.',
    'payment.paypal': 'PayPal',
    'payment.paypal.desc': 'Serve un conto PayPal. Non paghi subito: autorizzi l\'acconto della prima notte, che viene addebitato solo quando confermiamo la prenotazione. Il resto si paga in struttura.',
    'payment.bonifico': 'Bonifico istantaneo',
    'payment.bonifico.desc': 'Paghi in anticipo con bonifico, ti confermiamo quando arriva.',
    'paypal.loading': 'Caricamento PayPal...',
    'paypal.notConfigured': 'Il pagamento PayPal sarà attivo a breve. Per ora scegli il bonifico.',
    'paypal.error': 'Si è verificato un errore con PayPal. Riprova.',
    'booking.quote.first': 'Prima calcola il preventivo qui sopra.',
    'bonifico.title': 'Dati per il bonifico istantaneo',
    'bonifico.intestatario': 'A favore di',
    'bonifico.iban.pending': 'I dati bancari verranno inviati via email.',
    'bonifico.note': 'Dopo aver effettuato il bonifico, invia la richiesta. L\'albergo verifica il pagamento e conferma la prenotazione.',
    'night.singular': 'notte',
    'night.plural': 'notti',
    'stripe.note': 'I tuoi dati sono al sicuro. La carta viene tokenizzata e non salvata sul nostro server.',
    'success.title': 'Richiesta Ricevuta!',
    'success.nocharge': 'Nessun importo è stato addebitato.',
    'success.bonifico.done': 'Richiesta inviata. Esegui il bonifico istantaneo a:',
    'success.bonifico.confirm': 'Una volta ricevuto il pagamento, confermeremo la tua prenotazione.',
    'success.paypal': 'Grazie! Hai autorizzato l\'acconto della prima notte. Lo addebiteremo solo se confermiamo la prenotazione (entro 24 ore). Il resto si paga in struttura.',
    'success.validafter': 'La prenotazione sarà valida solamente dopo la conferma dell\u2019hotel.',
    'success.email': 'Riceverai una comunicazione via email.',

    'login.title': 'Accesso Reception',
    'login.emailPlaceholder': 'La tua email',
    'login.register.title': 'Registrazione Reception',
    'login.password': 'Password',
    'login.loading': 'Accesso in corso...',
    'login.submit': 'Accedi',
    'login.register.cta': 'Registrati',
    'login.haveAccount': 'Hai già un account? Accedi',
    'login.noAccount': 'Non hai un account? Registrati',

    'footer.addr': 'Via Milano 96, 80142 Napoli',
    'footer.rights': 'Tutti i diritti riservati',
  },
  en: {
    'nav.home': 'Home',
    'nav.book': 'Book',
    'nav.reception': 'Reception',
    'nav.logout': 'Log out',

    'hero.eyebrow': 'Via Milano 96 · Naples Historic Centre',
    'hero.title': 'Sleep in the heart of Naples.',
    'hero.lede':
      'A welcoming hotel in the historic centre, 300 metres from Naples Central station. Run by the same family since 1973 in a building from the early 1900s.',
    'hero.address': 'Check-in 1–7 pm · Check-out by 10 am',
    'hero.caption': 'Postcard from the bay',
    'hero.stamp': 'NAPLES',

    'pos.label': 'Location',
    'pos.value': 'Historic centre · Via Milano 96',
    'station.label': 'Train station',
    'station.value': 'Naples Central 300 m — ~5 min walk',
    'rating.label': 'Guest rating',
    'rating.value': '7.5 out of 662 reviews',

    'city.eyebrow': 'The city around',
    'city.title': 'Welcome to Naples',
    'city.p':
      'From your room the bay, Pompeii and the city’s most famous castle are just a few steps away.',
    'city.golfo.title': 'Bay of Naples',
    'city.golfo.note': 'The view that greets you in the morning, Vesuvius on the horizon.',
    'city.pompei.title': 'Pompeii',
    'city.pompei.note': '25 minutes by train, the most visited Roman city in the world.',
    'city.maschio.title': 'Maschio Angioino',
    'city.maschio.note': 'The Aragonese castle overlooking Piazza Municipio.',

    'story.eyebrow': 'Our story',
    'story.title': 'A family-run hotel',
    'story.p':
      'Built in the early 1900s, Hotel Vittorio Veneto has been run by the same family since 1973. A home-style welcome, a stone’s throw from the station and Naples’ historic centre.',
    'story.period.label': 'Family-run since',
    'story.period.value': '1973',
    'story.building.label': 'Building',
    'story.building.value': 'from the early 1900s',

    'rooms.eyebrow': 'The hotel',
    'rooms.title': 'Our rooms',
    'rooms.p':
      'From a single with shared bathroom to a triple with balcony. Every room has a TV, desk and the atmosphere of the historic centre.',
    'rooms.booking.title': 'Your stay',
    'rooms.booking.p':
      'Check the dates and send your request: the reception confirms within a few hours. No charge before confirmation.',
    'rooms.booking.cta': 'Book now',
    'rooms.perNight': '/night',
    'rooms.directBadge': '–10% direct booking',
    'rooms.guest.1': '1 guest',
    'rooms.guest.2': '2 guests',
    'rooms.guest.3': '3 guests',

    'services.eyebrow': 'Services included',
    'services.title': 'What you’ll find with us',
    'service.wifi.t': 'Free Wi-Fi',
    'service.wifi.d': 'Connection throughout the common areas',
    'service.breakfast.t': 'Breakfast in room',
    'service.breakfast.d': 'On request, every morning',
    'service.luggage.t': 'Luggage storage',
    'service.luggage.d': 'Free before check-in and after check-out',
    'service.cleaning.t': 'Daily housekeeping',
    'service.cleaning.d': 'Room cleaning and linen change',
    'service.ac.t': 'Air conditioning',
    'service.ac.d': 'In rooms with private bathroom',
    'service.checkin.t': 'Express check-in',
    'service.checkin.d': 'Express check-in from 1 pm',

    'map.eyebrow': 'Where we are',
    'map.title': 'Via Milano 96, Naples',
    'map.p':
      'In the heart of the historic centre, 300 metres from Naples Central station and a few steps from the liveliest streets in the city.',
    'map.titleAttr': 'Hotel Vittorio Veneto location',

    'desc.singola.shared': 'TV, desk and wardrobe. Shared bathroom on the floor. 12 m².',
    'desc.twinshared': 'Double or twin beds, balcony and desk. 15 m².',
    'desc.singola.priv': 'Air conditioning, TV and private bathroom with bidet. 12 m².',
    'desc.doppia': 'Private bathroom, TV and balcony overlooking the street. 15 m².',
    'desc.tripla': 'Perfect for families: double plus a single bed. 18 m².',

    'booking.eyebrow': 'Booking request',
    'booking.quote': 'Get a quote',
    'booking.completeFields': 'Complete all fields (dates, room, name, email and ID document) to proceed.',
    'label.idDocument': 'ID document (photo or PDF)',
    'idDocument.uploaded': 'Uploaded',
    'idDocument.hint': 'Required by law, max 5 MB.',
    'booking.title': 'Book your room',
    'booking.p':
      'Choose the dates and card details. We won\u2019t charge you anything now: the reception confirms first and payment happens only after confirmation.',
    'booking.loading': 'Processing...',
    'booking.submit': 'Send booking request',

    'label.checkin': 'Check-in date',
    'label.checkout': 'Check-out date',
    'label.roomtype': 'Room type',
    'label.guests': 'Number of guests',
    'label.name': 'Full name',
    'label.email': 'Email',
    'label.phone': 'Phone',
    'label.notes': 'Notes or special requests',
    'label.card': 'Card details',
    'notes.ph': 'e.g. Special requests, extra pillows, etc.',
    'price.nocharge': 'No charge now. Payment happens only after hotel confirmation.',
    'price.dynamic': 'per-day rate',
    'price.discount': 'direct booking discount',
    'price.firstnight.pre': 'Card charge today:',
    'price.firstnight.post': '(first night). The balance is paid at the property.',
    'payment.paypal': 'PayPal',
    'payment.paypal.desc': 'Requires a PayPal account. You don\'t pay now: you authorize the first-night deposit, charged only when we confirm the booking. The balance is paid on site.',
    'payment.bonifico': 'Instant bank transfer',
    'payment.bonifico.desc': 'Pay in advance by bank transfer, we confirm once it arrives.',
    'paypal.loading': 'Loading PayPal...',
    'paypal.notConfigured': 'PayPal payment will be available soon. For now, choose bank transfer.',
    'paypal.error': 'Something went wrong with PayPal. Please try again.',
    'booking.quote.first': 'First calculate the quote above.',
    'bonifico.title': 'Bank transfer details',
    'bonifico.intestatario': 'Payable to',
    'bonifico.iban.pending': 'The bank details will be sent to you by email.',
    'bonifico.note': 'After making the transfer, send the request. The hotel verifies the payment and confirms the booking.',
    'night.singular': 'night',
    'night.plural': 'nights',
    'stripe.note': 'Your details are safe. The card is tokenized and never stored on our server.',
    'success.title': 'Request received!',
    'success.nocharge': 'No amount has been charged.',
    'success.bonifico.done': 'Request sent. Make the instant bank transfer to:',
    'success.bonifico.confirm': 'Once we receive the payment, we will confirm your booking.',
    'success.paypal': 'Thank you! You authorized the first-night deposit. We will only charge it if we confirm the booking (within 24 hours). The balance is paid on site.',
    'success.validafter': 'The booking will only be valid after hotel confirmation.',
    'success.email': 'You will receive an email confirmation.',

    'login.title': 'Reception login',
    'login.emailPlaceholder': 'Your email',
    'login.register.title': 'Reception registration',
    'login.password': 'Password',
    'login.loading': 'Signing in...',
    'login.submit': 'Log in',
    'login.register.cta': 'Register',
    'login.haveAccount': 'Already have an account? Log in',
    'login.noAccount': 'No account? Register',

    'footer.addr': 'Via Milano 96, 80142 Naples',
    'footer.rights': 'All rights reserved',
  }
};

const ROOM_NAME_EN = {
  'Singola Bagno Condiviso': 'Single · Shared bathroom',
  'Singola Bagno Privato': 'Single · Private bathroom',
  'Doppia Standard': 'Double Standard',
  'Doppia/Twin Bagno Condiviso': 'Double/Twin · Shared bathroom',
  'Tripla Standard': 'Triple Standard'
};

const ROOM_DESC_EN = {
  'Singola Bagno Condiviso': 'TV, desk and wardrobe. Shared bathroom on the floor. 12 m².',
  'Singola Bagno Privato': 'Air conditioning, TV and private bathroom with bidet. 12 m².',
  'Doppia Standard': 'Private bathroom, TV and balcony overlooking the street. 15 m².',
  'Doppia/Twin Bagno Condiviso': 'Double or twin beds, balcony and desk. 15 m².',
  'Tripla Standard': 'Perfect for families: double plus a single bed. 18 m².'
};

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    try {
      return localStorage.getItem('lang') || 'it';
    } catch (e) {
      return 'it';
    }
  });

  const changeLang = (next) => {
    setLang(next);
    try {
      localStorage.setItem('lang', next);
    } catch (e) {}
  };

  const t = (key) => {
    const dict = translations[lang] || {};
    return dict[key] !== undefined ? dict[key] : (translations.it[key] || key);
  };

  const roomName = (itName) => {
    if (!itName) return '';
    return lang === 'en' ? (ROOM_NAME_EN[itName] || itName) : itName;
  };

  const roomDesc = (itDesc, itName) => {
    if (lang === 'en') {
      return ROOM_DESC_EN[itName] || itDesc || '';
    }
    return itDesc || '';
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang: changeLang, t, roomName, roomDesc }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}