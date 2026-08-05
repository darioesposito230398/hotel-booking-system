import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const AdminPanel = ({ apiUrl }) => {
  const [bookings, setBookings] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paymentConfig, setPaymentConfig] = useState('charge_on_confirm');
  const [error, setError] = useState('');
  const [roomsDirty, setRoomsDirty] = useState({});
  const [showNewRoom, setShowNewRoom] = useState(false);
  const [newRoom, setNewRoom] = useState({ name: '', description: '', base_price: '', max_guests: 1, photo: '' });
  const [activeTab, setActiveTab] = useState('pending');
  const [search, setSearch] = useState('');

  const fetchBookings = useCallback(async () => {
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
  }, [apiUrl]);

  const fetchRooms = useCallback(async () => {
    try {
      const response = await axios.get(`${apiUrl}/room-types`);
      setRooms(response.data);
      setRoomsDirty({});
    } catch (err) {
      setError('Errore nel caricamento delle camere');
    }
  }, [apiUrl]);

  const fetchPaymentConfig = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${apiUrl}/payment-config`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPaymentConfig(response.data.payment_action || 'charge_on_confirm');
    } catch (err) {
      console.error('Error fetching payment config:', err);
    }
  }, [apiUrl]);

  useEffect(() => {
    fetchBookings();
    fetchRooms();
    fetchPaymentConfig();
  }, [fetchBookings, fetchRooms, fetchPaymentConfig]);

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

  const saveRoom = async (room) => {
    try {
      const token = localStorage.getItem('token');
      const payload = {
        name: room.name,
        description: room.description,
        base_price: parseFloat(room.base_price),
        max_guests: parseInt(room.max_guests, 10) || 1,
        photo: room.photo || null
      };
      if (room.id) {
        await axios.put(`${apiUrl}/room-types/${room.id}`, payload,
          { headers: { Authorization: `Bearer ${token}` } });
      }
      await fetchRooms();
      setError('');
    } catch (err) {
      setError('Errore nel salvataggio della camera');
    }
  };

  const addNewRoom = async () => {
    if (!newRoom.name || !newRoom.base_price) {
      setError('Inserisci nome e prezzo della nuova camera');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${apiUrl}/room-types`, {
        name: newRoom.name,
        description: newRoom.description,
        base_price: parseFloat(newRoom.base_price),
        max_guests: parseInt(newRoom.max_guests, 10) || 1,
        photo: newRoom.photo || null
      }, { headers: { Authorization: `Bearer ${token}` } });
      setShowNewRoom(false);
      setNewRoom({ name: '', description: '', base_price: '', max_guests: 1, photo: '' });
      await fetchRooms();
      setError('');
    } catch (err) {
      setError('Errore nella creazione della camera');
    }
  };

  const deleteRoom = async (id) => {
    if (window.confirm('Eliminare questa camera? ' +
      'Eventuali prenotazioni associate verranno mantenute ma senza tipologia.')) {
      try {
        const token = localStorage.getItem('token');
        await axios.delete(`${apiUrl}/room-types/${id}`,
          { headers: { Authorization: `Bearer ${token}` } });
        await fetchRooms();
      } catch (err) {
        setError('Errore nell\'eliminazione della camera');
      }
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

  const handleCancel = async (bookingId) => {
    if (window.confirm('Cancellare questa prenotazione confermata?')) {
      try {
        const token = localStorage.getItem('token');
        await axios.post(`${apiUrl}/booking-requests/${bookingId}/cancel`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        fetchBookings();
      } catch (err) {
        setError('Errore nella cancellazione della prenotazione');
      }
    }
  };

  const today = new Date().toISOString().split('T')[0];

  const bookingInTab = (b) => {
    switch (activeTab) {
      case 'pending':
        return b.status === 'pending';
      case 'upcoming':
        return b.status === 'confirmed' && b.check_in >= today;
      case 'current':
        return b.status === 'confirmed' && b.check_in <= today && b.check_out >= today;
      case 'past':
        return b.status === 'confirmed' && b.check_out < today;
      case 'cancelled':
        return b.status === 'rejected' || b.status === 'cancelled';
      default:
        return true;
    }
  };

  const countInTab = (tab) => {
    return bookings.filter(b => {
      switch (tab) {
        case 'pending':
          return b.status === 'pending';
        case 'upcoming':
          return b.status === 'confirmed' && b.check_in >= today;
        case 'current':
          return b.status === 'confirmed' && b.check_in <= today && b.check_out >= today;
        case 'past':
          return b.status === 'confirmed' && b.check_out < today;
        case 'cancelled':
          return b.status === 'rejected' || b.status === 'cancelled';
        default:
          return true;
      }
    }).length;
  };

  const visibleBookings = bookings.filter(b =>
    bookingInTab(b) &&
    (!search ||
      (b.guest_name && b.guest_name.toLowerCase().includes(search.toLowerCase())) ||
      (b.guest_email && b.guest_email.toLowerCase().includes(search.toLowerCase())))
  );

  const statusLabel = (status) => {
    switch (status) {
      case 'pending': return 'In attesa';
      case 'confirmed': return 'Confermata';
      case 'rejected': return 'Rifiutata';
      case 'cancelled': return 'Cancellata';
      default: return status;
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

  const setRoomField = (id, field, value) => {
    setRooms(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    setRoomsDirty(prev => ({ ...prev, [id]: true }));
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
        <button onClick={() => { fetchBookings(); fetchRooms(); }} className="btn btn-secondary">
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

      <div className="rooms-manager">
        <div className="rooms-manager-header">
          <h3>Gestione Camere e Prezzi</h3>
          <button onClick={() => setShowNewRoom(!showNewRoom)} className="btn btn-gold">
            {showNewRoom ? 'Annulla' : '+ Nuova camera'}
          </button>
        </div>

{showNewRoom && (
          <div className="room-edit new">
            <input
              type="text"
              placeholder="Nome camera (es. Quadrupla Standard)"
              value={newRoom.name}
              onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
            />
            <input
              type="number"
              placeholder="Prezzo notte €"
              value={newRoom.base_price}
              onChange={(e) => setNewRoom({ ...newRoom, base_price: e.target.value })}
            />
            <input
              type="number"
              min="1"
              placeholder="Ospiti max"
              value={newRoom.max_guests}
              onChange={(e) => setNewRoom({ ...newRoom, max_guests: e.target.value })}
            />
            <input
              type="text"
              placeholder="Immagine (es. doppia-standard.jpg)"
              value={newRoom.photo}
              onChange={(e) => setNewRoom({ ...newRoom, photo: e.target.value })}
            />
            <textarea
              placeholder="Descrizione"
              value={newRoom.description}
              onChange={(e) => setNewRoom({ ...newRoom, description: e.target.value })}
            />
            <button onClick={addNewRoom} className="btn btn-success">Crea</button>
          </div>
        )}

        <div className="rooms-table">
          {rooms.map(room => (
            <div key={room.id} className="room-edit">
              <div className="room-edit-grid">
                <input
                  type="text"
                  value={room.name}
                  onChange={(e) => setRoomField(room.id, 'name', e.target.value)}
                />
                <input
                  type="number"
                  step="1"
                  value={room.base_price}
                  onChange={(e) => setRoomField(room.id, 'base_price', e.target.value)}
                />
                <input
                  type="number"
                  min="1"
                  value={room.max_guests}
                  onChange={(e) => setRoomField(room.id, 'max_guests', e.target.value)}
                />
              </div>
              <input
                type="text"
                placeholder="Immagine (es. doppia-standard.jpg)"
                value={room.photo || ''}
                onChange={(e) => setRoomField(room.id, 'photo', e.target.value)}
              />
              <textarea
                rows="2"
                value={room.description}
                onChange={(e) => setRoomField(room.id, 'description', e.target.value)}
              />
              <div className="room-edit-actions">
                <span className="room-edit-price-label">€ (prezzo notte)</span>
                <button
                  onClick={() => saveRoom(room)}
                  className="btn btn-success"
                  disabled={!roomsDirty[room.id]}
                >
                  Salva
                </button>
                <button onClick={() => deleteRoom(room.id)} className="btn btn-danger">
                  Elimina
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="booking-area">
        <div className="booking-area-header">
          <h3>Prenotazioni</h3>
          <input
            type="search"
            className="booking-search"
            placeholder="Cerca per nome o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="booking-tabs">
          {[
            { id: 'pending', label: 'In attesa' },
            { id: 'upcoming', label: 'In arrivo' },
            { id: 'current', label: 'Ospiti attuali' },
            { id: 'past', label: 'Concluse' },
            { id: 'cancelled', label: 'Cancellate' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              className={`booking-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              <span className="booking-tab-count">{countInTab(tab.id)}</span>
            </button>
          ))}
        </div>

        <div className="booking-list">
          {visibleBookings.length === 0 ? (
            <p>Nessuna prenotazione in questa categoria.</p>
          ) : (
            visibleBookings.map(booking => (
              <div key={booking.id} className={`booking-card ${booking.status}`}>
                <div className="booking-card-header">
                  <div>
                    <h4>{booking.guest_name}</h4>
                    <span className="booking-guest-email">{booking.guest_email}</span>
                  </div>
                  <span className={`booking-status ${booking.status}`}>
                    {statusLabel(booking.status)}
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
                    <span className="detail-value">{booking.room_type_name || '—'}</span>
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
                      Accetta
                    </button>
                    <button
                      onClick={() => handleReject(booking.id)}
                      className="btn btn-danger"
                    >
                      Rifiuta
                    </button>
                  </div>
                )}

                {booking.status === 'confirmed' && (
                  <div className="booking-card-actions">
                    <button
                      onClick={() => handleCancel(booking.id)}
                      className="btn btn-danger"
                    >
                      Cancella prenotazione
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;