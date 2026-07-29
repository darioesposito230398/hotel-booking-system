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

  return (
    <Router>
      <div className="app">
        <header className="header">
          <h1>Hotel Vittorio Veneto</h1>
          <nav>
            <Link to="/">Home</Link>
            <Link to="/prenota">Prenota</Link>
            {isAuthenticated ? (
              <>
                <Link to="/admin">Pannello Reception</Link>
                <button onClick={handleLogout} className="btn btn-secondary">
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
          <Route path="/" element={
            <>
              <section className="hero">
                <h1>Hotel Vittorio Veneto</h1>
                <p>Nel cuore di Napoli, a soli 300m da Piazza Garibaldi. La tua casa nel capoluogo campano.</p>
                <p className="subtitle">Via Milano, 96 - Centro Storico di Napoli</p>
              </section>

              <section style={{ background: 'white', padding: '3rem 2rem', borderRadius: '12px', marginBottom: '2rem', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
                <h2 style={{ textAlign: 'center', color: 'var(--primary-color)', marginBottom: '2rem' }}>Benvenuto a Napoli</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', maxWidth: '1000px', margin: '0 auto' }}>
                  <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', height: '250px' }}>
                    <img src="/images/golfo-napoli.jpg" alt="Golfo di Napoli" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.7))', padding: '1.5rem', color: 'white' }}>
                      <h4 style={{ margin: 0 }}>Golfo di Napoli</h4>
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', opacity: 0.9 }}>Vista panoramica sul golfo</p>
                    </div>
                  </div>
                  <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', height: '250px' }}>
                    <img src="/images/pompei.jpg" alt="Pompei" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.7))', padding: '1.5rem', color: 'white' }}>
                      <h4 style={{ margin: 0 }}>Pompei</h4>
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', opacity: 0.9 }}>A 25 minuti di treno</p>
                    </div>
                  </div>
                  <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', height: '250px' }}>
                    <img src="/images/maschio-angioino.jpg" alt="Maschio Angioino" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.7))', padding: '1.5rem', color: 'white' }}>
                      <h4 style={{ margin: 0 }}>Maschio Angioino</h4>
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', opacity: 0.9 }}>Il castello aragonese di Napoli</p>
                    </div>
                  </div>
                </div>
              </section>

              <section style={{ background: 'white', padding: '3rem 2rem', borderRadius: '12px', marginBottom: '2rem', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
                <h2 style={{ textAlign: 'center', color: 'var(--primary-color)', marginBottom: '2rem' }}>L'Hotel</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', maxWidth: '1000px', margin: '0 auto' }}>
                  <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', height: '250px' }}>
                    <img src="/images/rooms/doppia-standard.jpg" alt="Camera Doppia" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.7))', padding: '1.5rem', color: 'white' }}>
                      <h4 style={{ margin: 0 }}>Camere Confortevoli</h4>
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', opacity: 0.9 }}>TV, aria condizionata, balcone</p>
                    </div>
                  </div>
                  <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', height: '250px' }}>
                    <img src="/images/rooms/singola-bagno-privato.png" alt="Camera Singola" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.7))', padding: '1.5rem', color: 'white' }}>
                      <h4 style={{ margin: 0 }}>Bagno Privato</h4>
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', opacity: 0.9 }}>Bagni privati con doccia</p>
                    </div>
                  </div>
                  <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', height: '250px' }}>
                    <img src="/images/rooms/tripla-standard.jpg" alt="Camera Tripla" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.7))', padding: '1.5rem', color: 'white' }}>
                      <h4 style={{ margin: 0 }}>Per Famiglie</h4>
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', opacity: 0.9 }}>Camere triple per 3 ospiti</p>
                    </div>
                  </div>
                </div>
              </section>

              <section style={{ background: 'white', padding: '3rem 2rem', borderRadius: '12px', marginBottom: '2rem', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
                <h2 style={{ textAlign: 'center', color: 'var(--primary-color)', marginBottom: '2rem' }}>I Nostri Servizi</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', maxWidth: '800px', margin: '0 auto' }}>
                  <div style={{ textAlign: 'center', padding: '1rem' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📶</div>
                    <h4>Wi-Fi Gratuito</h4>
                    <p style={{ color: 'var(--text-light)' }}>Connessione Wi-Fi gratuita in tutte le aree comuni</p>
                  </div>
                  <div style={{ textAlign: 'center', padding: '1rem' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🅿️</div>
                    <h4>Parcheggio</h4>
                    <p style={{ color: 'var(--text-light)' }}>Parcheggio privato nelle vicinanze</p>
                  </div>
                  <div style={{ textAlign: 'center', padding: '1rem' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>☕</div>
                    <h4>Colazione</h4>
                    <p style={{ color: 'var(--text-light)' }}>Colazione in camera disponibile</p>
                  </div>
                  <div style={{ textAlign: 'center', padding: '1rem' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>❄️</div>
                    <h4>Aria Condizionata</h4>
                    <p style={{ color: 'var(--text-light)' }}>Climatizzazione in tutte le camere</p>
                  </div>
                  <div style={{ textAlign: 'center', padding: '1rem' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🧳</div>
                    <h4>Deposito Bagagli</h4>
                    <p style={{ color: 'var(--text-light)' }}>Servizio deposito bagagli gratuito</p>
                  </div>
                  <div style={{ textAlign: 'center', padding: '1rem' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🧹</div>
                    <h4>Pulizia Giornaliera</h4>
                    <p style={{ color: 'var(--text-light)' }}>Servizio di pulizia e cambio biancheria</p>
                  </div>
                </div>
              </section>

              <section style={{ background: 'white', padding: '3rem 2rem', borderRadius: '12px', marginBottom: '2rem', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
                <h2 style={{ textAlign: 'center', color: 'var(--primary-color)', marginBottom: '1rem' }}>Dove Siamo</h2>
                <p style={{ textAlign: 'center', color: 'var(--text-light)', marginBottom: '1.5rem' }}>Via Milano, 96 - Napoli (Centro Storico) - A 300m da Piazza Garibaldi</p>
                <div style={{ maxWidth: '800px', margin: '0 auto', borderRadius: '8px', overflow: 'hidden' }}>
                  <iframe 
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3019.5!2d14.268!3d40.852!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x133b085c7e7e7e7e%3A0x7e7e7e7e7e7e7e7e!2sVia+Milano%2C+96%2C+Napoli!5e0!3m2!1sit!2sit!4v1234567890"
                    width="100%" 
                    height="400" 
                    style={{ border: 0 }} 
                    allowFullScreen="" 
                    loading="lazy"
                    title="Posizione Hotel Vittorio Veneto"
                  ></iframe>
                </div>
              </section>

              <section className="booking-form">
                <h2>Prenota la Tua Camera</h2>
                <p>Scegli la tipologia di camera che preferisci e compila il modulo per inviare la tua richiesta di prenotazione.</p>
              </section>
            </>
          } />
            
            <Route path="/prenota" element={
              <Elements stripe={stripePromise}>
                <BookingForm apiUrl={API_URL} />
              </Elements>
            } />
            
            <Route path="/login" element={
              isAuthenticated ? (
                <Navigate to="/admin" />
              ) : (
                <Login apiUrl={API_URL} onLogin={(token) => handleLogin(token)} />
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

        <footer style={{
          background: 'var(--primary-color)',
          color: 'white',
          padding: '1.5rem',
          textAlign: 'center',
          marginTop: 'auto'
        }}>
          <p>&copy; 2026 Hotel Vittorio Veneto Napoli. Tutti i diritti riservati.</p>
        </footer>
      </div>
    </Router>
  );
}

export default App;
