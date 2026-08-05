import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const AdminPanel = ({ apiUrl }) => {
  const [bookings, setBookings] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bonificoIban, setBonificoIban] = useState('');
  const [bonificoIntestatario, setBonificoIntestatario] = useState('Hotel Vittorio Veneto');
  const [error, setError] = useState('');
  const [roomsDirty, setRoomsDirty] = useState({});
  const [showNewRoom, setShowNewRoom] = useState(false);
  const [newRoom, setNewRoom] = useState({ name: '', description: '', max_guests: 1, photo: '' });
  const [activeTab, setActiveTab] = useState('pending');
  const [docToView, setDocToView] = useState(null);
  const [section, setSection] = useState('bookings');
  const [search, setSearch] = useState('');
  const [priceRoomId, setPriceRoomId] = useState('');
  const [priceMonth, setPriceMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [priceGrid, setPriceGrid] = useState({});
  const [bulkFrom, setBulkFrom] = useState('');
  const [bulkTo, setBulkTo] = useState('');
  const [bulkPrice, setBulkPrice] = useState('');

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
      setBonificoIban(response.data.bonifico_iban || '');
      setBonificoIntestatario(response.data.bonifico_intestatario || 'Hotel Vittorio Veneto');
    } catch (err) {
      console.error('Error fetching payment config:', err);
    }
  }, [apiUrl]);

  useEffect(() => {
    fetchBookings();
    fetchRooms();
    fetchPaymentConfig();
  }, [fetchBookings, fetchRooms, fetchPaymentConfig]);

  // Load daily price overrides for the selected room+month
  useEffect(() => {
    const loadPrices = async () => {
      if (!priceRoomId || !priceMonth) return;
      const [year, month] = priceMonth.split('-').map(Number);
      const lastDay = new Date(year, month, 0).getDate();
      const from = `${priceMonth}-01`;
      const to = `${priceMonth}-${String(lastDay).padStart(2, '0')}`;
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${apiUrl}/room-types/${priceRoomId}/prices`, {
          params: { from, to },
          headers: { Authorization: `Bearer ${token}` }
        });
        const overrides = {};
        res.data.forEach(r => { overrides[r.date.slice(0, 10)] = parseFloat(r.price); });

        const room = rooms.find(r => r.id === parseInt(priceRoomId, 10));
        const base = room ? parseFloat(room.base_price) : 0;
        const grid = {};
        for (let d = 1; d <= lastDay; d++) {
          const key = `${priceMonth}-${String(d).padStart(2, '0')}`;
          grid[key] = overrides[key] !== undefined ? overrides[key] : base;
        }
        setPriceGrid(grid);
      } catch (err) {
        console.error('Error loading price overrides:', err);
      }
    };
    loadPrices();
  }, [priceRoomId, priceMonth, rooms, apiUrl]);

  const saveDayPrice = async (date) => {
    const room = rooms.find(r => r.id === parseInt(priceRoomId, 10));
    const base = room ? parseFloat(room.base_price) : 0;
    const current = priceGrid[date];
    const val = (current === undefined || current === '' || current === null) ? null : parseFloat(current);
    const payload = {};
    payload[date] = (val !== null && val !== base) ? val : null;
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${apiUrl}/room-types/${priceRoomId}/prices`, { prices: payload },
        { headers: { Authorization: `Bearer ${token}` } });
      setPriceGrid(prev => ({ ...prev, [date]: (val !== null && val !== base) ? val : base }));
    } catch (err) {
      setError('Errore nel salvataggio della tariffa del giorno');
    }
  };

  const fmtKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const applyRange = async (clear) => {
    if (!bulkFrom || !bulkTo) return;
    const payload = {};
    const d = new Date(bulkFrom + 'T12:00:00');
    const end = new Date(bulkTo + 'T12:00:00');
    while (d <= end) {
      payload[fmtKey(d)] = clear ? null : (parseFloat(bulkPrice) || null);
      d.setDate(d.getDate() + 1);
    }
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${apiUrl}/room-types/${priceRoomId}/prices`, { prices: payload },
        { headers: { Authorization: `Bearer ${token}` } });
      // refresh grid for current month
      const [year, month] = priceMonth.split('-').map(Number);
      const lastDay = new Date(year, month, 0).getDate();
      const overrides = {};
      const res = await axios.get(`${apiUrl}/room-types/${priceRoomId}/prices`, {
        params: { from: `${priceMonth}-01`, to: `${priceMonth}-${String(lastDay).padStart(2, '0')}` },
        headers: { Authorization: `Bearer ${token}` }
      });
      res.data.forEach(r => { overrides[r.date.slice(0, 10)] = parseFloat(r.price); });
      const room = rooms.find(r => r.id === parseInt(priceRoomId, 10));
      const base = room ? parseFloat(room.base_price) : 0;
      const grid = {};
      for (let d = 1; d <= lastDay; d++) {
        const key = `${priceMonth}-${String(d).padStart(2, '0')}`;
        grid[key] = overrides[key] !== undefined ? overrides[key] : base;
      }
      setPriceGrid(grid);
      setError('');
    } catch (err) {
      setError('Errore nell\'applicazione delle tariffe');
    }
  };

  const saveAll = async () => {
    const room = rooms.find(r => r.id === parseInt(priceRoomId, 10));
    const base = room ? parseFloat(room.base_price) : 0;
    const payload = {};
    Object.entries(priceGrid).forEach(([date, val]) => {
      const n = (val === '' || val === null || val === undefined) ? null : parseFloat(val);
      payload[date] = (n !== null && n !== base) ? n : null;
    });
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${apiUrl}/room-types/${priceRoomId}/prices`, { prices: payload },
        { headers: { Authorization: `Bearer ${token}` } });
      // ricarica il mese così la pagina mostra i prezzi aggiornati
      const [year, month] = priceMonth.split('-').map(Number);
      const lastDay = new Date(year, month, 0).getDate();
      const res = await axios.get(`${apiUrl}/room-types/${priceRoomId}/prices`,
        { params: { from: `${priceMonth}-01`, to: `${priceMonth}-${String(lastDay).padStart(2, '0')}` },
          headers: { Authorization: `Bearer ${token}` } });
      const overrides = {};
      res.data.forEach(r => { overrides[r.date.slice(0, 10)] = parseFloat(r.price); });
      const grid = {};
      for (let d = 1; d <= lastDay; d++) {
        const key = `${priceMonth}-${String(d).padStart(2, '0')}`;
        grid[key] = overrides[key] !== undefined ? overrides[key] : base;
      }
      setPriceGrid(grid);
      setError('');
      alert('Prezzi salvati e aggiornati');
    } catch (err) {
      setError('Errore nel salvataggio delle tariffe');
    }
  };

  const saveBonifico = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${apiUrl}/payment-config`,
        { bonifico_iban: bonificoIban, bonifico_intestatario: bonificoIntestatario },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setError('');
      alert('Dati bonifico salvati');
    } catch (err) {
      setError('Errore nel salvataggio dei dati bonifico');
    }
  };

  const saveRoom = async (room) => {
    try {
      const token = localStorage.getItem('token');
      const payload = {
        name: room.name,
        description: room.description,
        base_price: parseFloat(room.base_price) || 0,
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
        base_price: 0,
        max_guests: parseInt(newRoom.max_guests, 10) || 1,
        photo: newRoom.photo || null
      }, { headers: { Authorization: `Bearer ${token}` } });
      setShowNewRoom(false);
      setNewRoom({ name: '', description: '', max_guests: 1, photo: '' });
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

  const handlePreConfirm = async (bookingId) => {
    if (!window.confirm('Inviare al cliente la mail con IBAN e lasciare la prenotazione in attesa del bonifico?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${apiUrl}/booking-requests/${bookingId}/confirm`,
        { step: 'preconfirm' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchBookings();
    } catch (err) {
      setError(err.response?.data?.error || 'Errore nella pre-conferma');
    }
  };

  const handleConfirm = async (bookingId) => {
    const booking = bookings.find(b => b.id === bookingId);
    const isBonifico = booking?.payment_method === 'bonifico';
    const isPreconfirmed = booking?.status === 'preconfirmed';
    const msg = isBonifico
      ? (isPreconfirmed
        ? 'Hai verificato che il bonifico è arrivato? Confermerai la prenotazione e invierai la mail di conferma.'
        : 'Per il bonifico: prima invia l\'IBAN al cliente (pre-conferma).')
      : 'Vuoi confermare? Verrà addebitata la prima notte e inviata la mail di conferma.';
    if (window.confirm(msg)) {
      try {
        const token = localStorage.getItem('token');
        await axios.post(`${apiUrl}/booking-requests/${bookingId}/confirm`,
          { step: isBonifico ? 'final' : undefined },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        fetchBookings();
      } catch (err) {
        setError(err.response?.data?.error || 'Errore nella conferma della prenotazione');
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
        return b.status === 'pending' || b.status === 'preconfirmed';
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
          return b.status === 'pending' || b.status === 'preconfirmed';
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
      case 'preconfirmed': return 'In attesa bonifico';
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
      {docToView && (
        <div className="doc-modal-backdrop" onClick={() => setDocToView(null)}>
          <div className="doc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="doc-modal-header">
              <strong>Documento d'identità</strong>
              <button type="button" onClick={() => setDocToView(null)} className="btn btn-subtle">Chiudi</button>
            </div>
            <div className="doc-modal-body">
              {docToView.startsWith('data:image') ? (
                <img src={docToView} alt="Documento d'identità" style={{ maxWidth: '100%', maxHeight: '75vh', borderRadius: '6px' }} />
              ) : docToView.startsWith('data:application/pdf') ? (
                <iframe src={docToView} title="Documento d'identità" style={{ width: '100%', height: '75vh', border: 'none' }} />
              ) : (
                <a href={docToView} download>Scarica il documento</a>
              )}
            </div>
          </div>
        </div>
      )}
      <div className="admin-header">
        <h2>Pannello Reception</h2>
        <button onClick={() => { fetchBookings(); fetchRooms(); }} className="btn btn-secondary">
          Aggiorna
        </button>
      </div>

      <nav className="admin-nav">
        <button
          type="button"
          className={`admin-nav-btn ${section === 'bookings' ? 'active' : ''}`}
          onClick={() => setSection('bookings')}
        >
          Prenotazioni
        </button>
        <button
          type="button"
          className={`admin-nav-btn ${section === 'rooms' ? 'active' : ''}`}
          onClick={() => setSection('rooms')}
        >
          Gestione Camere
        </button>
        <button
          type="button"
          className={`admin-nav-btn ${section === 'info' ? 'active' : ''}`}
          onClick={() => setSection('info')}
        >
          Info & Bonifico
        </button>
      </nav>

      {error && <div className="error-message">{error}</div>}

      {section === 'info' && (
      <>
      <div className="bonifico-config">
        <h3>Info Hotel</h3>
        <p><strong>Indirizzo:</strong> Via Milano, 96 · Napoli</p>
        <p><strong>Email:</strong> info@hotelvittorioveneto.com</p>
        <p><strong>Check-in:</strong> dalle 14:00 · <strong>Check-out:</strong> entro le 11:00</p>
        <p style={{ marginTop: '0.5rem' }}>Dopo le 19:00 scrivono a info@hotel... per il check-in a distanza.</p>
      </div>

      <div className="bonifico-config">
        <h3>Bonifico istantaneo (per clienti che pagano con bonifico)</h3>
        <div className="form-group">
          <label>Intestatario</label>
          <input
            type="text"
            value={bonificoIntestatario}
            onChange={(e) => setBonificoIntestatario(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>IBAN</label>
          <input
            type="text"
            value={bonificoIban}
            onChange={(e) => setBonificoIban(e.target.value)}
            placeholder="IT00 X000 0000 0000 0000 0000 000"
          />
        </div>
        <button onClick={saveBonifico} className="btn btn-primary">Salva dati bonifico</button>
      </div>
      </>
      )}

      {section === 'rooms' && (
      <div className="rooms-manager">
        <div className="rooms-manager-header">
          <h3>Gestione Camere</h3>
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
                <span className="room-edit-price-label">Le tariffe si impostano nel calendario qui sotto</span>
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
      )}

      {section === 'rooms' && (
      <div className="pricing-manager">
        <div className="pricing-header">
          <h3>Tariffe giornaliere</h3>
          <p>Imposta il prezzo per singolo giorno o per un periodo. I prezzi inseriti equivalgono alle tariffe di Booking: al cliente viene applicato automaticamente lo sconto del 10%.</p>
        </div>

        <div className="pricing-controls">
          <label>
            Camera
            <select value={priceRoomId} onChange={(e) => setPriceRoomId(e.target.value)}>
              <option value="">— Seleziona camera —</option>
              {rooms.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Mese
            <input type="month" value={priceMonth} onChange={(e) => setPriceMonth(e.target.value)} />
          </label>
        </div>

        <div className="pricing-range">
          <input type="date" value={bulkFrom} onChange={(e) => setBulkFrom(e.target.value)} title="Da" />
          <span>→</span>
          <input type="date" value={bulkTo} onChange={(e) => setBulkTo(e.target.value)} title="A" />
          <input
            type="number"
            step="1"
            placeholder="€ prezzo"
            value={bulkPrice}
            onChange={(e) => setBulkPrice(e.target.value)}
          />
          <button onClick={() => applyRange(false)} className="btn btn-success">Applica al periodo</button>
          <button onClick={() => applyRange(true)} className="btn btn-secondary">Ripristina prezzo base</button>
        </div>

        <button onClick={saveAll} className="btn btn-primary pricing-save">
          Salva e aggiorna prezzi
        </button>

        <div className="pricing-calendar">
          {Object.keys(priceGrid).map(date => (
            <div
              key={date}
              className={date < new Date().toISOString().slice(0, 10) ? 'pricing-day past' : 'pricing-day'}
            >
              <span className="pricing-day-label">{new Date(date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</span>
              <input
                type="number"
                step="1"
                value={priceGrid[date]}
                onChange={(e) => setPriceGrid(prev => ({ ...prev, [date]: e.target.value }))}
                onBlur={() => saveDayPrice(date)}
              />
            </div>
          ))}
        </div>
      </div>
      )}

      {section === 'bookings' && (
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
                    <span className="detail-label">Prima notte (prepagata)</span>
                    <span className="detail-value">
                      {booking.first_night_amount ? `€${booking.first_night_amount}` : '—'}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Saldo in struttura</span>
                    <span className="detail-value">
                      {booking.first_night_amount
                        ? `€${(parseFloat(booking.total_price) - parseFloat(booking.first_night_amount)).toFixed(2)}`
                        : '—'}
                    </span>
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
                    <span className="detail-label">Metodo Pagamento</span>
                    <span className="detail-value">
                      {booking.payment_method === 'bonifico' ? 'Bonifico istantaneo' : 'PayPal'}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Stato Pagamento</span>
                    <span className="detail-value">
                      {booking.payment_method === 'bonifico'
                        ? (booking.status === 'confirmed' ? 'Pagato — bonifico verificato' : 'Da verificare (pagamento manuale)') :
                       booking.payment_status === 'authorized' ? 'Trattenuto — da addebitare alla conferma' :
                       booking.payment_status === 'captured' ? 'Pagato — acconto addebitato con PayPal' :
                       booking.payment_status === 'voided' ? 'Rilasciato (nessun addebito)' :
                       booking.payment_status === 'refund_pending' ? 'Pagato — rimborso da fare a mano' :
                       booking.payment_status}
                    </span>
                  </div>
                </div>

                {booking.id_document && (
                  <div className="detail-item" style={{ marginTop: '0.75rem' }}>
                    <span className="detail-label">Documento d'identità</span>
                    <button
                      type="button"
                      onClick={() => setDocToView(booking.id_document)}
                      className="btn btn-subtle"
                    >
                      Visualizza documento
                    </button>
                    {booking.id_document.startsWith('data:image') && (
                      <div style={{ marginTop: '0.5rem' }}>
                        <img
                          src={booking.id_document}
                          alt="Documento d'identità"
                          style={{ width: '100%', maxWidth: '260px', borderRadius: '6px', border: '1px solid #eee', cursor: 'pointer' }}
                          onClick={() => setDocToView(booking.id_document)}
                        />
                      </div>
                    )}
                  </div>
                )}

                {booking.notes && (
                  <div className="detail-item" style={{ marginBottom: '1rem' }}>
                    <span className="detail-label">Note del cliente</span>
                    <span className="detail-value">{booking.notes}</span>
                  </div>
                )}

                {(booking.status === 'pending' || booking.status === 'preconfirmed') && (
                  <div className="booking-card-actions">
                    {booking.payment_method === 'bonifico' && booking.status === 'pending' && (
                      <button
                        onClick={() => handlePreConfirm(booking.id)}
                        className="btn btn-success"
                      >
                        Invia IBAN (pre-conferma)
                      </button>
                    )}
                    {booking.payment_method === 'bonifico' && booking.status === 'preconfirmed' && (
                      <button
                        onClick={() => handleConfirm(booking.id)}
                        className="btn btn-success"
                      >
                        Conferma (bonifico verificato)
                      </button>
                    )}
                    {booking.payment_method !== 'bonifico' && booking.status === 'pending' && (
                      <button
                        onClick={() => handleConfirm(booking.id)}
                        className="btn btn-success"
                      >
                        Conferma
                      </button>
                    )}
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
      )}
    </div>
  );
};

export default AdminPanel;