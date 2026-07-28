import React, { useState, useEffect } from 'react';
import axios from 'axios';

const AdminPanel = ({ apiUrl }) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paymentConfig, setPaymentConfig] = useState('charge_on_confirm');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchBookings();
    fetchPaymentConfig();
  }, []);

  const fetchBookings = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${apiUrl}/booking-requests`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBookings(response.data);
      setLoading(false);
    } catch (err) {
      setError('Errore nel caricamento delle prenotazioni');
      setLoading(false);
    }
  };

  const fetchPaymentConfig = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${apiUrl}/payment-config`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPaymentConfig(response.data.payment_action || 'charge_on_confirm');
    } catch (err) {
      console.error('Error fetching payment config:', err);
    }
  };

  const updatePaymentConfig = async (newConfig) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${apiUrl}/payment-config`, 
        { payment_action: newConfig },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPaymentConfig(newConfig);
    } catch (err) {
      setError('Errore nell\'aggiornamento della configurazione');
    }
  };

  const handleConfirm = async (bookingId) => {
    if (window.confirm('Confermare questa prenotazione? Verrà effettuato il pagamento secondo la configurazione attuale.')) {
      try {
        const token = localStorage.getItem('token');
        await axios.post(`${apiUrl}/booking-requests/${bookingId}/confirm`, 
          { payment_action: paymentConfig },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        fetchBookings();
      } catch (err) {
        setError('Errore nella conferma della prenotazione');
      }
    }
  };

  const handleReject = async (bookingId) => {
    if (window.confirm('Rifiutare questa prenotazione?')) {
      try {
        const token = localStorage.getItem('token');
        await axios.post(`${apiUrl}/booking-requests/${bookingId}/reject`, 
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        fetchBookings();
      } catch (err) {
        setError('Errore nel rifiuto della prenotazione');
      }
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString('it-IT', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h2>Pannello Reception</h2>
        <button onClick={fetchBookings} className="btn btn-secondary">
          Aggiorna
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="payment-config">
        <h3>Configurazione Pagamento</h3>
        <p>Seleziona cosa fare quando confermi una prenotazione:</p>
        <div className="config-option">
          <input
            type="radio"
            id="charge"
            name="paymentAction"
            value="charge_on_confirm"
            checked={paymentConfig === 'charge_on_confirm'}
            onChange={(e) => updatePaymentConfig(e.target.value)}
          />
          <label htmlFor="charge">Addebita subito l'importo</label>
        </div>
        <div className="config-option">
          <input
            type="radio"
            id="authorize"
            name="paymentAction"
            value="authorize_only"
            checked={paymentConfig === 'authorize_only'}
            onChange={(e) => updatePaymentConfig(e.target.value)}
          />
          <label htmlFor="authorize">Solo pre-autorizzazione (addebito al check-in)</label>
        </div>
        <div className="config-option">
          <input
            type="radio"
            id="none"
            name="paymentAction"
            value="no_payment"
            checked={paymentConfig === 'no_payment'}
            onChange={(e) => updatePaymentConfig(e.target.value)}
          />
          <label htmlFor="none">Nessuna azione di pagamento</label>
        </div>
      </div>

      <div className="booking-list">
        {bookings.length === 0 ? (
          <p>Nessuna richiesta di prenotazione trovata.</p>
        ) : (
          bookings.map(booking => (
            <div key={booking.id} className={`booking-card ${booking.status}`}>
              <div className="booking-card-header">
                <h3>{booking.guest_name}</h3>
                <span className={`booking-status ${booking.status}`}>
                  {booking.status === 'pending' ? 'In Attesa di Conferma' :
                   booking.status === 'confirmed' ? 'Confermata' : 'Rifiutata'}
                </span>
              </div>

              <div className="booking-card-details">
                <div className="detail-item">
                  <span className="detail-label">Check-in</span>
                  <span className="detail-value">{formatDate(booking.check_in)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Check-out</span>
                  <span className="detail-value">{formatDate(booking.check_out)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Camera</span>
                  <span className="detail-value">{booking.room_type_name}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Ospiti</span>
                  <span className="detail-value">{booking.num_guests}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Prezzo Totale</span>
                  <span className="detail-value">€{booking.total_price}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Data Richiesta</span>
                  <span className="detail-value">{formatDateTime(booking.created_at)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Email</span>
                  <span className="detail-value">{booking.guest_email}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Telefono</span>
                  <span className="detail-value">{booking.guest_phone || 'Non fornito'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Stato Pagamento</span>
                  <span className="detail-value">
                    {booking.payment_status === 'tokenized' ? 'Dati carta salvati (tokenizzati)' :
                     booking.payment_status === 'charged' ? 'Addebitato' :
                     booking.payment_status === 'authorized' ? 'Pre-autorizzato' : booking.payment_status}
                  </span>
                </div>
              </div>

              {booking.notes && (
                <div className="detail-item" style={{ marginBottom: '1rem' }}>
                  <span className="detail-label">Note del cliente</span>
                  <span className="detail-value">{booking.notes}</span>
                </div>
              )}

              {booking.status === 'pending' && (
                <div className="booking-card-actions">
                  <button 
                    onClick={() => handleConfirm(booking.id)}
                    className="btn btn-success"
                  >
                    Conferma
                  </button>
                  <button 
                    onClick={() => handleReject(booking.id)}
                    className="btn btn-danger"
                  >
                    Rifiuta
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
