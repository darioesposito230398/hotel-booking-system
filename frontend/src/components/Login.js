import React, { useState } from 'react';
import axios from 'axios';
import { useLanguage } from '../i18n';

const Login = ({ apiUrl, onLogin }) => {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${apiUrl}/auth/login`, { email, password });
      onLogin(response.data.token, response.data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Errore durante l\'accesso');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-form">
      <h2>{t('login.title')}</h2>

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit} autoComplete="off">
        <div className="form-group" style={{ marginBottom: '1rem' }}>
          <label htmlFor="email">{t('label.email')}</label>
          <input
            type="email"
            id="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder=""
            autoComplete="off"
            required
            style={{ width: '100%', marginTop: '0.5rem' }}
          />
        </div>

        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
          <label htmlFor="password">{t('login.password')}</label>
          <input
            type="password"
            id="password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder=""
            autoComplete="new-password"
            required
            style={{ width: '100%', marginTop: '0.5rem' }}
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading}
          style={{ width: '100%' }}
        >
          {loading ? t('login.loading') : t('login.submit')}
        </button>
      </form>
    </div>
  );
};

export default Login;