const pageRole = document.body.dataset.role;
const pageView = document.body.dataset.view;
const supabaseClient = window.wayfarerSupabase || null;
let signedInUser = null;
let signedInProfile = null;
let conversationRefreshTimer = null;
let activeConversationId = null;
let messageRequests = [];
const renterLocationOptions = [
  { district: 'Agra', state: 'Uttar Pradesh', city: 'Agra' },
  { district: 'Ahmedabad', state: 'Gujarat', city: 'Ahmedabad' },
  { district: 'Amritsar', state: 'Punjab', city: 'Amritsar' },
  { district: 'Bengaluru Urban', state: 'Karnataka', city: 'Bengaluru' },
  { district: 'Bhopal', state: 'Madhya Pradesh', city: 'Bhopal' },
  { district: 'Bhubaneswar', state: 'Odisha', city: 'Bhubaneswar' },
  { district: 'Chandigarh', state: 'Chandigarh', city: 'Chandigarh' },
  { district: 'Chennai', state: 'Tamil Nadu', city: 'Chennai' },
  { district: 'Coimbatore', state: 'Tamil Nadu', city: 'Coimbatore' },
  { district: 'Dehradun', state: 'Uttarakhand', city: 'Dehradun' },
  { district: 'Central Delhi', state: 'Delhi', city: 'Delhi' },
  { district: 'Faridabad', state: 'Haryana', city: 'Faridabad' },
  { district: 'North Goa', state: 'Goa', city: 'Goa' },
  { district: 'Gurugram', state: 'Haryana', city: 'Gurugram' },
  { district: 'Guwahati', state: 'Assam', city: 'Guwahati' },
  { district: 'Hyderabad', state: 'Telangana', city: 'Hyderabad' },
  { district: 'Indore', state: 'Madhya Pradesh', city: 'Indore' },
  { district: 'Jaipur', state: 'Rajasthan', city: 'Jaipur' },
  { district: 'Jodhpur', state: 'Rajasthan', city: 'Jodhpur' },
  { district: 'Kanpur Nagar', state: 'Uttar Pradesh', city: 'Kanpur' },
  { district: 'Ernakulam', state: 'Kerala', city: 'Kochi' },
  { district: 'Kolkata', state: 'West Bengal', city: 'Kolkata' },
  { district: 'Lucknow', state: 'Uttar Pradesh', city: 'Lucknow' },
  { district: 'Ludhiana', state: 'Punjab', city: 'Ludhiana' },
  { district: 'Madurai', state: 'Tamil Nadu', city: 'Madurai' },
  { district: 'Dakshina Kannada', state: 'Karnataka', city: 'Mangaluru' },
  { district: 'Mumbai City', state: 'Maharashtra', city: 'Mumbai' },
  { district: 'Mysuru', state: 'Karnataka', city: 'Mysuru' },
  { district: 'Nagpur', state: 'Maharashtra', city: 'Nagpur' },
  { district: 'Nashik', state: 'Maharashtra', city: 'Nashik' },
  { district: 'Gautam Buddha Nagar', state: 'Uttar Pradesh', city: 'Noida' },
  { district: 'Patna', state: 'Bihar', city: 'Patna' },
  { district: 'Pune', state: 'Maharashtra', city: 'Pune' },
  { district: 'Raipur', state: 'Chhattisgarh', city: 'Raipur' },
  { district: 'Rajkot', state: 'Gujarat', city: 'Rajkot' },
  { district: 'Ranchi', state: 'Jharkhand', city: 'Ranchi' },
  { district: 'Surat', state: 'Gujarat', city: 'Surat' },
  { district: 'Thiruvananthapuram', state: 'Kerala', city: 'Thiruvananthapuram' },
  { district: 'Udaipur', state: 'Rajasthan', city: 'Udaipur' },
  { district: 'Vadodara', state: 'Gujarat', city: 'Vadodara' },
  { district: 'Varanasi', state: 'Uttar Pradesh', city: 'Varanasi' },
  { district: 'Vijayawada', state: 'Andhra Pradesh', city: 'Vijayawada' },
  { district: 'Visakhapatnam', state: 'Andhra Pradesh', city: 'Visakhapatnam' }
];

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));
const formatDate = value => value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`)) : '—';
const formatMoney = (value, currency = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value || 0));
const showMessage = (selector, message, isError = false) => {
  const element = document.querySelector(selector);
  if (!element) return;
  element.textContent = message;
  element.classList.toggle('error-message', isError);
};

async function loadAccount() {
  if (!supabaseClient) return null;
  const accountLink = document.querySelector('[data-account-link]');
  try {
    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
    if (sessionError) throw sessionError;
    signedInUser = session?.user || null;
    if (!signedInUser) {
      if (pageRole === 'lister') showMessage('#dashboard-message', 'Sign in with your lister account to view and manage your own dashboard.');
      return null;
    }
    const { data: profile, error } = await supabaseClient.from('profiles').select('full_name, role').eq('id', signedInUser.id).maybeSingle();
    if (error) throw error;
    signedInProfile = profile;
    if (!profile) throw new Error('Your profile is missing. Run the Wayfarer setup SQL in Supabase.');
    const displayName = profile.full_name || signedInUser.email || 'Wayfarer member';
    const userName = document.querySelector('#user-name');
    const initials = document.querySelector('#user-initials');
    if (userName) userName.textContent = displayName;
    if (initials) initials.textContent = displayName.trim().charAt(0).toUpperCase();
    const welcomeName = document.querySelector('#welcome-name');
    if (welcomeName) welcomeName.textContent = displayName.trim().split(/\s+/)[0];
    if (accountLink) {
      accountLink.textContent = 'Sign out';
      accountLink.href = '#sign-out';
      accountLink.addEventListener('click', async event => {
        event.preventDefault();
        await supabaseClient.auth.signOut();
        window.location.replace('index.html');
      });
    }
    if (profile.role !== pageRole) {
      if (pageRole === 'lister') window.location.replace('renter-dashboard.html');
      else window.location.replace('lister-dashboard.html');
      return null;
    }
    return session;
  } catch (error) {
    showMessage('#dashboard-message', `Account error: ${error.message}`, true);
    showMessage('#listing-status', `Account error: ${error.message}`, true);
    showMessage('#renter-request-status', `Account error: ${error.message}`, true);
    return null;
  }
}

function renderVehicleCard(vehicle) {
  const imageUrl = /^https?:\/\//i.test(vehicle.image_url || '') ? vehicle.image_url : '';
  const image = imageUrl
    ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(vehicle.title)}" loading="lazy">`
    : '';
  return `<article class="vehicle-card" data-type="${escapeHtml(vehicle.vehicle_type)}" data-search="${escapeHtml(`${vehicle.title} ${vehicle.vehicle_type} ${vehicle.city}`.toLowerCase())}">
    <div class="vehicle-photo">${image}<span class="tag">${escapeHtml(vehicle.vehicle_type)}</span></div>
    <div class="vehicle-info"><div class="vehicle-title-row"><h3 class="vehicle-title">${escapeHtml(vehicle.title)}</h3></div>
      <p class="vehicle-meta">${escapeHtml(vehicle.city)} · ${escapeHtml(vehicle.description || 'Listed by a Wayfarer owner')}</p>
      <div class="vehicle-bottom"><span class="price">${formatMoney(vehicle.price_per_day)} <small>/ day</small></span><button class="btn-secondary card-action" type="button" data-book-vehicle="${escapeHtml(vehicle.id)}">Request to rent</button></div>
    </div></article>`;
}

const renterLocationAliases = {
  visakhapatnam: ['vishakapatanam', 'vishakhapatnam', 'vizag']
};
const nearbyLocationGroups = [
  ['Mumbai', 'Navi Mumbai', 'Thane', 'Kalyan-Dombivli'],
  ['Pune', 'Pimpri-Chinchwad'],
  ['Delhi', 'New Delhi', 'Noida', 'Gurugram', 'Faridabad', 'Ghaziabad'],
  ['Bengaluru', 'Bangalore'],
  ['Hyderabad', 'Secunderabad'],
  ['Kochi', 'Cochin', 'Ernakulam'],
  ['Mangaluru', 'Mangalore'],
  ['Kolkata', 'Calcutta'],
  ['Chennai', 'Madras']
];
const normalizePlace = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/\b(district|dist|state|india)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
function canonicalPlaceName(value) {
  const normalized = normalizePlace(value);
  const match = Object.entries(renterLocationAliases).find(([canonical, aliases]) =>
    normalizePlace(canonical) === normalized || aliases.some(alias => normalizePlace(alias) === normalized)
  );
  return match ? normalizePlace(match[0]) : normalized;
}
function placeSimilarity(left, right) {
  const a = normalizePlace(left);
  const b = normalizePlace(right);
  if (!a || !b) return 0;
  if (a === b || a.includes(b) || b.includes(a)) return 1;
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const old = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = old;
    }
  }
  return 1 - row[b.length] / Math.max(a.length, b.length);
}
function closePlaceMatch(left, right) {
  const a = canonicalPlaceName(left);
  const b = canonicalPlaceName(right);
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  if (Math.min(a.length, b.length) < 4) return false;
  return placeSimilarity(a, b) >= 0.72;
}
function matchesRenterLocation(vehicleCity, filters) {
  const typedCity = (filters.searchCity || (filters.location || '').split(',')[0].replace(/\s+district$/i, '')).trim();
  if (!typedCity) return true;
  const query = canonicalPlaceName(typedCity);
  const matchedState = renterLocationOptions.filter(place => normalizePlace(place.state) === normalizePlace(typedCity));
  if (matchedState.length) {
    const stateCities = matchedState.flatMap(place => {
      const group = nearbyLocationGroups.find(cities => cities.some(city => closePlaceMatch(city, place.city)));
      return group || [place.city];
    });
    return stateCities.some(city => closePlaceMatch(vehicleCity, city));
  }
  const knownPlace = renterLocationOptions.find(place =>
    [place.city, place.district].some(name => canonicalPlaceName(name) === query)
  );
  let candidateCities = knownPlace ? [knownPlace.city, knownPlace.district] : [typedCity];
  const nearbyGroup = nearbyLocationGroups.find(group => group.some(name =>
    candidateCities.some(candidate => canonicalPlaceName(name) === canonicalPlaceName(candidate)) || canonicalPlaceName(name) === query
  ));
  if (nearbyGroup) candidateCities = [...candidateCities, ...nearbyGroup];
  return candidateCities.some(candidate => closePlaceMatch(vehicleCity, candidate));
}
async function loadRenterVehicles(filters = {}) {
  const grid = document.querySelector('#vehicle-grid');
  const status = document.querySelector('#listing-status');
  if (!grid || !supabaseClient) return;
  status.classList.remove('error-message');
  status.textContent = 'Loading published vehicles…';
  try {
    const { data, error } = await supabaseClient.from('vehicles')
      .select('id, owner_id, title, vehicle_type, city, price_per_day, description, image_url')
      .eq('is_active', true).order('created_at', { ascending: false });
    if (error) throw error;
    const typedCity = (filters.searchCity || (filters.location || '').split(',')[0].replace(/\s+district$/i, '')).trim();
    const hasSearchFilters = Boolean(typedCity || (filters.type && filters.type !== 'all'));
    const matchingVehicles = (data || []).filter(vehicle => {
      const locationMatches = matchesRenterLocation(vehicle.city, filters);
      const vehicleType = vehicle.vehicle_type;
      const typeMatches = !filters.type || filters.type === 'all' || vehicleType === filters.type ||
        (filters.type === 'Bike' && vehicleType === 'Motorcycle') ||
        (filters.type === 'Small Truck' && vehicleType === 'Van');
      return locationMatches && typeMatches;
    });
    const requestedLocation = (filters.location || typedCity).trim();
    const matchedCities = [...new Set(matchingVehicles.map(vehicle => vehicle.city).filter(Boolean))];
    const typeLabel = filters.type && filters.type !== 'all' ? filters.type : 'vehicle';
    grid.innerHTML = matchingVehicles.length
      ? matchingVehicles.map(renderVehicleCard).join('')
      : `<div class="vehicle-empty">${hasSearchFilters
        ? `No ${escapeHtml(typeLabel)} listings found${typedCity ? ` near ${escapeHtml(requestedLocation)}` : ''}. Try a nearby city or district, or change the vehicle type.`
        : 'No vehicles have been published yet. Check back soon.'}</div>`;
    if (matchingVehicles.length && typedCity) {
      const matchedLabel = matchedCities.length === 1 ? matchedCities[0] : matchedCities.join(', ');
      status.textContent = `Found ${matchingVehicles.length} ${matchingVehicles.length === 1 ? 'listing' : 'listings'} for ${requestedLocation}. Matched listing location${matchedCities.length === 1 ? '' : 's'}: ${matchedLabel}. Nearby cities and spelling variants may be included.`;
    } else if (matchingVehicles.length && hasSearchFilters) {
      status.textContent = `${matchingVehicles.length} ${typeLabel.toLowerCase()} ${matchingVehicles.length === 1 ? 'listing' : 'listings'} match your filters.`;
    } else if (matchingVehicles.length) {
      status.textContent = `${matchingVehicles.length} available ${matchingVehicles.length === 1 ? 'vehicle is' : 'vehicles are'} currently published by listers.`;
    } else if (hasSearchFilters) {
      status.textContent = `No ${typeLabel.toLowerCase()} listings matched${typedCity ? ` ${requestedLocation}` : ' those filters'}. Try a nearby city or district, or change the vehicle type.`;
    } else {
      status.textContent = 'No published vehicles yet. Check back soon.';
    }
    status.classList.remove('error-message');
    attachRentalRequestFlow(matchingVehicles);
    if (hasSearchFilters) document.querySelector('#results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    status.textContent = `Could not load published vehicles: ${error.message}. Confirm that the rentals setup SQL has been run.`;
    status.classList.add('error-message');
  }
}
function attachLocationSuggestions() {
  const input = document.querySelector('#search-location');
  const wrapper = document.querySelector('.location-autocomplete');
  const menu = document.querySelector('#location-suggestions');
  if (!input || !wrapper || !menu) return;

  const closeMenu = () => {
    menu.hidden = true;
    input.setAttribute('aria-expanded', 'false');
  };
  const showMatches = () => {
    const typedLocation = input.value.trim();
    const query = typedLocation.toLocaleLowerCase();
    if (!query) return closeMenu();
    const matches = renterLocationOptions.filter(location =>
      `${location.district} ${location.state} ${location.city} ${(renterLocationAliases[normalizePlace(location.city)] || []).join(' ')} India`.toLocaleLowerCase().includes(query)
    ).slice(0, 8);
    const exactLocation = renterLocationOptions.some(location =>
      `${location.district} district, ${location.state}, India`.toLocaleLowerCase() === query ||
      location.district.toLocaleLowerCase() === query || location.city.toLocaleLowerCase() === query
    );
    const placeOptions = matches.map((location, index) => {
      const label = `${location.district} district, ${location.state}, India`;
      return `<button type="button" class="location-option" id="location-option-${index}" role="option" aria-selected="false" data-label="${escapeHtml(label)}" data-city-search="${escapeHtml(location.city)}"><span class="location-option-pin">⌖</span><span>${escapeHtml(label)}</span></button>`;
    }).join('');
    const typedCity = typedLocation.split(',')[0].replace(/\s+district$/i, '').trim();
    const customOption = exactLocation ? '' : `<button type="button" class="location-option" role="option" aria-selected="false" data-label="${escapeHtml(typedLocation)}" data-city-search="${escapeHtml(typedCity)}"><span class="location-option-pin">⌕</span><span>Search for “${escapeHtml(typedLocation)}”</span></button>`;
    menu.innerHTML = placeOptions + customOption;
    menu.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  };
  input.addEventListener('input', () => {
    delete input.dataset.searchCity;
    showMatches();
  });
  input.addEventListener('focus', showMatches);
  input.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown' && !menu.hidden) {
      event.preventDefault();
      menu.querySelector('.location-option')?.focus();
    } else if (event.key === 'Escape') closeMenu();
  });
  menu.addEventListener('click', event => {
    const option = event.target.closest('[data-city-search]');
    if (!option) return;
    input.value = option.dataset.label;
    input.dataset.searchCity = option.dataset.citySearch;
    closeMenu();
    input.focus();
  });
  menu.addEventListener('keydown', event => {
    const options = [...menu.querySelectorAll('.location-option')];
    const index = options.indexOf(document.activeElement);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      options[Math.min(index + 1, options.length - 1)]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (index <= 0) input.focus();
      else options[index - 1]?.focus();
    } else if (event.key === 'Escape') {
      closeMenu();
      input.focus();
    }
  });
  document.addEventListener('click', event => {
    if (!wrapper.contains(event.target)) closeMenu();
  });
}
function attachVehicleFilters() {
  const today = new Date().toISOString().slice(0, 10);
  document.querySelectorAll('#pickup-date, #return-date').forEach(input => input.min = today);
  attachLocationSuggestions();

  document.querySelector('#vehicle-search')?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    const pickupDate = document.querySelector('#pickup-date').value;
    const returnDate = document.querySelector('#return-date').value;
    if (returnDate <= pickupDate) {
      showMessage('#listing-status', 'Choose a return date after the pick-up date.', true);
      return;
    }
    await loadRenterVehicles({
      location: document.querySelector('#search-location').value,
      searchCity: document.querySelector('#search-location').dataset.searchCity,
      type: document.querySelector('#vehicle-type-filter').value,
      pickupDate,
      returnDate
    });
  });
}
function attachRentalRequestFlow(vehicles) {
  const dialog = document.querySelector('#rental-dialog');
  const form = document.querySelector('#rental-form');
  if (!dialog || !form) return;
  const byId = new Map(vehicles.map(vehicle => [vehicle.id, vehicle]));
  const grid = document.querySelector('#vehicle-grid');
  const today = new Date().toISOString().slice(0, 10);
  ['#pickup-date', '#return-date', '#request-pickup-date', '#request-return-date'].forEach(selector => {
    const field = document.querySelector(selector);
    if (field) field.min = today;
  });
  grid.onclick = event => {
    const button = event.target.closest('[data-book-vehicle]');
    if (!button) return;
    const vehicle = byId.get(button.dataset.bookVehicle);
    if (!vehicle) return;
    if (!signedInUser) {
      showMessage('#listing-status', 'Please sign in with your renter account before sending a rental request.');
      return;
    }
    document.querySelector('#request-vehicle-id').value = vehicle.id;
    document.querySelector('#request-lister-id').value = vehicle.owner_id;
    document.querySelector('#request-vehicle-name').textContent = `${vehicle.title} · ${vehicle.city} · ${formatMoney(vehicle.price_per_day)} per day`;
    document.querySelector('#request-pickup-date').value = document.querySelector('#pickup-date').value;
    document.querySelector('#request-return-date').value = document.querySelector('#return-date').value;
    document.querySelector('#rental-form-status').textContent = '';
    dialog.showModal();
  };
  document.querySelectorAll('[data-close-rental]').forEach(button => button.onclick = () => dialog.close());
  form.onsubmit = async event => {
    event.preventDefault();
    const status = document.querySelector('#rental-form-status');
    const setRentalStatus = (message, isError = false) => {
      status.textContent = message;
      status.classList.toggle('error-message', isError);
    };
    setRentalStatus('');
    const pickupDate = document.querySelector('#request-pickup-date').value;
    const returnDate = document.querySelector('#request-return-date').value;
    if (returnDate <= pickupDate) {
      setRentalStatus('Choose a return date after the pick-up date.', true);
      return;
    }
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
      setRentalStatus('Your sign-in expired. Sign in again to send this request.', true);
      return;
    }
    const vehicle = byId.get(document.querySelector('#request-vehicle-id').value);
    if (!vehicle) {
      setRentalStatus('This listing is no longer available. Search again for current vehicles.', true);
      return;
    }
    setRentalStatus('Sending your request…');
    const { error } = await supabaseClient.from('rental_requests').insert({
      vehicle_id: vehicle.id,
      renter_id: session.user.id,
      lister_id: vehicle.owner_id,
      renter_name: signedInProfile?.full_name || session.user.email || 'Renter',
      renter_message: document.querySelector('#request-message').value.trim(),
      pickup_date: pickupDate,
      return_date: returnDate,
      pickup_location: document.querySelector('#request-pickup-location').value.trim(),
      destination: document.querySelector('#request-destination').value.trim()
    });
    if (error) {
      setRentalStatus(`Could not send request: ${error.message}`, true);
      return;
    }
    form.reset();
    dialog.close();
    showMessage('#listing-status', 'Your request was sent to the lister. Track its status from Sent requests in the menu.');
  };
}
function renderRequestRecord(request, includeActions = false, allowRenterDelete = false) {
  const vehicle = request.vehicle || {};
  const status = request.status || 'pending';
  return `<article class="record-card" data-request-card="${escapeHtml(request.id)}"><div class="record-head"><div><h3>${escapeHtml(vehicle.title || 'Vehicle rental')}</h3><p class="record-subtitle">${escapeHtml(request.renter_name || 'Renter')} · ${escapeHtml(vehicle.city || request.pickup_location || '')}</p></div><span class="record-status ${escapeHtml(status)}">${escapeHtml(status)}</span></div>
    <div class="record-details"><div class="record-detail"><span>Rental dates</span><strong>${formatDate(request.pickup_date)} – ${formatDate(request.return_date)}</strong></div><div class="record-detail"><span>Pickup location</span><strong>${escapeHtml(request.pickup_location)}</strong></div><div class="record-detail"><span>Destination</span><strong>${escapeHtml(request.destination)}</strong></div><div class="record-detail"><span>Request sent</span><strong>${formatDate(request.created_at?.slice(0, 10))}</strong></div></div>
    ${request.renter_message ? `<p class="record-message">${escapeHtml(request.renter_message)}</p>` : ''}
    ${includeActions && status === 'pending' ? `<div class="record-actions"><button type="button" data-request-action="declined" data-request-id="${escapeHtml(request.id)}">Decline</button><button type="button" class="accept-action" data-request-action="accepted" data-request-id="${escapeHtml(request.id)}">Accept request</button></div>` : ''}
    ${allowRenterDelete && ['pending', 'declined', 'cancelled'].includes(status) ? `<div class="record-actions renter-request-actions"><button type="button" class="delete-request-action" data-delete-rental-request="${escapeHtml(request.id)}">Delete request</button></div>` : ''}
    ${status === 'accepted' ? `<div class="record-actions accepted-chat-actions"><a class="record-chat-link" href="${pageRole === 'renter' ? 'renter-messages.html' : 'lister-messages.html'}?request=${encodeURIComponent(request.id)}">Chat with ${pageRole === 'renter' ? 'lister' : 'renter'} →</a></div>` : ''}</article>`;
}

function renderConversation(request) {
  const vehicle = request.vehicle || {};
  const contact = pageRole === 'renter' ? 'Vehicle owner' : (request.renter_name || 'Renter');
  return `<section class="chat-window" aria-label="Chat with ${escapeHtml(contact)}">
    <header class="chat-window-header"><button class="chat-back-button" type="button" data-back-to-chats aria-label="Back to conversations">←</button><span class="chat-avatar">${escapeHtml(contact.trim().charAt(0).toUpperCase() || 'W')}</span><div class="chat-contact"><h2>${escapeHtml(contact)}</h2><p>${escapeHtml(vehicle.title || 'Confirmed rental')} · ${escapeHtml(vehicle.city || request.pickup_location || '')}</p></div><span class="chat-confirmed">CONFIRMED</span></header>
    <div class="chat-trip-context"><span><strong>${formatDate(request.pickup_date)} – ${formatDate(request.return_date)}</strong> · rental dates</span><span>Pickup: ${escapeHtml(request.pickup_location || '—')}</span></div>
    <div class="chat-messages" data-chat-messages="${escapeHtml(request.id)}" aria-live="polite"><p class="chat-empty">Loading conversation…</p></div>
    <form class="chat-compose" data-chat-form="${escapeHtml(request.id)}"><label class="sr-only" for="chat-message-${escapeHtml(request.id)}">Your message</label><textarea id="chat-message-${escapeHtml(request.id)}" name="message" maxlength="2000" rows="2" placeholder="Write a message…" required></textarea><button class="btn-primary" type="submit" aria-label="Send message">Send <span aria-hidden="true">➤</span></button></form>
    <p class="chat-status" data-chat-status="${escapeHtml(request.id)}" aria-live="polite"></p>
  </section>`;
}

async function loadConversation(requestId) {
  const messagesElement = document.querySelector(`[data-chat-messages="${CSS.escape(requestId)}"]`);
  if (!messagesElement) return;
  const followLatest = messagesElement.scrollHeight - messagesElement.clientHeight - messagesElement.scrollTop < 48;
  const { data, error } = await supabaseClient.from('rental_messages')
    .select('id, sender_id, message, created_at').eq('request_id', requestId).order('created_at', { ascending: true });
  if (error) throw error;
  messagesElement.innerHTML = data?.length ? data.map(message => {
    const mine = message.sender_id === signedInUser.id;
    const time = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(message.created_at));
    return `<article class="chat-message ${mine ? 'mine' : 'theirs'}"><p>${escapeHtml(message.message)}</p><time>${mine ? 'You' : (pageRole === 'renter' ? 'Lister' : 'Renter')} · ${escapeHtml(time)}</time></article>`;
  }).join('') : '<p class="chat-empty">No messages yet. Say hello and coordinate your confirmed trip.</p>';
  if (followLatest) messagesElement.scrollTop = messagesElement.scrollHeight;
  const latestMessage = data?.[data.length - 1];
  const preview = document.querySelector(`[data-conversation-item="${CSS.escape(requestId)}"] .conversation-preview`);
  const previewTime = document.querySelector(`[data-conversation-item="${CSS.escape(requestId)}"] .conversation-time`);
  if (preview && latestMessage) preview.textContent = latestMessage.message;
  if (previewTime && latestMessage) previewTime.textContent = new Intl.DateTimeFormat('en-IN', { month: 'short', day: 'numeric' }).format(new Date(latestMessage.created_at));
}

function showChatStatus(requestId, message, isError = false) {
  const status = document.querySelector(`[data-chat-status="${CSS.escape(requestId)}"]`);
  if (!status) return;
  status.textContent = message;
  status.classList.toggle('error-message', isError);
}

async function selectConversation(requestId) {
  const request = messageRequests.find(item => item.id === requestId);
  const panel = document.querySelector('#chat-panel');
  const list = document.querySelector('#messages-conversations');
  if (!request || !panel || !list) return;
  activeConversationId = requestId;
  document.querySelector('.messages-workspace')?.classList.add('has-active-chat');
  list.querySelectorAll('[data-select-conversation]').forEach(button => {
    const selected = button.dataset.selectConversation === requestId;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-current', selected ? 'true' : 'false');
  });
  panel.innerHTML = renderConversation(request);
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set('request', requestId);
  window.history.replaceState({}, '', nextUrl);
  try { await loadConversation(requestId); }
  catch (error) { showChatStatus(requestId, `Could not load messages: ${error.message}`, true); }
  if (conversationRefreshTimer) window.clearInterval(conversationRefreshTimer);
  let refreshInProgress = false;
  conversationRefreshTimer = window.setInterval(async () => {
    if (activeConversationId !== requestId || document.visibilityState !== 'visible' || refreshInProgress || !document.querySelector('.messages-workspace')?.classList.contains('has-active-chat')) return;
    refreshInProgress = true;
    try { await loadConversation(requestId); }
    catch (error) { showChatStatus(requestId, `Could not refresh messages: ${error.message}`, true); }
    finally { refreshInProgress = false; }
  }, 5000);
}

function attachMessagesDashboardHandlers(list, panel) {
  list.addEventListener('click', event => {
    const item = event.target.closest('[data-select-conversation]');
    if (item) selectConversation(item.dataset.selectConversation);
  });
  list.querySelector('#conversation-search')?.addEventListener('input', event => {
    const query = event.target.value.trim().toLowerCase();
    list.querySelectorAll('[data-conversation-item]').forEach(item => { item.hidden = !item.dataset.search.includes(query); });
  });
  panel.addEventListener('submit', async event => {
    const form = event.target.closest('[data-chat-form]');
    if (!form) return;
    event.preventDefault();
    const requestId = form.dataset.chatForm;
    const textarea = form.elements.message;
    const message = textarea.value.trim();
    if (!message) return;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    showChatStatus(requestId, 'Sending…');
    try {
      const { error } = await supabaseClient.from('rental_messages').insert({ request_id: requestId, sender_id: signedInUser.id, message });
      if (error) throw error;
      textarea.value = '';
      showChatStatus(requestId, 'Message sent.');
      await loadConversation(requestId);
      textarea.focus();
    } catch (error) { showChatStatus(requestId, `Could not send message: ${error.message}`, true); }
    finally { button.disabled = false; }
  });
  panel.addEventListener('click', event => {
    if (!event.target.closest('[data-back-to-chats]')) return;
    document.querySelector('.messages-workspace')?.classList.remove('has-active-chat');
  });
}

async function loadRenterRequests(userId) {
  const list = document.querySelector('#renter-trips-list');
  const status = document.querySelector('#renter-request-status');
  if (!list || !userId) return;
  status.classList.remove('error-message');
  try {
    const { data, error } = await supabaseClient.from('rental_requests')
      .select('id, renter_name, renter_message, pickup_date, return_date, pickup_location, destination, status, created_at, vehicle:vehicles!rental_requests_vehicle_id_fkey(title, city)')
      .eq('renter_id', userId).order('created_at', { ascending: false });
    if (error) throw error;
    list.innerHTML = data?.length
      ? data.map(request => renderRequestRecord(request, false, ['pending', 'declined', 'cancelled'].includes(request.status))).join('')
      : '<div class="vehicle-empty">You have not sent any rental requests yet.</div>';
    status.textContent = data?.length ? 'Your requests are shown here. Open chat on accepted rentals to message the lister.' : '';
    list.onclick = async event => {
      const button = event.target.closest('[data-delete-rental-request]');
      if (!button) return;
      if (!window.confirm('Delete this rental request? This cannot be undone.')) return;
      button.disabled = true;
      try {
        const { error: deleteError } = await supabaseClient.from('rental_requests').delete()
          .eq('id', button.dataset.deleteRentalRequest).eq('renter_id', userId).in('status', ['pending', 'declined', 'cancelled']);
        if (deleteError) throw deleteError;
        await loadRenterRequests(userId);
      } catch (error) {
        button.disabled = false;
        status.textContent = `Could not delete the request: ${error.message}`;
        status.classList.add('error-message');
      }
    };
  } catch (error) {
    status.textContent = `Could not load your requests: ${error.message}`;
    status.classList.add('error-message');
  }
}
function renderListerVehicle(vehicle) {
  const imageUrl = /^https?:\/\//i.test(vehicle.image_url || '') ? vehicle.image_url : '';
  const image = imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(vehicle.title)}" loading="lazy" onerror="this.parentElement.classList.remove('has-photo');this.parentElement.classList.add('missing-photo')">` : '';
  const photoState = image ? 'has-photo' : 'missing-photo';
  const photoControl = `<label class="photo-repair">${image ? 'Replace photo' : 'Add vehicle photo'}<input type="file" data-replace-photo="${escapeHtml(vehicle.id)}" accept="image/jpeg,image/png,image/webp,image/avif" aria-label="Choose photo for ${escapeHtml(vehicle.title)}"></label>`;
  return `<article class="listing-card" data-listing-card="${escapeHtml(vehicle.id)}" tabindex="0" aria-label="Manage ${escapeHtml(vehicle.title)} listing"><div class="listing-image ${photoState}">${image}<span class="listing-status active-status">PUBLISHED</span>${photoControl}</div><div class="listing-card-body"><div class="listing-card-title"><div><h3>${escapeHtml(vehicle.title)}</h3><p>${escapeHtml(vehicle.vehicle_type)} · ${escapeHtml(vehicle.city)}</p></div><span class="listing-price">${formatMoney(vehicle.price_per_day)}<small> / day</small></span></div><p class="record-message">${escapeHtml(vehicle.description || '')}</p></div></article>`;
}

async function loadListerListings() {
  const grid = document.querySelector('#listing-grid');
  const { data, error } = await supabaseClient.from('vehicles').select('*').eq('owner_id', signedInUser.id).order('created_at', { ascending: false });
  if (error) throw error;
  const vehicles = data || [];
  grid.innerHTML = vehicles.length ? vehicles.map(renderListerVehicle).join('') : '<div class="vehicle-empty">You have not published a vehicle yet. Select “List your vehicle” to create your first listing. No sample vehicles are shown.</div>';
  showMessage('#dashboard-message', vehicles.length ? `${vehicles.length} published ${vehicles.length === 1 ? 'vehicle' : 'vehicles'} in your account.` : 'Your listings will appear here after you publish them.');

  const dialog = document.querySelector('#vehicle-dialog');
  const form = document.querySelector('#vehicle-form');
  const formStatus = document.querySelector('#vehicle-form-status');
  const actionDialog = document.querySelector('#listing-actions-dialog');
  const actionsTitle = document.querySelector('#listing-actions-title');
  let selectedListing = null;

  document.querySelectorAll('[data-open-vehicle]').forEach(button => button.onclick = () => {
    form.reset();
    form.dataset.vehicleId = '';
    form.dataset.imageUrl = '';
    formStatus.textContent = '';
    form.querySelector('[type="submit"]').textContent = 'Publish listing';
    dialog.showModal();
  });
  document.querySelectorAll('[data-close-dialog]').forEach(button => button.onclick = () => dialog.close());
  document.querySelectorAll('[data-close-actions]').forEach(button => button.onclick = () => actionDialog.close());

  form.onsubmit = async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const submitButton = form.querySelector('[type="submit"]');
    const vehicleId = form.dataset.vehicleId || '';
    const imageFile = document.querySelector('#vehicle-image').files[0] || null;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
    if (imageFile && !allowedTypes.includes(imageFile.type)) {
      formStatus.textContent = 'Choose a JPG, PNG, WebP, or AVIF image.';
      return;
    }
    if (imageFile && imageFile.size > 5 * 1024 * 1024) {
      formStatus.textContent = 'The image must be 5 MB or smaller.';
      return;
    }

    const controller = new AbortController();
    let timeoutId;
    let uploadedImagePath = null;
    formStatus.textContent = imageFile ? 'Uploading vehicle photo…' : vehicleId ? 'Saving changes…' : 'Publishing…';
    submitButton.disabled = true;
    submitButton.textContent = vehicleId ? 'Saving…' : 'Publishing…';
    try {
      let imageUrl = form.dataset.imageUrl || null;
      if (imageFile) {
        const extension = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' })[imageFile.type];
        uploadedImagePath = `${signedInUser.id}/${crypto.randomUUID()}.${extension}`;
        const uploadQuery = supabaseClient.storage.from('vehicle-images').upload(uploadedImagePath, imageFile, {
          cacheControl: '3600', contentType: imageFile.type, upsert: false
        });
        const uploadTimeout = new Promise((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('Photo upload timed out. Check your connection and try again.')), 30000);
        });
        const { error: uploadError } = await Promise.race([uploadQuery, uploadTimeout]);
        clearTimeout(timeoutId);
        if (uploadError) throw uploadError;
        imageUrl = supabaseClient.storage.from('vehicle-images').getPublicUrl(uploadedImagePath).data.publicUrl;
      }

      formStatus.textContent = vehicleId ? 'Saving changes…' : 'Publishing…';
      const vehicleData = {
        owner_id: signedInUser.id,
        title: document.querySelector('#vehicle-title').value.trim(),
        vehicle_type: document.querySelector('#vehicle-type').value,
        city: document.querySelector('#vehicle-city').value.trim(),
        price_per_day: Number(document.querySelector('#vehicle-price').value),
        image_url: imageUrl,
        description: document.querySelector('#vehicle-description').value.trim(),
        is_active: true
      };
      const writeQuery = (vehicleId
        ? supabaseClient.from('vehicles').update(vehicleData).eq('id', vehicleId).eq('owner_id', signedInUser.id)
        : supabaseClient.from('vehicles').insert(vehicleData)).abortSignal(controller.signal);
      const writeTimeout = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          controller.abort();
          reject(new Error('The request took too long. Check your connection and try again.'));
        }, 30000);
      });
      const { error: writeError } = await Promise.race([writeQuery, writeTimeout]);
      clearTimeout(timeoutId);
      if (writeError) throw writeError;

      form.reset();
      form.dataset.vehicleId = '';
      form.dataset.imageUrl = '';
      submitButton.textContent = 'Publish listing';
      dialog.close();
      try {
        await loadListerListings();
      } catch (refreshError) {
        showMessage('#dashboard-message', `Listing saved, but the list could not refresh: ${refreshError.message}`, true);
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (uploadedImagePath) await supabaseClient.storage.from('vehicle-images').remove([uploadedImagePath]).catch(() => {});
      formStatus.textContent = `Could not save listing: ${error.message || 'Please try again.'}`;
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = form.dataset.vehicleId ? 'Save changes' : 'Publish listing';
    }
  };

  const openActionsFor = card => {
    selectedListing = vehicles.find(vehicle => vehicle.id === card.dataset.listingCard) || null;
    if (!selectedListing) return;
    actionsTitle.textContent = selectedListing.title;
    actionDialog.showModal();
  };
  grid.onclick = event => {
    if (event.target.closest('.photo-repair')) return;
    const card = event.target.closest('[data-listing-card]');
    if (card) openActionsFor(card);
  };
  grid.onkeydown = event => {
    if (event.target.matches('[data-listing-card]') && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      openActionsFor(event.target);
    }
  };
  document.querySelector('[data-edit-listing]').onclick = () => {
    if (!selectedListing) return;
    form.reset();
    form.dataset.vehicleId = selectedListing.id;
    form.dataset.imageUrl = /^https?:\/\//i.test(selectedListing.image_url || '') ? selectedListing.image_url : '';
    document.querySelector('#vehicle-title').value = selectedListing.title || '';
    document.querySelector('#vehicle-type').value = selectedListing.vehicle_type || 'Car';
    document.querySelector('#vehicle-city').value = selectedListing.city || '';
    document.querySelector('#vehicle-price').value = selectedListing.price_per_day || '';
    document.querySelector('#vehicle-description').value = selectedListing.description || '';
    formStatus.textContent = form.dataset.imageUrl ? 'Leave the photo empty to keep the current image, or choose a new one.' : 'This listing has no uploaded photo yet. Choose one here if you want to add it.';
    form.querySelector('[type="submit"]').textContent = 'Save changes';
    actionDialog.close();
    dialog.showModal();
  };
  document.querySelector('[data-delete-listing]').onclick = async event => {
    if (!selectedListing) return;
    const listing = selectedListing;
    if (!window.confirm(`Delete “${listing.title}”? This also removes its rental request history and cannot be undone.`)) return;
    const button = event.currentTarget;
    button.disabled = true;
    try {
      showMessage('#dashboard-message', 'Deleting listing…');
      const { error: deleteError } = await supabaseClient.from('vehicles').delete()
        .eq('id', listing.id).eq('owner_id', signedInUser.id);
      if (deleteError) throw deleteError;
      actionDialog.close();
      selectedListing = null;
      await loadListerListings();
    } catch (error) {
      showMessage('#dashboard-message', `Could not delete listing: ${error.message || 'Please try again.'}`, true);
    } finally {
      button.disabled = false;
    }
  };

  grid.onchange = async event => {
    const input = event.target.closest('[data-replace-photo]');
    const imageFile = input?.files?.[0];
    if (!input || !imageFile) return;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
    if (!allowedTypes.includes(imageFile.type) || imageFile.size > 5 * 1024 * 1024) {
      showMessage('#dashboard-message', 'Choose a JPG, PNG, WebP, or AVIF image up to 5 MB.', true);
      input.value = '';
      return;
    }
    input.disabled = true;
    let imagePath = null;
    try {
      showMessage('#dashboard-message', 'Uploading vehicle photo…');
      const extension = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' })[imageFile.type];
      imagePath = `${signedInUser.id}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabaseClient.storage.from('vehicle-images').upload(imagePath, imageFile, {
        cacheControl: '3600', contentType: imageFile.type, upsert: false
      });
      if (uploadError) throw uploadError;
      const imageUrl = supabaseClient.storage.from('vehicle-images').getPublicUrl(imagePath).data.publicUrl;
      const { error: updateError } = await supabaseClient.from('vehicles').update({ image_url: imageUrl })
        .eq('id', input.dataset.replacePhoto).eq('owner_id', signedInUser.id);
      if (updateError) throw updateError;
      await loadListerListings();
    } catch (error) {
      if (imagePath) await supabaseClient.storage.from('vehicle-images').remove([imagePath]).catch(() => {});
      showMessage('#dashboard-message', `Could not upload vehicle photo: ${error.message || 'Please try again.'}`, true);
      input.disabled = false;
      input.value = '';
    }
  };
}
async function loadListerRequests() {
  const list = document.querySelector('#requests-list');
  const { data, error } = await supabaseClient.from('rental_requests')
    .select('id, renter_name, renter_message, pickup_date, return_date, pickup_location, destination, status, created_at, vehicle:vehicles!rental_requests_vehicle_id_fkey(title, city)')
    .eq('lister_id', signedInUser.id).order('created_at', { ascending: false });
  if (error) throw error;
  list.innerHTML = data?.length ? data.map(request => renderRequestRecord(request, true)).join('') : '<div class="vehicle-empty">No renter requests yet. Requests for your published vehicles will appear here.</div>';
  showMessage('#dashboard-message', data?.length ? `${data.filter(request => request.status === 'pending').length} pending request(s). Review the requested dates and pickup place before responding.` : 'When a renter requests one of your vehicles, the request will appear here.');
  list.onclick = async event => {
    const button = event.target.closest('[data-request-action]');
    if (!button) return;
    button.disabled = true;
    const { error: updateError } = await supabaseClient.from('rental_requests').update({ status: button.dataset.requestAction })
      .eq('id', button.dataset.requestId).eq('lister_id', signedInUser.id).eq('status', 'pending');
    if (updateError) {
      button.disabled = false;
      const overlappingRental = updateError.code === '23P01' || /overlapping dates/i.test(updateError.message || '');
      showMessage('#dashboard-message', overlappingRental
        ? 'This vehicle is already confirmed for some of those dates. Refresh the requests and choose another booking.'
        : `Could not update the request: ${updateError.message}`, true);
      return;
    }
    await loadListerRequests();
  };
}

async function loadListerTrips() {
  const list = document.querySelector('#trips-list');
  const { data, error } = await supabaseClient.from('rental_requests')
    .select('id, renter_name, renter_message, pickup_date, return_date, pickup_location, destination, status, created_at, vehicle:vehicles!rental_requests_vehicle_id_fkey(title, city)')
    .eq('lister_id', signedInUser.id).eq('status', 'accepted').order('pickup_date', { ascending: true });
  if (error) throw error;
  list.innerHTML = data?.length ? data.map(request => renderRequestRecord(request)).join('') : '<div class="vehicle-empty">No accepted rentals yet. When you accept a renter request, it will appear here.</div>';
  showMessage('#dashboard-message', data?.length ? `${data.length} accepted rental(s).` : 'Only requests you accept are shown on this page.');
}

function renderConversationListItem(request, latestMessage, selectedRequestId) {
  const vehicle = request.vehicle || {};
  const contact = pageRole === 'renter' ? 'Vehicle owner' : (request.renter_name || 'Renter');
  const detail = [vehicle.title, vehicle.city].filter(Boolean).join(' · ') || 'Confirmed rental';
  const preview = latestMessage?.message || 'Start a conversation about this trip';
  const time = latestMessage?.created_at
    ? new Intl.DateTimeFormat('en-IN', { month: 'short', day: 'numeric' }).format(new Date(latestMessage.created_at))
    : '';
  const searchable = `${contact} ${detail} ${request.pickup_location || ''}`.toLowerCase();
  return `<button class="conversation-list-item${request.id === selectedRequestId ? ' is-selected' : ''}" type="button" data-select-conversation="${escapeHtml(request.id)}" data-conversation-item="${escapeHtml(request.id)}" data-search="${escapeHtml(searchable)}" aria-current="${request.id === selectedRequestId}"><span class="conversation-avatar">${escapeHtml(contact.trim().charAt(0).toUpperCase() || 'W')}</span><span class="conversation-list-copy"><span class="conversation-list-top"><strong>${escapeHtml(contact)}</strong><time class="conversation-time">${escapeHtml(time)}</time></span><span class="conversation-list-detail">${escapeHtml(detail)}</span><span class="conversation-preview">${escapeHtml(preview)}</span></span></button>`;
}

async function loadMessagesDashboard() {
  const list = document.querySelector('#messages-conversations');
  const panel = document.querySelector('#chat-panel');
  const participantColumn = pageRole === 'renter' ? 'renter_id' : 'lister_id';
  const { data, error } = await supabaseClient.from('rental_requests')
    .select('id, renter_name, renter_message, pickup_date, return_date, pickup_location, destination, status, created_at, vehicle:vehicles!rental_requests_vehicle_id_fkey(title, city)')
    .eq(participantColumn, signedInUser.id).eq('status', 'accepted').order('pickup_date', { ascending: true });
  if (error) throw error;
  messageRequests = data || [];
  const previews = await Promise.all(messageRequests.map(async request => {
    const result = await supabaseClient.from('rental_messages').select('message, created_at')
      .eq('request_id', request.id).order('created_at', { ascending: false }).limit(1);
    if (result.error) throw result.error;
      return [request.id, result.data?.[0] || null];
  }));
  const previewByRequest = new Map(previews);
  messageRequests.sort((a, b) => {
    const aTime = new Date(previewByRequest.get(a.id)?.created_at || a.created_at).getTime();
    const bTime = new Date(previewByRequest.get(b.id)?.created_at || b.created_at).getTime();
    return bTime - aTime;
  });
  const requestedId = new URLSearchParams(window.location.search).get('request');
  const selectedRequestId = messageRequests.some(request => request.id === requestedId)
    ? requestedId
    : (window.matchMedia('(min-width: 761px)').matches ? messageRequests[0]?.id : null);
  activeConversationId = null;
  if (conversationRefreshTimer) window.clearInterval(conversationRefreshTimer);
  list.innerHTML = messageRequests.length
    ? `<label class="sr-only" for="conversation-search">Search conversations</label><input class="conversation-search" id="conversation-search" type="search" placeholder="Search conversations" autocomplete="off"><div class="conversation-list-items">${messageRequests.map(request => renderConversationListItem(request, previewByRequest.get(request.id), selectedRequestId)).join('')}</div>`
    : '<div class="conversation-list-empty">No confirmed rentals yet. Chats will appear here when a lister accepts a request.</div>';
  const count = document.querySelector('#conversation-count');
  if (count) count.textContent = String(messageRequests.length);
  panel.innerHTML = messageRequests.length
    ? '<div class="chat-placeholder"><span class="chat-placeholder-icon">✉</span><h2>Your conversations</h2><p>Select a rental from the list to start chatting.</p></div>'
    : '<div class="chat-placeholder"><span class="chat-placeholder-icon">✦</span><h2>Your next conversation starts here</h2><p>Once a lister accepts your request, you can coordinate the trip here.</p></div>';
  attachMessagesDashboardHandlers(list, panel);
  showMessage('#dashboard-message', data?.length ? `${data.length} confirmed rental conversation${data.length === 1 ? '' : 's'}. Messages update while a chat is open.` : 'A conversation will appear here after a lister accepts your request.');
  if (selectedRequestId) await selectConversation(selectedRequestId);
}

async function initDashboard() {
  if (!supabaseClient) {
    showMessage('#dashboard-message', 'Supabase did not load. Check the connection and refresh this page.', true);
    showMessage('#listing-status', 'Supabase did not load. Check the connection and refresh this page.', true);
    return;
  }
  const session = await loadAccount();
  if (pageRole === 'renter') {
    if (pageView === 'renter') {
      attachVehicleFilters();
      await loadRenterVehicles();
    }
    if (pageView === 'renter-requests') {
      if (session && signedInProfile?.role === 'renter') await loadRenterRequests(session.user.id);
      else showMessage('#renter-request-status', 'Sign in with your renter account to see sent requests.');
    }
    if (pageView === 'messages') {
      if (session && signedInProfile?.role === 'renter') {
        try { await loadMessagesDashboard(); }
        catch (error) { showMessage('#dashboard-message', `Could not load messages: ${error.message}`, true); }
      }
      else showMessage('#dashboard-message', 'Sign in with your renter account to view messages.');
    }
    return;
  }
  if (!session || signedInProfile?.role !== 'lister') {
    if (pageRole === 'lister' && pageView === 'listings') document.querySelectorAll('[data-open-vehicle]').forEach(button => button.onclick = () => { window.location.href = 'login.html?role=lister'; });
    return;
  }
  try {
    if (pageView === 'listings') await loadListerListings();
    if (pageView === 'requests') await loadListerRequests();
    if (pageView === 'trips') await loadListerTrips();
    if (pageView === 'messages') await loadMessagesDashboard();
  } catch (error) {
    showMessage('#dashboard-message', `Could not load this dashboard: ${error.message}. Check the rentals setup SQL and Supabase policies.`, true);
  }
}
initDashboard();
















