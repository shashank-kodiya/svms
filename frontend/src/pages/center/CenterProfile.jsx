import { useEffect, useState } from 'react';
import Layout from '../../components/Layout.jsx';
import Notice from '../../components/Notice.jsx';
import MapView from '../../components/MapView.jsx';
import useCenterProfile from '../../hooks/useCenterProfile.js';
import useVehicleOptions from '../../hooks/useVehicleOptions.js';
import { errorMessage } from '../../api/client.js';

const FIELDS = ['name', 'description', 'address', 'city', 'pincode', 'phone', 'gstin'];

export default function CenterProfile() {
  const { center, error, save } = useCenterProfile();
  const options = useVehicleOptions();
  const [form, setForm] = useState(null);
  const [brands, setBrands] = useState({ Car: [], Bike: [] });
  const [msg, setMsg] = useState(null);
  const [brandMsg, setBrandMsg] = useState(null);
  const [locMsg, setLocMsg] = useState(null);
  const [locBusy, setLocBusy] = useState('');

  useEffect(() => {
    if (!center) return;
    setForm(Object.fromEntries(FIELDS.map((f) => [f, center[f] || ''])));
    setBrands({ Car: center.brands?.Car || [], Bike: center.brands?.Bike || [] });
  }, [center]);

  const saveProfile = async (e) => {
    e.preventDefault();
    setMsg(null);
    try {
      await save('patch', '/center/profile', form);
      setMsg({ tone: 'good', text: 'Profile saved.' });
    } catch (err) {
      setMsg({ tone: 'bad', text: errorMessage(err) });
    }
  };

  const toggle = (type, brand) =>
    setBrands((b) => ({ ...b, [type]: b[type].includes(brand) ? b[type].filter((x) => x !== brand) : [...b[type], brand] }));

  const saveBrands = async () => {
    setBrandMsg(null);
    try {
      await save('put', '/center/brands', brands);
      setBrandMsg({ tone: 'good', text: 'Brands saved.' });
    } catch (err) {
      setBrandMsg({ tone: 'bad', text: errorMessage(err) });
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  // Phase 9: where the center is on the map
  const hasPoint = Number.isFinite(center?.location?.lat) && Number.isFinite(center?.location?.lng);
  const locFail = (err) => setLocMsg({ tone: 'bad', text: errorMessage(err) });
  const useDevice = () => {
    setLocMsg(null);
    if (!('geolocation' in navigator)) return setLocMsg({ tone: 'bad', text: 'This browser cannot share your location.' });
    setLocBusy('device');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await save('put', '/center/location', { lat: Number(pos.coords.latitude.toFixed(6)), lng: Number(pos.coords.longitude.toFixed(6)) });
          setLocMsg({ tone: 'good', text: 'Location saved. Check the pin is at your workshop (use the Google Maps link). If you are not at the shop right now, this will be wrong.' });
        } catch (err) { locFail(err); } finally { setLocBusy(''); }
      },
      (err) => {
        setLocBusy('');
        setLocMsg({ tone: 'bad', text: err.code === 1 ? 'Location permission was blocked. Allow it in the address bar and try again.' : 'Could not find your location.' });
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };
  const fromAddress = async () => {
    setLocMsg(null);
    setLocBusy('address');
    try {
      await save('post', '/center/location/from-address');
      setLocMsg({ tone: 'good', text: 'Location found from your address. Check the pin is at your workshop.' });
    } catch (err) { locFail(err); } finally { setLocBusy(''); }
  };
  const removeLocation = async () => {
    setLocMsg(null);
    try { await save('delete', '/center/location'); setLocMsg({ tone: 'good', text: 'Location removed.' }); } catch (err) { locFail(err); }
  };

  return (
    <Layout title="Profile & Brands" subtitle="Customers see this information and search by the brands you service.">
      {error && <div className="alert bad">{error}</div>}
      {!form ? <p className="muted">Loading…</p> : (
        <>
          <form className="card form-card" onSubmit={saveProfile} noValidate>
            <h3>Center details</h3>
            <div className="grid2">
              <label className="field"><span>Center name</span><input value={form.name} onChange={set('name')} /></label>
              <label className="field"><span>Phone</span><input inputMode="numeric" maxLength={10} value={form.phone} onChange={set('phone')} /></label>
              <label className="field full"><span>Address</span><input value={form.address} onChange={set('address')} /></label>
              <label className="field"><span>City</span><input value={form.city} onChange={set('city')} /></label>
              <label className="field"><span>PIN code</span><input inputMode="numeric" maxLength={6} value={form.pincode} onChange={set('pincode')} /></label>
              <label className="field"><span>GSTIN (optional, printed on invoices)</span><input maxLength={15} value={form.gstin} onChange={set('gstin')} placeholder="29ABCDE1234F1Z5" style={{ textTransform: 'uppercase' }} /></label>
              <label className="field full"><span>About your center (optional)</span><textarea rows={3} maxLength={500} value={form.description} onChange={set('description')} placeholder="Multi-brand workshop since 2009. Genuine parts, pick-up on request." /></label>
            </div>
            <div className="row"><button className="btn primary">Save details</button></div>
            <Notice msg={msg} />
          </form>

          <div className="card">
            <div className="row between">
              <h3>Location on the map</h3>
              {hasPoint ? <span className="chip good">Set</span> : <span className="chip warn">Not set</span>}
            </div>
            <p className="small muted">
              {hasPoint
                ? <>Customers see how far you are from them and find you on the map. Position: {center.location.lat.toFixed(5)}, {center.location.lng.toFixed(5)} ({center.location.source === 'address' ? 'found from your address' : center.location.source === 'seed' ? 'demo data' : 'from this device'}). <a href={`https://www.google.com/maps?q=${center.location.lat},${center.location.lng}`} target="_blank" rel="noreferrer">Check it on Google Maps</a>.</>
                : 'Without a location, customers cannot see your distance or find you on the map. Stand at your workshop and use your current location, or find it from your address.'}
            </p>
            {hasPoint && <MapView markers={[{ id: 'me', lat: center.location.lat, lng: center.location.lng, title: center.name, tone: 'center' }]} height={220} />}
            <div className="row">
              <button className="btn primary" onClick={useDevice} disabled={locBusy}>{locBusy === 'device' ? 'Finding you…' : 'Use my current location'}</button>
              <button className="btn" onClick={fromAddress} disabled={locBusy}>{locBusy === 'address' ? 'Looking up…' : 'Find from my address'}</button>
              {hasPoint && <button className="btn ghost" onClick={removeLocation} disabled={locBusy}>Remove</button>}
            </div>
            <Notice msg={locMsg} />
          </div>

          <div className="card">
            <div className="row between">
              <h3>Brands you service</h3>
              <span className="small muted">{brands.Car.length} car · {brands.Bike.length} bike</span>
            </div>
            <p className="small muted">A customer only sees your center when it services their vehicle's brand.</p>
            {['Car', 'Bike'].map((type) => (
              <fieldset key={type} className="fieldset">
                <legend>{type} brands</legend>
                <div className="checks">
                  {options?.brands[type].map((b) => (
                    <label key={b} className={`check ${brands[type].includes(b) ? 'on' : ''}`}>
                      <input type="checkbox" checked={brands[type].includes(b)} onChange={() => toggle(type, b)} />
                      {b}
                    </label>
                  ))}
                </div>
                <div className="row">
                  <button type="button" className="btn sm" onClick={() => setBrands((x) => ({ ...x, [type]: [...options.brands[type]] }))}>Select all</button>
                  <button type="button" className="btn sm" onClick={() => setBrands((x) => ({ ...x, [type]: [] }))}>Clear</button>
                </div>
              </fieldset>
            ))}
            <div className="row"><button className="btn primary" onClick={saveBrands}>Save brands</button></div>
            <Notice msg={brandMsg} />
          </div>
        </>
      )}
    </Layout>
  );
}
