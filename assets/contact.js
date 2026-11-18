(() => {
  const form = document.getElementById('form');
  const files = document.getElementById('f-file');
  const error = document.getElementById('form-error');
  const button = form.querySelector('button[type="submit"]');
  const cs = document.documentElement?.lang === 'cs';
  const copy = cs ? {
    empty: 'Zatím nic nevybráno',
    tooLarge: 'Přiložte nejvýše 5 souborů o celkové velikosti do 10 MB.',
    sending: 'Odesílám…',
    failed: 'Zprávu se nepodařilo odeslat. Zkuste to znovu.',
    unavailable: 'Zprávu se nepodařilo odeslat. Zkuste to znovu nebo napište na info@hantverk.sk.',
  } : {
    empty: 'Zatiaľ nič nevybrané',
    tooLarge: 'Priložte najviac 5 súborov s celkovou veľkosťou do 10 MB.',
    sending: 'Odosielam…',
    failed: 'Správu sa nepodarilo odoslať. Skúste to znova.',
    unavailable: 'Správu sa nepodarilo odoslať. Skúste to znova alebo napíšte na info@hantverk.sk.',
  };
  let sending = false;

  files.addEventListener('change', () => {
    document.getElementById('f-file-name').textContent = files.files.length
      ? [...files.files].map(file => file.name).join(', ')
      : copy.empty;
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending || !form.reportValidity()) return;
    error.hidden = true;
    if (files.files.length > 5 || [...files.files].reduce((total, file) => total + file.size, 0) > 10 * 1024 * 1024) {
      error.textContent = copy.tooLarge;
      error.hidden = false;
      return;
    }
    sending = true;
    button.disabled = true;
    form.setAttribute('aria-busy', 'true');
    const label = button.innerHTML;
    button.textContent = copy.sending;
    try {
      const response = await fetch(form.action, { method: 'POST', body: new FormData(form) });
      const result = await response.json();
      if (!response.ok || result.ok !== true) {
        throw new Error(result.message || copy.failed);
      }
      form.classList.add('sent');
      document.querySelector('.contact-title').textContent = 'Ďakujeme :)';
      const success = form.querySelector('.form-ok');
      success.tabIndex = -1;
      success.focus();
    } catch (failure) {
      error.textContent = failure instanceof SyntaxError || failure instanceof TypeError
        ? copy.unavailable
        : failure.message;
      error.hidden = false;
    } finally {
      sending = false;
      button.disabled = false;
      button.innerHTML = label;
      form.removeAttribute('aria-busy');
    }
  });
})();