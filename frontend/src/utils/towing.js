// Labels shared by the customer's Roadside help page and the center's Towing page.
export const TOW_TYPES = { flatbed: 'Flatbed truck (cars)', wheel_lift: 'Wheel-lift truck (cars)', bike_carrier: 'Bike carrier' };

export const TOW_STATUS = {
  requested: { label: 'Waiting for the center', tone: 'warn' },
  accepted: { label: 'Accepted', tone: 'info' },
  on_the_way: { label: 'Truck on the way', tone: 'info' },
  completed: { label: 'Towed', tone: 'good' },
  declined: { label: 'Declined', tone: 'bad' },
  cancelled: { label: 'Cancelled', tone: '' }
};
