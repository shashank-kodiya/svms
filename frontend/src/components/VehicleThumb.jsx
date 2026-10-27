import { useState } from 'react';
import Lightbox from './Lightbox.jsx';

// The customer's vehicle photo on a booking, so the center can recognise the vehicle when it arrives.
// Uses the photo saved with the booking, or the vehicle's current photo for older bookings.
// Click to see it full size. Shows a car/bike outline when the customer has not added a photo.
export const vehiclePhoto = (b) => b?.vehicleSnapshot?.imageUrl || b?.vehicle?.image?.url || null;

export default function VehicleThumb({ booking, size = 64 }) {
  const [open, setOpen] = useState(null);
  const url = vehiclePhoto(booking);
  const name = `${booking?.vehicleSnapshot?.brand || ''} ${booking?.vehicleSnapshot?.model || ''}`.trim() || 'Vehicle';
  const bike = (booking?.vehicleSnapshot?.type || booking?.vehicle?.type) === 'Bike';

  if (!url) {
    return (
      <span className="vthumb vthumb--empty" style={{ width: size, height: size }} title="The customer has not added a photo of this vehicle">
        <span aria-hidden="true">{bike ? '🏍️' : '🚗'}</span>
        <span className="vthumb__note">No photo</span>
      </span>
    );
  }
  return (
    <>
      <button type="button" className="vthumb" style={{ width: size, height: size }} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(0); }} aria-label={`See photo of ${name}`}>
        <img src={url} alt={name} loading="lazy" />
      </button>
      <Lightbox photos={[{ url, caption: booking?.vehicleSnapshot?.regNumber || '' }]} index={open} onChange={setOpen} onClose={() => setOpen(null)} title={name} />
    </>
  );
}
