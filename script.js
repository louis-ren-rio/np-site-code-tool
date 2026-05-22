// ============================================================
// Site code encode / decode — implemented inline (no library)
// Base32 alphabet used by the coordinate code format
// ============================================================
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

function encodeSiteCode(lat, lng, precision) {
  precision = precision || 9;
  let idx = 0, bit = 0, isEven = true;
  let minLat = -90, maxLat = 90;
  let minLng = -180, maxLng = 180;
  let hash = '';

  while (hash.length < precision) {
    if (isEven) {
      const mid = (minLng + maxLng) / 2;
      if (lng >= mid) { idx = (idx << 1) | 1; minLng = mid; }
      else             { idx = (idx << 1);     maxLng = mid; }
    } else {
      const mid = (minLat + maxLat) / 2;
      if (lat >= mid) { idx = (idx << 1) | 1; minLat = mid; }
      else            { idx = (idx << 1);     maxLat = mid; }
    }
    isEven = !isEven;

    if (++bit === 5) {
      hash += BASE32[idx];
      bit = 0;
      idx = 0;
    }
  }
  return hash;
}

function decodeSiteCodeValue(code) {
  let isEven = true;
  let minLat = -90, maxLat = 90;
  let minLng = -180, maxLng = 180;

  for (const ch of code) {
    const val = BASE32.indexOf(ch);
    if (val === -1) throw new Error('Invalid site code character: ' + ch);

    for (let bits = 4; bits >= 0; bits--) {
      const bit = (val >> bits) & 1;
      if (isEven) {
        const mid = (minLng + maxLng) / 2;
        if (bit) minLng = mid; else maxLng = mid;
      } else {
        const mid = (minLat + maxLat) / 2;
        if (bit) minLat = mid; else maxLat = mid;
      }
      isEven = !isEven;
    }
  }

  return {
    lat: (minLat + maxLat) / 2,
    lng: (minLng + maxLng) / 2
  };
}

// ============================================================
// Map — Leaflet.js + OpenStreetMap (free, no API key)
// ============================================================
let map, marker;

// Initialise map on page load
(function initMap() {
  map = L.map('map', { attributionControl: false }).setView([-33.8688, 151.2093], 12); // Sydney default

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(map);

  L.control.attribution({ prefix: false })
    .addAttribution('<a href="https://www.openstreetmap.org/copyright">© OSM</a>')
    .addTo(map);

  // Click on map -> update fields and generate site code
  map.on('click', function (e) {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    setInputs(lat, lng);
    placeMarker(lat, lng);
    document.getElementById('site-code').value = encodeSiteCode(lat, lng, 9);
    showFeedback('');
  });
})();

// ============================================================
// Marker helpers
// ============================================================
function placeMarker(lat, lng) {
  if (marker) {
    marker.setLatLng([lat, lng]);
  } else {
    marker = L.marker([lat, lng]).addTo(map);
  }
  map.panTo([lat, lng]);
}

// ============================================================
// Input helpers
// ============================================================
function setInputs(lat, lng) {
  document.getElementById('lat').value = lat.toFixed(6);
  document.getElementById('lng').value = lng.toFixed(6);
}

function getInputs() {
  const lat = parseFloat(document.getElementById('lat').value);
  const lng = parseFloat(document.getElementById('lng').value);
  return { lat, lng };
}

function showFeedback(msg) {
  document.getElementById('feedback').textContent = msg;
}

function updateLocation(lat, lng) {
  setInputs(lat, lng);
  placeMarker(lat, lng);
  document.getElementById('site-code').value = encodeSiteCode(lat, lng, 9);
}

// ============================================================
// Button actions
// ============================================================

// Search an address using OpenStreetMap Nominatim
function searchAddress() {
  const address = document.getElementById('address').value.trim();
  if (!address) return showFeedback('Please enter an address.');

  showFeedback('Searching address...');

  const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' +
    encodeURIComponent(address);

  fetch(url)
    .then(function (response) {
      if (!response.ok) throw new Error('Address search failed.');
      return response.json();
    })
    .then(function (results) {
      if (!results.length) {
        showFeedback('Address not found.');
        return;
      }

      const lat = parseFloat(results[0].lat);
      const lng = parseFloat(results[0].lon);
      updateLocation(lat, lng);
      map.setView([lat, lng], 15);
      showFeedback('Address found.');
    })
    .catch(function () {
      showFeedback('Address search failed.');
    });
}

// Show coordinates on map
function showOnMap() {
  const { lat, lng } = getInputs();
  if (isNaN(lat) || isNaN(lng)) {
    return showFeedback('Please enter valid lat/lng.');
  }
  updateLocation(lat, lng);
  showFeedback('');
}

// Generate site code from current lat/lng inputs
function generateSiteCode() {
  const { lat, lng } = getInputs();
  if (isNaN(lat) || isNaN(lng)) {
    return showFeedback('Please enter valid lat/lng.');
  }
  document.getElementById('site-code').value = encodeSiteCode(lat, lng, 9);
  showFeedback('Site/location code generated.');
}

// Decode site code -> update inputs and map
function decodeSiteCode() {
  const code = document.getElementById('site-code').value.trim().toLowerCase();
  if (!code) return showFeedback('Please enter a site code.');

  try {
    const { lat, lng } = decodeSiteCodeValue(code);
    updateLocation(lat, lng);
    showFeedback('Decoded successfully.');
  } catch (e) {
    showFeedback('Invalid site code.');
  }
}

// Toggle site code between uppercase and lowercase
let siteCodeIsUpper = false;

function toggleSiteCodeCase() {
  const input = document.getElementById('site-code');
  if (!input.value.trim()) return showFeedback('No site code to toggle.');
  siteCodeIsUpper = !siteCodeIsUpper;
  input.value = siteCodeIsUpper ? input.value.toUpperCase() : input.value.toLowerCase();
  document.getElementById('btn-toggle-case').textContent = siteCodeIsUpper ? 'aa' : 'Aa';
  showFeedback('');
}

// Copy site code to clipboard
function copySiteCode() {
  const code = document.getElementById('site-code').value.trim();
  if (!code) return showFeedback('Nothing to copy.');

  navigator.clipboard.writeText(code).then(function () {
    showFeedback('Copied!');
    setTimeout(() => showFeedback(''), 2000);
  }).catch(function () {
    // Fallback for browsers that block clipboard without HTTPS
    const input = document.getElementById('site-code');
    input.select();
    document.execCommand('copy');
    showFeedback('Copied!');
    setTimeout(() => showFeedback(''), 2000);
  });
}
