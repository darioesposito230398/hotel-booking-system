import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import BookingForm from './components/BookingForm';
import AdminPanel from './components/AdminPanel';
import Login from './components/Login';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const stripePromise = loadStripe('pk_test_your_stripe_publishable_key');

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (token) => {
    localStorage.setItem('token', token);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
  };

  const HomePage = () => (
    <>
      <section className="hero">
        <div className="hero-text">
          <span className="eyebrow">Via Milano 96 · Napoli Centro Storico</span>
          <h1>Dormi nel cuore di Napoli.</h1>
          <p className="lede">
            Un albergo accogliente a 300 metri da Piazza Garibaldi, circondato dalle
            pizzerie e dal rumore vero della città. La tua base per scoprire il golfo.
          </p>
          <p className="address-line">Check-in 13:00–19:00 &nbsp;·&nbsp; Check-out entro le 10:00</p>
        </div>
        <div className="hero-photo">
          <figure className="postcard">
            <img src="/images/golfo-napoli.jpg" alt="Golfo di Napoli" />
            <figcaption className="postcard-caption">
              <span>Cartolina dal golfo</span>
              <span className="stamp">NAPOLI</span>
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="info-strip">
        <div className="info-item">
          <div className="info-label">Posizione</div>
          <div className="info-value">300 m da Piazza Garibaldi</div>
        </div>
        <div className="info-item">
          <div className="info-label">Stazione</div>
          <div className="info-value">Napoli Centrale a 7 minuti a piedi</div>
        </div>
        <div className="info-item">
          <div className="info-label">Voto ospiti</div>
          <div className="info-value">7,5 su 662 recensioni</div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <span className="eyebrow">La città intorno</span>
          <h2>Benvenuto a Napoli</h2>
          <p>
            Dalla tua finestra al mare: il golfo, Pompei e il castello più famoso
            della città, a pochi passi o a un breve viaggio in treno.
          </p>
        </div>
        <div className="postcard-grid">
          <figure className="postcard">
            <img src="/images/golfo-napoli.jpg" alt="Golfo di Napoli" />
            <figcaption className="postcard-caption">
              <span className="postcard-title">Golfo di Napoli</span>
              <span className="stamp">01</span>
            </figcaption>
            <span className="postcard-note" style={{ padding: '0 0.25rem 0.8rem', display: 'block' }}>
              La veduta che ti accompagna al mattino, con il Vesuvio all'orizzonte.
            </span>
          </figure>
          <figure className="postcard">
            <img src="/images/pompei.jpg" alt="Pompei" />
            <figcaption className="postcard-caption">
              <span className="postcard-title">Pompei</span>
              <span className="stamp">02</span>
            </figcaption>
            <span className="postcard-note" style={{ padding: '0 0.25rem 0.8rem', display: 'block' }}>
              A 25 minuti di treno, la città romana più visitata al mondo.
            </span>
          </figure>
          <figure className="postcard">
            <img src="/images/maschio-angioino.jpg" alt="Maschio Angioino" />
            <figcaption className="postcard-caption">
              <span className="postcard-title">Maschio Angioino</span>
              <span className="stamp">03</span>
            </figcaption>
            <span className="postcard-note" style={{ padding: '0 0.25rem 0.8rem', display: 'block' }}>
              Il castello aragonese che domina piazza Municipio.
            </span>
          </figure>
        </div>
      </section>

      <section className="section">
        <div className="section-head center">
          <span className="eyebrow">L'albergo</span>
          <h2>Le nostre camere</h2>
          <p>
            Dalla singola con bagno condiviso alla tripla con balcone. Ogni camera
            ha TV, scrivania e l'atmosfera del centro storico.
          </p>
        </div>
        <div className="room-grid">
          <article className="room-card">
            <img src="/images/rooms/singola-bagno-comune.jpg" alt="Singola bagno condiviso" />
            <div className="room-body">
              <h4 className="room-name">Singola · Bagno condiviso</h4>
              <p className="room-desc">TV, scrivania e armadio. Bagno condiviso al piano. 12 m².</p>
              <div className="room-meta">
                <span className="room-price">€45 <span className="per-night">/notte</span></span>
                <span className="room-guests">1 ospite</span>
              </div>
            </div>
          </article>
          <article className="room-card">
            <img src="/images/rooms/doppia-standard.jpg" alt="Doppia/Twin bagno condiviso" />
            <div className="room-body">
              <h4 className="room-name">Doppia · Bagno condiviso</h4>
              <p className="room-desc">Letto matrimoniale o due letti, balcone e scrivania. 15 m².</p>
              <div className="room-meta">
                <span className="room-price">€55 <span className="per-night">/notte</span></span>
                <span className="room-guests">2 ospiti</span>
              </div>
            </div>
          </article>
          <article className="room-card">
            <img src="/images/rooms/singola-bagno-privato.png" alt="Singola bagno privato" />
            <div className="room-body">
              <h4 className="room-name">Singola · Bagno privato</h4>
              <p className="room-desc">Aria condizionata, TV e bagno privato con bidet. 12 m².</p>
              <div className="room-meta">
                <span className="room-price">€60 <span className="per-night">/notte</span></span>
                <span className="room-guests">1 ospite</span>
              </div>
            </div>
          </article>
          <article className="room-card">
            <img src="/images/rooms/doppia-standard.jpg" alt="Doppia standard" />
            <div className="room-body">
              <h4 className="room-name">Doppia Standard</h4>
              <p className="room-desc">Bagno privato, TV e balcone affacciato sulla via. 15 m².</p>
              <div className="room-meta">
                <span className="room-price">€75 <span className="per-night">/notte</span></span>
                <span className="room-guests">2 ospiti</span>
              </div>
            </div>
          </article>
          <article className="room-card">
            <img src="/images/rooms/tripla-standard.jpg" alt="Tripla standard" />
            <div className="room-body">
              <h4 className="room-name">Tripla Standard</h4>
              <p className="room-desc">Perfetta per famiglie: matrimoniale più letto singolo. 18 m².</p>
              <div className="room-meta">
                <span className="room-price">€90 <span className="per-night">/notte</span></span>
                <span className="room-guests">3 ospiti</span>
              </div>
            </div>
          </article>
          <article className="room-card" style={{ borderColor: 'var(--gold)' }}>
            <div className="room-body" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
              <h4 className="room-name" style={{ fontSize: '1.3rem' }}>Il tuo soggiorno</h4>
              <p className="room-desc">
                Controlla le date e invia la richiesta: la reception conferma entro
                poche ore. Nessun addebito prima della conferma.
              </p>
              <Link to="/prenota" className="btn btn-gold" style={{ marginTop: '0.5rem' }}>
                Prenota ora
              </Link>
            </div>
          </article>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <span className="eyebrow">Servizi inclusi</span>
          <h2>Quello che trovi da noi</h2>
        </div>
        <div className="services-list">
          <div className="service-item">
            <span className="service-num">01</span>
            <div>
              <h4>Wi-Fi gratuito</h4>
              <p>Connessione in tutte le aree comuni</p>
            </div>
          </div>
          <div className="service-item">
            <span className="service-num">02</span>
            <div>
              <h4>Colazione in camera</h4>
              <p>Su richiesta, ogni mattina</p>
            </div>
          </div>
          <div className="service-item">
            <span className="service-num">03</span>
            <div>
              <h4>Deposito bagagli</h4>
              <p>Libero prima del check-in e dopo il check-out</p>
            </div>
          </div>
          <div className="service-item">
            <span className="service-num">04</span>
            <div>
              <h4>Pulizia giornaliera</h4>
              <p>Camere e cambio biancheria</p>
            </div>
          </div>
          <div className="service-item">
            <span className="service-num">05</span>
            <div>
              <h4>Aria condizionata</h4>
              <p>Nelle camere con bagno privato</p>
            </div>
          </div>
          <div className="service-item">
            <span className="service-num">06</span>
            <div>
              <h4>Check-in rapido</h4>
              <p>Express check-in dalle 13:00</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head center">
          <span className="eyebrow">Dove siamo</span>
          <h2>Via Milano 96, Napoli</h2>
          <p>
            Nel cuore del centro storico, a 300 metri dalla stazione Piazza Garibaldi
            e a pochi passi dalle strade più vive della città.
          </p>
        </div>
        <div className="map-frame">
          <iframe
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3019.5!2d14.268!3d40.852!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x133b085c7e7e7e7e%3A0x7e7e7e7e7e7e7e7e!2sVia+Milano%2C+96%2C+Napoli!5e0!3m2!1sit!2sit!4v1234567890"
            width="100%"
            height="420"
            style={{ border: 0 }}
            allowFullScreen=""
            loading="lazy"
            title="Posizione Hotel Vittorio Veneto"
          ></iframe>
        </div>
      </section>
    </>
  );

  return (
    <Router>
      <div className="app">
        <header className="header">
          <div className="brand">Hotel Vittorio Veneto <span className="brand-city">· Napoli</span></div>
          <nav>
            <Link to="/">Home</Link>
            <Link to="/prenota">Prenota</Link>
            {isAuthenticated ? (
              <>
                <Link to="/admin">Reception</Link>
                <button onClick={handleLogout} className="btn btn-subtle" style={{ color: 'white', borderColor: 'rgba(255,255,255,0.3)' }}>
                  Esci
                </button>
              </>
            ) : (
              <Link to="/login">Reception</Link>
            )}
          </nav>
        </header>

        <main className="main-content">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/prenota" element={
              <Elements stripe={stripePromise}>
                <BookingForm apiUrl={API_URL} />
              </Elements>
            } />
            <Route path="/login" element={
              isAuthenticated ? (
                <Navigate to="/admin" />
              ) : (
                <Login apiUrl={API_URL} onLogin={handleLogin} />
              )
            } />
            <Route path="/admin" element={
              isAuthenticated ? (
                <AdminPanel apiUrl={API_URL} />
              ) : (
                <Navigate to="/login" />
              )
            } />
          </Routes>
        </main>

        <footer className="footer">
          <div className="footer-brand">Hotel Vittorio Veneto</div>
          <p>Via Milano 96, 80142 Napoli · &copy; 2026 · Tutti i diritti riservati</p>
        </footer>
      </div>
    </Router>
  );
}

export default App;
