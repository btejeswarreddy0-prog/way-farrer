const supabaseClient = window.wayfarerSupabase;
const params = new URLSearchParams(window.location.search);
let selectedRole = params.get('role') === 'lister' ? 'lister' : 'renter';
const chip = document.querySelector('#role-chip');
const emailInput = document.querySelector('#email');
const passwordInput = document.querySelector('#password');
const statusMessage = document.querySelector('#status');
const submitButton = document.querySelector('.submit');
const resendButton = document.querySelector('#resend-confirmation');

function setStatus(message, kind = '') {
  statusMessage.className = 'status' + (kind ? ` ${kind}` : '');
  statusMessage.textContent = message;
}

function showRole(role) {
  selectedRole = role === 'lister' ? 'lister' : 'renter';
  chip.dataset.role = selectedRole;
  chip.textContent = selectedRole === 'lister' ? 'Lister account' : 'Renter account';
  document.querySelector('#register-link').href = `register.html?role=${encodeURIComponent(selectedRole)}`;
}

async function routeSignedInUser(session) {
  if (!session?.user) return;
  const { data: profile, error } = await supabaseClient.from('profiles')
    .select('full_name, role').eq('id', session.user.id).maybeSingle();
  if (error) throw new Error(`You are signed in, but the profile could not be loaded: ${error.message}`);
  if (!profile) throw new Error('Your account profile is missing. Run the Wayfarer profile setup SQL in Supabase.');
  setStatus(`Email confirmed. Welcome${profile.full_name ? `, ${profile.full_name}` : ''}! Opening your dashboard…`, 'success');
  window.location.replace(profile.role === 'lister' ? 'lister-dashboard.html' : 'renter-dashboard.html');
}

showRole(selectedRole);

document.querySelector('#toggle-password').addEventListener('click', event => {
  const button = event.currentTarget;
  const show = passwordInput.type === 'password';
  passwordInput.type = show ? 'text' : 'password';
  button.textContent = show ? 'Hide' : 'Show';
  button.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  button.setAttribute('aria-pressed', String(show));
});

document.querySelector('#forgot-link').addEventListener('click', async event => {
  event.preventDefault();
  if (event.currentTarget.getAttribute('aria-disabled') === 'true') return;
  if (!emailInput.reportValidity()) {
    setStatus('Enter your account email above, then choose Forgot password.', 'error');
    emailInput.focus();
    return;
  }
  const button = event.currentTarget;
  button.setAttribute('aria-disabled', 'true');
  setStatus('Sending a password reset link…');
  try {
    const redirectTo = new URL('reset-password.html', window.location.href).href;
    const { error } = await supabaseClient.auth.resetPasswordForEmail(emailInput.value.trim(), { redirectTo });
    if (error) throw error;
    setStatus('If an account exists for this email, Supabase will send a password reset link. Check your inbox.', 'success');
  } catch (error) {
    setStatus(error.message || 'Could not send a password reset link. Please try again.', 'error');
  } finally {
    button.removeAttribute('aria-disabled');
  }
});

resendButton.addEventListener('click', async () => {
  if (!emailInput.reportValidity()) return;
  resendButton.disabled = true;
  setStatus('Sending a new confirmation email…');
  try {
    const { error } = await supabaseClient.auth.resend({
      type: 'signup',
      email: emailInput.value.trim(),
      options: { emailRedirectTo: `${window.location.origin}/login.html?role=${encodeURIComponent(selectedRole)}` }
    });
    if (error) throw error;
    setStatus('If the account is awaiting confirmation, a new email has been sent. Use the newest email link.', 'success');
  } catch (error) {
    setStatus(error.message || 'Could not resend the confirmation email.', 'error');
  } finally {
    resendButton.disabled = false;
  }
});

document.querySelector('#login-form').addEventListener('submit', async event => {
  event.preventDefault();
  setStatus('');
  if (!event.currentTarget.reportValidity()) return;
  if (window.location.protocol === 'file:') {
    setStatus('Open Wayfarer from http://localhost:5500 so Supabase can authenticate you.', 'error');
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = 'Signing in…';
  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: emailInput.value.trim(),
      password: passwordInput.value
    });
    if (error) throw error;
    await routeSignedInUser(data);
  } catch (error) {
    const emailNeedsConfirmation = error.code === 'email_not_confirmed' || /email not confirmed/i.test(error.message || '');
    setStatus(emailNeedsConfirmation
      ? 'Supabase still considers this email unconfirmed. Use the newest confirmation email link, or resend it below.'
      : error.message || 'Sign-in failed. Please check your details and try again.', 'error');
    resendButton.hidden = !emailNeedsConfirmation;
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = 'Sign in <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M3.5 10h12m-5-5 5 5-5 5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
});

// Supabase returns a session in the URL after a successful email confirmation.
supabaseClient.auth.getSession().then(({ data: { session }, error }) => {
  if (error) throw error;
  return routeSignedInUser(session);
}).catch(error => setStatus(error.message || 'Could not finish email confirmation.', 'error'));
