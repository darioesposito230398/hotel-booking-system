import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import axios from 'axios';
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
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setIsAuthenticated(true);
      setUser(JSON.parse(localStorage.getItem('user')));
    }
  }, []);

  const handleLogin = (token, userData) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setIsAuthenticated(true);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setUser(null);
  };

  return (
    <Router>
      <div className="app">
        <header className="header">
          <h1>Hotel</h1>
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
                  <h1>Benvenuto Hotel</h1>
                  <p>Scopri il comfort e l'eleganza delle nostre camere. Prenota il tuo soggiorno con semplicità e sicurezza.</p>
                </section>
                <section className="booking-form">
                  <h2>Le Nostre Camere</h2>
                  <p>Offriamo diverse tipologie di camere per soddisfare ogni esigenza. Dalla camera singola alla suite panoramica, troverai sicuramente l'alternativa perfetta per il tuo soggiorno.</p>
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

        <footer style={{
          background: 'var(--primary-color)',
          color: 'white',
          padding: '1.5rem',
          textAlign: 'center',
          marginTop: 'auto'
        }}>
          <p>&copy; 2024 Hotel. Tutti i diritti riservati.</p>
        </footer>
      </div>
    </Router>
  );
}

export default App;
