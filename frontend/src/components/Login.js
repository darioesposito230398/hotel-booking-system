import React, { useState } from 'react';
import axios from 'axios';

const Login = ({ apiUrl, onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const endpoint = isRegister ? '/auth/register' : '/auth/login';
      const response = await axios.post(`${apiUrl}${endpoint}`, { email, password });
      
      if (isRegister) {
        // After registration, automatically login
        const loginResponse = await axios.post(`${apiUrl}/auth/login`, { email, password });
        onLogin(loginResponse.data.token, loginResponse.data.user);
      } else {
        onLogin(response.data.token, response.data.user);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Errore durante l\'accesso');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-form">
      <h2>{isRegister ? 'Registrazione Reception' : 'Accesso Reception'}</h2>
      
      {error && <div className="error-message">{error}</div>}
      
      <form onSubmit={handleSubmit}>
        <div className="form-group" style={{ marginBottom: '1rem' }}>
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="reception@hotel.com"
            required
            style={{ width: '100%', marginTop: '0.5rem' }}
          />
        </div>

        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            style={{ width: '100%', marginTop: '0.5rem' }}
          />
        </div>

        <button 
          type="submit" 
          className="btn btn-primary"
          disabled={loading}
          style={{ width: '100%', marginBottom: '1rem' }}
        >
          {loading ? 'Accesso in corso...' : (isRegister ? 'Registrati' : 'Accedi')}
        </button>

        <button 
          type="button"
          onClick={() => setIsRegister(!isRegister)}
          className="btn btn-secondary"
          style={{ width: '100%' }}
        >
          {isRegister ? 'Hai già un account? Accedi' : 'Non hai un account? Registrati'}
        </button>
      </form>
    </div>
  );
};

export default Login;
