import React, { useState, useEffect } from 'react';
import { PayPalButtons } from '@paypal/react-paypal-js';
import axios from 'axios';
import { useLanguage } from '../i18n';

const BookingForm = ({ apiUrl, paypalClientId }) => {
  const { t, roomName, roomDesc } = useLanguage();
  
  const [roomTypes, setRoomTypes] = useState([]);
  const [formData, setFormData] = useState({
    guestName: '',
    guestEmail: '',
    guestPhone: '',
    checkIn: '',
    checkOut: '',
    roomTypeId: '',
    numGuests: 1,
    notes: ''
  });
  const [totalPrice, setTotalPrice] = useState(0);
  const [originalTotal, setOriginalTotal] = useState(0);
  const [firstNightAmount, setFirstNightAmount] = useState(0);
  const [discount, setDiscount] = useState(0.1);
  const [nights, setNights] = useState(0);
  const [hasQuote, setHasQuote] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('paypal');
  const [idDocument, setIdDocument] = useState('');
  const [idDocumentName, setIdDocumentName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleIdDocument = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Il documento non deve superare 5 MB.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setIdDocument(reader.result);
      setIdDocumentName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const isFormComplete = () =>
    Boolean(formData.checkIn && formData.checkOut && formData.roomTypeId &&
      formData.guestName && formData.guestEmail && formData.guestPhone &&
      formData.numGuests && idDocument);

  useEffect(() => {
    const fetchRoomTypes = async () => {
      try {
        const response = await axios.get(`${apiUrl}/room-types`);
        setRoomTypes(response.data);
        if (response.data.length > 0) {
          setFormData(prev => ({ ...prev, roomTypeId: response.data[0].id }));
        }
      } catch (err) {
        console.error('Error fetching room types:', err);
      }
    };
    fetchRoomTypes();
  }, [apiUrl]);

  const calculateQuote = async () => {
    if (!formData.checkIn || !formData.checkOut || !formData.roomTypeId) {
      setError('Inserisci le date e la tipologia di camera');
      return;
    }
    setError('');
    try {
      const response = await axios.get(`${apiUrl}/quote`, {
        params: {
          roomTypeId: formData.roomTypeId,
          checkIn: formData.checkIn,
          checkOut: formData.checkOut
        }
      });
      setNights(response.data.nights);
      setOriginalTotal(response.data.total);
      setTotalPrice(response.data.discountedTotal);
      setFirstNightAmount(response.data.firstNightAmount || 0);
      setDiscount(response.data.discount || 0.1);
      setHasQuote(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Errore nel calcolo del preventivo');
    }
  };

  const getRoomPhoto = (room) => {
    if (room?.photo) {
      return `/images/rooms/${room.photo}`;
    }
    const photoMap = {
      'Singola Bagno Condiviso': '/images/rooms/singola-bagno-comune.jpg',
      'Singola Bagno Privato': '/images/rooms/singola-bagno-privato.png',
      'Doppia Standard': '/images/rooms/doppia-standard.jpg',
      'Doppia/Twin Bagno Condiviso': '/images/rooms/doppia-standard.jpg',
      'Tripla Standard': '/images/rooms/tripla-standard.jpg'
    };
    return photoMap[room?.name] || '/images/rooms/doppia-standard.jpg';
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const validate = () => {
    if (!hasQuote || totalPrice <= 0) return t('booking.quote.first');
    const missing = [];
    if (!formData.guestName) missing.push('nome e cognome');
    if (!formData.guestEmail) missing.push('email');
    else if (!/\S+@\S+\.\S+/.test(formData.guestEmail)) return 'L\'email inserita non è valida.';
    if (!formData.guestPhone) missing.push('telefono');
    if (!formData.checkIn) missing.push('data di check-in');
    if (!formData.checkOut) missing.push('data di check-out');
    else if (formData.checkIn && formData.checkOut && new Date(formData.checkOut) <= new Date(formData.checkIn)) {
      return 'La data di check-out deve essere successiva al check-in.';
    }
    if (!formData.roomTypeId) missing.push('tipologia di camera');
    if (!formData.numGuests) missing.push('numero ospiti');
    if (!idDocument) missing.push('documento d\'identità');
    if (missing.length === 0) return '';
    return `Compila i campi obbligatori: ${missing.join(', ')}.`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const invalid = validate();
    if (invalid) {
      setError(invalid);
      return;
    }
    setLoading(true);
    setError('');

    try {
      await axios.post(`${apiUrl}/booking-requests`, {
        ...formData,
        idDocument,
        paymentMethod: 'bonifico'
      });
      setSuccess(true);
      setLoading(false);
    } catch (err) {
      if (err.response?.status === 413) {
        setError('Il documento d\'identità è troppo grande. Carica un file più piccolo (max 5 MB).');
      } else {
        setError(err.response?.data?.error || 'Si è verificato un errore durante la prenotazione. Riprova.');
      }
      setLoading(false);
    }
  };

  const handlePayPalSuccess = async (data) => {
    const invalid = validate();
    if (invalid) {
      setError(invalid);
      return;
    }
    setLoading(true);
    setError('');
    try {
      await axios.post(`${apiUrl}/booking-requests`, {
        ...formData,
        idDocument,
        paymentMethod: 'paypal',
        paypalOrderId: data.orderID
      });
      setSuccess(true);
      setLoading(false);
    } catch (err) {
      if (err.response?.status === 413) {
        setError('Il documento d\'identità è troppo grande. Carica un file più piccolo (max 5 MB).');
      } else {
        setError(err.response?.data?.error || 'Si è verificato un errore durante la prenotazione. Riprova.');
      }
      setLoading(false);
    }
  };

if (success) {
    return (
      <div className="success-message">
        <h3>{t('success.title')}</h3>
        {paymentMethod === 'bonifico' ? (
          <>
            <p>{t('success.bonifico.done')}</p>
            <p>{t('success.bonifico.confirm')}</p>
          </>
        ) : paymentMethod === 'paypal' ? (
          <p>{t('success.paypal')}</p>
        ) : (
          <p>{t('success.nocharge')}</p>
        )}
        <p>{t('success.validafter')}</p>
        <p>{t('success.email')}</p>
      </div>
    );
  }

  return (
    <div className="booking-form">
      <span className="eyebrow">{t('booking.eyebrow')}</span>
      <h2>{t('booking.title')}</h2>
      <p className="form-intro">{t('booking.p')}</p>

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="checkIn">{t('label.checkin')}</label>
            <input
              type="date"
              id="checkIn"
              name="checkIn"
              value={formData.checkIn}
              onChange={handleInputChange}
              min={new Date().toISOString().split('T')[0]}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="checkOut">{t('label.checkout')}</label>
            <input
              type="date"
              id="checkOut"
              name="checkOut"
              value={formData.checkOut}
              onChange={handleInputChange}
              min={formData.checkIn || new Date().toISOString().split('T')[0]}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="roomTypeId">{t('label.roomtype')}</label>
            <select
              id="roomTypeId"
              name="roomTypeId"
              value={formData.roomTypeId}
              onChange={handleInputChange}
              required
            >
              {roomTypes.map(room => (
                <option key={room.id} value={room.id}>
                  {roomName(room.name)}
                </option>
              ))}
            </select>
          </div>

          {formData.roomTypeId && (
            <div className="room-preview">
              <img
                src={getRoomPhoto(roomTypes.find(r => r.id === parseInt(formData.roomTypeId)))}
                alt="Camera selezionata"
              />
              <div className="room-preview-info">
                <h4>{roomName(roomTypes.find(r => r.id === parseInt(formData.roomTypeId))?.name)}</h4>
                <p>{roomDesc(
                  roomTypes.find(r => r.id === parseInt(formData.roomTypeId))?.description,
                  roomTypes.find(r => r.id === parseInt(formData.roomTypeId))?.name
                )}</p>
              </div>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="numGuests">{t('label.guests')}</label>
            <select
              id="numGuests"
              name="numGuests"
              value={formData.numGuests}
              onChange={handleInputChange}
              required
            >
              {[1, 2, 3, 4, 5, 6].map(num => (
                <option key={num} value={num}>{num}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="guestName">{t('label.name')}</label>
            <input
              type="text"
              id="guestName"
              name="guestName"
              value={formData.guestName}
              onChange={handleInputChange}
              placeholder="Mario Rossi"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="guestEmail">{t('label.email')}</label>
            <input
              type="email"
              id="guestEmail"
              name="guestEmail"
              value={formData.guestEmail}
              onChange={handleInputChange}
              placeholder="mario@email.com"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="guestPhone">{t('label.phone')}</label>
            <input
              type="tel"
              id="guestPhone"
              name="guestPhone"
              value={formData.guestPhone}
              onChange={handleInputChange}
              placeholder="+39 123 456 7890"
            />
          </div>

          <div className="form-group">
            <label htmlFor="idDocument">{t('label.idDocument')}</label>
            <input
              type="file"
              id="idDocument"
              name="idDocument"
              accept="image/*,.pdf"
              onChange={handleIdDocument}
              required
            />
            {idDocumentName ? (
              <small className="stripe-note">{t('idDocument.uploaded')}: {idDocumentName}</small>
            ) : (
              <small className="stripe-note">{t('idDocument.hint')}</small>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="note">{t('label.notes')}</label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              placeholder={t('notes.ph')}
            />
          </div>
        </div>

        <button
          type="button"
          className="btn btn-gold btn-block"
          onClick={calculateQuote}
          style={{ marginTop: '0.5rem' }}
        >
          {t('booking.quote')}
        </button>

        {hasQuote && totalPrice > 0 && (
          <div className="price-display">
            <div>
              <div className="price-breakdown">
                {nights} {nights === 1 ? t('night.singular') : t('night.plural')} · {t('price.dynamic')}
              </div>
              <div className="price-original">€{originalTotal.toFixed(2)}</div>
              <div className="price-total">€{totalPrice.toFixed(2)}</div>
              <div className="price-discount-line">
                <span className="price-discount-badge">–{Math.round(discount * 100)}%</span>
                {t('price.discount')}
              </div>
              <div className="price-firstnight">
                {t('price.firstnight.pre')} <strong>€{firstNightAmount.toFixed(2)}</strong> {t('price.firstnight.post')}
              </div>
            </div>
            <div className="price-avviso">{t('price.nocharge')}</div>
          </div>
        )}

        <div className="payment-method">
          <label className="payment-option">
            <input
              type="radio"
              name="paymentMethod"
              value="paypal"
              checked={paymentMethod === 'paypal'}
              onChange={() => setPaymentMethod('paypal')}
            />
            <div>
              <strong>{t('payment.paypal')}</strong>
              <small>{t('payment.paypal.desc')}</small>
            </div>
          </label>
          <label className="payment-option">
            <input
              type="radio"
              name="paymentMethod"
              value="bonifico"
              checked={paymentMethod === 'bonifico'}
              onChange={() => setPaymentMethod('bonifico')}
            />
            <div>
              <strong>{t('payment.bonifico')}</strong>
              <small>{t('payment.bonifico.desc')}</small>
            </div>
          </label>
        </div>

        {paymentMethod === 'bonifico' && (
          <div className="bonifico-block">
            <p className="bonifico-title">{t('bonifico.title')}</p>
            <p className="bonifico-avviso">{t('bonifico.iban.pending')}</p>
            <p className="bonifico-note">{t('bonifico.note')}</p>
          </div>
        )}

        {paymentMethod === 'bonifico' && (
          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={loading || !hasQuote}
            style={{ marginTop: '1.25rem' }}
          >
            {loading ? t('booking.loading') : t('booking.submit')}
          </button>
        )}

        {paymentMethod === 'paypal' && !isFormComplete() && (
          <p className="paypal-loading" style={{ marginTop: '1.25rem' }}>{t('booking.completeFields')}</p>
        )}

        {paymentMethod === 'paypal' && isFormComplete() && (
          <div className="paypal-block" style={{ marginTop: '1.25rem' }}>
            {!paypalClientId ? (
              <p className="paypal-loading">{t('paypal.notConfigured')}</p>
            ) : (
              <PayPalButtons
                style={{ layout: 'vertical', color: 'gold', shape: 'rect', label: 'paypal' }}
                forceReRender={[formData.checkIn, formData.checkOut, formData.roomTypeId]}
                createOrder={async () => {
                  if (!hasQuote || totalPrice <= 0) {
                    setError(t('booking.quote.first'));
                    throw new Error('quote required');
                  }
                  const res = await axios.post(`${apiUrl}/paypal/create-order`, {
                    roomTypeId: formData.roomTypeId,
                    checkIn: formData.checkIn,
                    checkOut: formData.checkOut
                  });
                  return res.data.orderId;
                }}
                onApprove={async (data) => {
                  await handlePayPalSuccess(data);
                }}
                onError={() => setError(t('paypal.error'))}
              />
            )}
          </div>
        )}
      </form>
    </div>
  );
};

export default BookingForm;
