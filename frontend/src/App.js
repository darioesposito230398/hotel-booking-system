import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import BookingForm from './components/BookingForm';
import AdminPanel from './components/AdminPanel';
import Login from './components/Login';
import { LanguageProvider, useLanguage } from './i18n';
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

  const { t, lang, setLang, roomName } = useLanguage();

  const HomePage = () => (
    <>
      <section className="hero">
        <div className="hero-text">
          <span className="eyebrow">{t('hero.eyebrow')}</span>
          <h1>{t('hero.title')}</h1>
          <p className="lede">{t('hero.lede')}</p>
          <p className="address-line">{t('hero.address')}</p>
        </div>
        <div className="hero-photo">
          <figure className="postcard">
            <img src="/images/golfo-napoli.jpg" alt="Golfo di Napoli" />
            <figcaption className="postcard-caption">
              <span>{t('hero.caption')}</span>
              <span className="stamp">NAPOLI</span>
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="info-strip">
        <div className="info-item">
          <div className="info-label">{t('pos.label')}</div>
          <div className="info-value">{t('pos.value')}</div>
        </div>
        <div className="info-item">
          <div className="info-label">{t('station.label')}</div>
          <div className="info-value">{t('station.value')}</div>
        </div>
        <div className="info-item">
          <div className="info-label">{t('rating.label')}</div>
          <div className="info-value">{t('rating.value')}</div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <span className="eyebrow">{t('city.eyebrow')}</span>
          <h2>{t('city.title')}</h2>
          <p>{t('city.p')}</p>
        </div>
        <div className="postcard-grid">
          <figure className="postcard">
            <img src="/images/golfo-napoli.jpg" alt="Golfo di Napoli" />
            <figcaption className="postcard-caption">
              <span className="postcard-title">{t('city.golfo.title')}</span>
              <span className="stamp">01</span>
            </figcaption>
            <span className="postcard-note" style={{ padding: '0 0.25rem 0.8rem', display: 'block' }}>
              {t('city.golfo.note')}
            </span>
          </figure>
          <figure className="postcard">
            <img src="/images/pompei.jpg" alt="Pompei" />
            <figcaption className="postcard-caption">
              <span className="postcard-title">{t('city.pompei.title')}</span>
              <span className="stamp">02</span>
            </figcaption>
            <span className="postcard-note" style={{ padding: '0 0.25rem 0.8rem', display: 'block' }}>
              {t('city.pompei.note')}
            </span>
          </figure>
          <figure className="postcard">
            <img src="/images/maschio-angioino.jpg" alt="Maschio Angioino" />
            <figcaption className="postcard-caption">
              <span className="postcard-title">{t('city.maschio.title')}</span>
              <span className="stamp">03</span>
            </figcaption>
            <span className="postcard-note" style={{ padding: '0 0.25rem 0.8rem', display: 'block' }}>
              {t('city.maschio.note')}
            </span>
          </figure>
        </div>
      </section>

      <section className="section">
        <div className="section-head center">
          <span className="eyebrow">{t('story.eyebrow')}</span>
          <h2>{t('story.title')}</h2>
          <p>{t('story.p')}</p>
        </div>
        <div className="story-facts">
          <div className="story-fact">
            <span className="story-fact-value">{t('story.period.value')}</span>
            <span className="story-fact-label">{t('story.period.label')}</span>
          </div>
          <div className="story-fact">
            <span className="story-fact-value">1900</span>
            <span className="story-fact-label">{t('story.building.value')}</span>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head center">
          <span className="eyebrow">{t('rooms.eyebrow')}</span>
          <h2>{t('rooms.title')}</h2>
          <p>{t('rooms.p')}</p>
        </div>
        <div className="room-grid">
          <article className="room-card">
            <img src="/images/rooms/singola-bagno-comune.jpg" alt="Singola bagno condiviso" />
            <div className="room-body">
              <h4 className="room-name">{roomName('Singola Bagno Condiviso')}</h4>
              <p className="room-desc">{t('desc.singola.shared')}</p>
              <div className="room-meta">
                <span className="room-price">€45 <span className="per-night">{t('rooms.perNight')}</span></span>
                <span className="room-guests">{t('rooms.guest.1')}</span>
              </div>
            </div>
          </article>
          <article className="room-card">
            <img src="/images/rooms/doppia-standard.jpg" alt="Doppia/Twin bagno condiviso" />
            <div className="room-body">
              <h4 className="room-name">{roomName('Doppia/Twin Bagno Condiviso')}</h4>
              <p className="room-desc">{t('desc.twinshared')}</p>
              <div className="room-meta">
                <span className="room-price">€55 <span className="per-night">{t('rooms.perNight')}</span></span>
                <span className="room-guests">{t('rooms.guest.2')}</span>
              </div>
            </div>
          </article>
          <article className="room-card">
            <img src="/images/rooms/singola-bagno-privato.png" alt="Singola bagno privato" />
            <div className="room-body">
              <h4 className="room-name">{roomName('Singola Bagno Privato')}</h4>
              <p className="room-desc">{t('desc.singola.priv')}</p>
              <div className="room-meta">
                <span className="room-price">€60 <span className="per-night">{t('rooms.perNight')}</span></span>
                <span className="room-guests">{t('rooms.guest.1')}</span>
              </div>
            </div>
          </article>
          <article className="room-card">
            <img src="/images/rooms/doppia-standard.jpg" alt="Doppia standard" />
            <div className="room-body">
              <h4 className="room-name">{roomName('Doppia Standard')}</h4>
              <p className="room-desc">{t('desc.doppia')}</p>
              <div className="room-meta">
                <span className="room-price">€75 <span className="per-night">{t('rooms.perNight')}</span></span>
                <span className="room-guests">{t('rooms.guest.2')}</span>
              </div>
            </div>
          </article>
          <article className="room-card">
            <img src="/images/rooms/tripla-standard.jpg" alt="Tripla standard" />
            <div className="room-body">
              <h4 className="room-name">{roomName('Tripla Standard')}</h4>
              <p className="room-desc">{t('desc.tripla')}</p>
              <div className="room-meta">
                <span className="room-price">€90 <span className="per-night">{t('rooms.perNight')}</span></span>
                <span className="room-guests">{t('rooms.guest.3')}</span>
              </div>
            </div>
          </article>
          <article className="room-card" style={{ borderColor: 'var(--gold)' }}>
            <div className="room-body" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
              <h4 className="room-name" style={{ fontSize: '1.3rem' }}>{t('rooms.booking.title')}</h4>
              <p className="room-desc">{t('rooms.booking.p')}</p>
              <Link to="/prenota" className="btn btn-gold" style={{ marginTop: '0.5rem' }}>
                {t('rooms.booking.cta')}
              </Link>
            </div>
          </article>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <span className="eyebrow">{t('services.eyebrow')}</span>
          <h2>{t('services.title')}</h2>
        </div>
        <div className="services-list">
          <div className="service-item">
            <span className="service-num">01</span>
            <div>
              <h4>{t('service.wifi.t')}</h4>
              <p>{t('service.wifi.d')}</p>
            </div>
          </div>
          <div className="service-item">
            <span className="service-num">02</span>
            <div>
              <h4>{t('service.breakfast.t')}</h4>
              <p>{t('service.breakfast.d')}</p>
            </div>
          </div>
          <div className="service-item">
            <span className="service-num">03</span>
            <div>
              <h4>{t('service.luggage.t')}</h4>
              <p>{t('service.luggage.d')}</p>
            </div>
          </div>
          <div className="service-item">
            <span className="service-num">04</span>
            <div>
              <h4>{t('service.cleaning.t')}</h4>
              <p>{t('service.cleaning.d')}</p>
            </div>
          </div>
          <div className="service-item">
            <span className="service-num">05</span>
            <div>
              <h4>{t('service.ac.t')}</h4>
              <p>{t('service.ac.d')}</p>
            </div>
          </div>
          <div className="service-item">
            <span className="service-num">06</span>
            <div>
              <h4>{t('service.checkin.t')}</h4>
              <p>{t('service.checkin.d')}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head center">
          <span className="eyebrow">{t('map.eyebrow')}</span>
          <h2>{t('map.title')}</h2>
          <p>{t('map.p')}</p>
        </div>
        <div className="map-frame">
          <iframe
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3019.5!2d14.268!3d40.852!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x133b085c7e7e7e7e%3A0x7e7e7e7e7e7e7e7e!2sVia+Milano%2C+96%2C+Napoli!5e0!3m2!1sit!2sit!4v1234567890"
            width="100%"
            height="420"
            style={{ border: 0 }}
            allowFullScreen=""
            loading="lazy"
            title={t('map.titleAttr')}
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
            <Link to="/">{t('nav.home')}</Link>
            <Link to="/prenota">{t('nav.book')}</Link>
            {isAuthenticated ? (
              <>
                <Link to="/admin">{t('nav.reception')}</Link>
                <button onClick={handleLogout} className="btn btn-subtle" style={{ color: 'white', borderColor: 'rgba(255,255,255,0.3)' }}>
                  {t('nav.logout')}
                </button>
              </>
            ) : (
              <Link to="/login">{t('nav.reception')}</Link>
            )}
            <span className="lang-switch" role="group" aria-label="Language">
              <button
                type="button"
                className={lang === 'it' ? 'lang-btn active' : 'lang-btn'}
                onClick={() => setLang('it')}
              >
                IT
              </button>
              <button
                type="button"
                className={lang === 'en' ? 'lang-btn active' : 'lang-btn'}
                onClick={() => setLang('en')}
              >
                EN
              </button>
            </span>
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
          <p>{t('footer.addr')} · &copy; 2026 · {t('footer.rights')}</p>
        </footer>
      </div>
    </Router>
  );
}

const AppWithLanguage = () => (
  <LanguageProvider>
    <App />
  </LanguageProvider>
);

export default AppWithLanguage;
