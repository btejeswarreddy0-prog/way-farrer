const supabaseClient = window.wayfarerSupabase;
const resetForm = document.querySelector('#reset-form');
const statusMessage = document.querySelector('#status');
let recoverySession = false;

function setStatus(message, kind = '') {
  statusMessage.className = `status${kind ? ` ${kind}` : ''}`;
  statusMessage.textContent = message;
}

function allowPasswordReset() {
  recoverySession = true;
  resetForm.hidden = false;
  setStatus('Reset link verified. Choose your new password.');
}

supabaseClient.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY' && session) allowPasswordReset();
});

supabaseClient.auth.getSession().then(({ data: { session }, error }) => {
  if (error) throw error;
  if (recoverySession) return;
  const hash = new URLSearchParams(window.location.hash.slice(1));
  if (session && hash.get('type') === 'recovery') allowPasswordReset();
  else setStatus('Open the latest password reset link from your email. If it expired, request another from the sign-in page.', 'error');
}).catch(error => setStatus(error.message || 'Could not verify the reset link. Request a new one and try again.', 'error'));

resetForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!recoverySession || !resetForm.reportValidity()) return;
  const password = document.querySelector('#password');
  const confirmation = document.querySelector('#confirm-password');
  if (password.value !== confirmation.value) {
    setStatus('Those passwords do not match.', 'error');
    confirmation.focus();
    return;
  }
  const button = resetForm.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = 'Updating password…';
  try {
    const { error } = await supabaseClient.auth.updateUser({ password: password.value });
    if (error) throw error;
    resetForm.hidden = true;
    setStatus('Your password has been updated. Taking you to sign in…', 'success');
    window.setTimeout(() => window.location.replace('login.html'), 1400);
  } catch (error) {
    setStatus(error.message || 'Could not update your password. Request a fresh reset link and try again.', 'error');
  } finally {
    button.disabled = false;
    button.textContent = 'Update password';
  }
});
