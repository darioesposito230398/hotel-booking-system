import React, { useState, useEffect } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import axios from 'axios';
import { useLanguage } from '../i18n';

const BookingForm = ({ apiUrl }) => {
  const stripe = useStripe();
  const elements = useElements();
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
  const [nights, setNights] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

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

  useEffect(() => {
    const fetchQuote = async () => {
      if (!formData.checkIn || !formData.checkOut || !formData.roomTypeId) {
        return;
      }
      try {
        const response = await axios.get(`${apiUrl}/quote`, {
          params: {
            roomTypeId: formData.roomTypeId,
            checkIn: formData.checkIn,
            checkOut: formData.checkOut
          }
        });
        setNights(response.data.nights);
        setTotalPrice(response.data.total);
      } catch (err) {
        console.error('Error fetching quote:', err);
      }
    };
    fetchQuote();
  }, [formData.checkIn, formData.checkOut, formData.roomTypeId, apiUrl]);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Create payment intent
      const paymentResponse = await axios.post(`${apiUrl}/create-payment-intent`, {
        roomTypeId: formData.roomTypeId,
        checkIn: formData.checkIn,
        checkOut: formData.checkOut,
        numGuests: formData.numGuests
      });

      const { clientSecret } = paymentResponse.data;

      // Confirm payment with Stripe (this tokenizes the card)
      const cardElement = elements.getElement(CardElement);
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: formData.guestName,
            email: formData.guestEmail,
          },
        },
      });

      if (stripeError) {
        setError(stripeError.message);
        setLoading(false);
        return;
      }

      // Create booking request
      await axios.post(`${apiUrl}/booking-requests`, {
        ...formData,
        paymentIntentId: paymentIntent.id
      });

      setSuccess(true);
      setLoading(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Si è verificato un errore durante la prenotazione');
      setLoading(false);
    }
  };

if (success) {
    return (
      <div className="success-message">
        <h3>{t('success.title')}</h3>
        <p>{t('success.nocharge')}</p>
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
                  {roomName(room.name)} - €{room.base_price}{t('rooms.perNight')}
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

        {totalPrice > 0 && (
          <div className="price-display">
            <div>
              <div className="price-total">€{totalPrice.toFixed(2)}</div>
              <div className="price-breakdown">
                {nights} {nights === 1 ? t('night.singular') : t('night.plural')} · {t('price.dynamic')}
              </div>
            </div>
            <div className="price-avviso">{t('price.nocharge')}</div>
          </div>
        )}

        <div className="form-group">
          <label>{t('label.card')}</label>
          <div className="stripe-element">
            <CardElement
              options={{
                style: {
                  base: {
                    fontSize: '16px',
                    color: '#1b2430',
                    '::placeholder': {
                      color: '#aab7c4',
                    },
                  },
                  invalid: {
                    color: '#b03c2e',
                  },
                },
              }}
            />
          </div>
          <small className="stripe-note">
            {t('stripe.note')}
          </small>
        </div>

        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={!stripe || loading}
          style={{ marginTop: '1.25rem' }}
        >
          {loading ? t('booking.loading') : t('booking.submit')}
        </button>
      </form>
    </div>
  );
};

export default BookingForm;
