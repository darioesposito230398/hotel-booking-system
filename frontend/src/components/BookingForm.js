import React, { useState, useEffect } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import axios from 'axios';

const BookingForm = ({ apiUrl }) => {
  const stripe = useStripe();
  const elements = useElements();
  
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
    const calculatePrice = () => {
      if (formData.checkIn && formData.checkOut && formData.roomTypeId) {
        const checkIn = new Date(formData.checkIn);
        const checkOut = new Date(formData.checkOut);
        const diffTime = Math.abs(checkOut - checkIn);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays > 0) {
          const roomType = roomTypes.find(r => r.id === parseInt(formData.roomTypeId));
          if (roomType) {
            setNights(diffDays);
            setTotalPrice(roomType.base_price * diffDays);
          }
        }
      }
    };
    calculatePrice();
  }, [formData.checkIn, formData.checkOut, formData.roomTypeId, roomTypes]);

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
        <h3>Richiesta Ricevuta!</h3>
        <p>Nessun importo è stato addebitato.</p>
        <p>La prenotazione sarà valida solamente dopo la conferma dell'hotel.</p>
        <p>Riceverai una comunicazione via email.</p>
      </div>
    );
  }

  return (
    <div className="booking-form">
      <h2>Prenota la Tua Camera</h2>
      
      {error && <div className="error-message">{error}</div>}
      
      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="checkIn">Data Check-in</label>
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
            <label htmlFor="checkOut">Data Check-out</label>
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
            <label htmlFor="roomTypeId">Tipologia Camera</label>
            <select
              id="roomTypeId"
              name="roomTypeId"
              value={formData.roomTypeId}
              onChange={handleInputChange}
              required
            >
              {roomTypes.map(room => (
                <option key={room.id} value={room.id}>
                  {room.name} - €{room.base_price}/notte
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="numGuests">Numero Ospiti</label>
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
            <label htmlFor="guestName">Nome e Cognome</label>
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
            <label htmlFor="guestEmail">Email</label>
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
            <label htmlFor="guestPhone">Telefono</label>
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
            <label htmlFor="note">Note o Richieste Speciali</label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              placeholder="Es: Camera vista mare, cuscini extra, etc."
            />
          </div>
        </div>

        {totalPrice > 0 && (
          <div className="price-display">
            <div className="total-price">€{totalPrice.toFixed(2)}</div>
            <div className="price-breakdown">
              {nights} notte{nights !== 1 ? 'i' : ''} x €{roomTypes.find(r => r.id === parseInt(formData.roomTypeId))?.base_price}
            </div>
          </div>
        )}

        <div className="form-group">
          <label>Dati Carta di Credito</label>
          <div className="stripe-element">
            <CardElement
              options={{
                style: {
                  base: {
                    fontSize: '16px',
                    color: '#424770',
                    '::placeholder': {
                      color: '#aab7c4',
                    },
                  },
                  invalid: {
                    color: '#9e2146',
                  },
                },
              }}
            />
          </div>
          <small style={{ color: 'var(--text-light)', marginTop: '0.5rem', display: 'block' }}>
            I tuoi dati sono al sicuro. La carta viene tokenizzata e non salvata sul nostro server.
          </small>
        </div>

        <button 
          type="submit" 
          className="btn btn-primary" 
          disabled={!stripe || loading}
          style={{ width: '100%', marginTop: '1rem' }}
        >
          {loading ? 'Elaborazione in corso...' : 'Invia Richiesta di Prenotazione'}
        </button>
      </form>
    </div>
  );
};

export default BookingForm;
