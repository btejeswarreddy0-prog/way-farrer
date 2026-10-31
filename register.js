const supabaseClient = window.wayfarerSupabase;
const params = new URLSearchParams(window.location.search);
const role = params.get('role') === 'lister' ? 'lister' : 'renter';
const chip = document.querySelector('#role-chip');
const nameInput = document.querySelector('#name');
const mobileInput = document.querySelector('#mobile');
const emailInput = document.querySelector('#email');
const passwordInput = document.querySelector('#password');
const confirmInput = document.querySelector('#confirm-password');
const statusMessage = document.querySelector('#status');
const submitButton = document.querySelector('.submit');

chip.dataset.role = role;
chip.textContent = role === 'lister' ? 'Lister account' : 'Renter account';
document.querySelector('#signin-link').href = `login.html?role=${encodeURIComponent(role)}`;

function setStatus(message, kind = '') {
  statusMessage.className = 'status' + (kind ? ` ${kind}` : '');
  statusMessage.textContent = message;
}

document.querySelectorAll('.show-password').forEach(button => button.addEventListener('click', () => {
  const input = document.getElementById(button.dataset.target);
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  button.textContent = show ? 'Hide' : 'Show';
  button.setAttribute('aria-pressed', String(show));
  button.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
}));

document.querySelector('#register-form').addEventListener('submit', async event => {
  const form = event.currentTarget;
  event.preventDefault();
  setStatus('');
  if (!form.reportValidity()) return;
  if (passwordInput.value !== confirmInput.value) {
    setStatus('Those passwords do not match. Please check and try again.', 'error');
    confirmInput.focus();
    return;
  }
  if (window.location.protocol === 'file:') {
    setStatus('Open Wayfarer from http://localhost:5500 so Supabase can authenticate you.', 'error');
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = 'Creating account…';
  try {
    const { data, error } = await supabaseClient.auth.signUp({
      email: emailInput.value.trim(),
      password: passwordInput.value,
      options: {
        data: {
          full_name: nameInput.value.trim(),
          mobile: mobileInput.value.trim(),
          role
        },
        emailRedirectTo: `${window.location.origin}/login.html?role=${encodeURIComponent(role)}`
      }
    });
    if (error) throw error;
    form.reset();
    if (data.session) {
      setStatus('Account created. Opening your dashboard…', 'success');
      window.location.replace(role === 'lister' ? 'lister-dashboard.html' : 'renter-dashboard.html');
    } else {
      setStatus('Account request received. Confirm your email, then sign in. We’ll open the dashboard for your selected role.', 'success');
    }
  } catch (error) {
    setStatus(error.message || 'Registration failed. Please check your details and try again.', 'error');
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = 'Create account <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M3.5 10h12m-5-5 5 5-5 5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
});



