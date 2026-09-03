import './styles.css';
import { observeAuth, signInWithGoogle, signOutOfMV } from './auth.js';
import { ensureUserProfile, getCurrentProfile } from './db.js';

const root = document.querySelector('#app');

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function renderSignedOut(message = '') {
  root.innerHTML = `
    <main class="shell">
      <section class="card">
        <p class="eyebrow">Marius & Vesta</p>
        <h1>MV</h1>
        <p>Private shared household finance.</p>
        ${message ? `<p class="error">${escapeHtml(message)}</p>` : ''}
        <button id="sign-in" type="button">Sign in with Google</button>
      </section>
    </main>`;
  root.querySelector('#sign-in').addEventListener('click', async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      renderSignedOut(error.message);
    }
  });
}

function renderProfile(user, profile) {
  const pending = profile.status === 'pending';
  root.innerHTML = `
    <main class="shell">
      <section class="card">
        <div class="topline">
          <div>
            <p class="eyebrow">MV household</p>
            <h1>${pending ? 'Access pending' : 'Connected'}</h1>
          </div>
          <button id="sign-out" class="secondary" type="button">Sign out</button>
        </div>
        <p><strong>${escapeHtml(user.email)}</strong></p>
        ${pending
          ? '<p>Your authenticated account is waiting for the Household Owner to approve access. No household financial data is shown while access is pending.</p>'
          : `<p>Role: <strong>${escapeHtml(profile.role)}</strong></p><p>The secure shared-data foundation is connected. Financial screens will be built on top of this access model.</p>`}
      </section>
    </main>`;
  root.querySelector('#sign-out').addEventListener('click', () => signOutOfMV());
}

observeAuth(async (user) => {
  if (!user) {
    renderSignedOut();
    return;
  }
  try {
    await ensureUserProfile(user);
    const profile = await getCurrentProfile(user.uid);
    renderProfile(user, profile);
  } catch (error) {
    root.innerHTML = `<main class="shell"><section class="card"><h1>MV</h1><p class="error">${escapeHtml(error.message)}</p><button id="sign-out">Sign out</button></section></main>`;
    root.querySelector('#sign-out')?.addEventListener('click', () => signOutOfMV());
  }
});
