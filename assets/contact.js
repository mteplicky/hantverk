(() => {
  const form = document.getElementById('form');
  const files = document.getElementById('f-file');
  const error = document.getElementById('form-error');
  const button = form.querySelector('button[type="submit"]');
  let sending = false;

  files.addEventListener('change', () => {
    document.getElementById('f-file-name').textContent = files.files.length
      ? [...files.files].map(file => file.name).join(', ')
      : 'Zatiaľ nič nevybrané';
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending || !form.reportValidity()) return;
    error.hidden = true;
    if (files.files.length > 5 || [...files.files].reduce((total, file) => total + file.size, 0) > 10 * 1024 * 1024) {
      error.textContent = 'Priložte najviac 5 súborov s celkovou veľkosťou do 10 MB.';
      error.hidden = false;
      return;
    }
    sending = true;
    button.disabled = true;
    form.setAttribute('aria-busy', 'true');
    const label = button.innerHTML;
    button.textContent = 'Odosielam…';
    try {
      const response = await fetch(form.action, { method: 'POST', body: new FormData(form) });
      const result = await response.json();
      if (!response.ok || result.ok !== true) {
        throw new Error(result.message || 'Správu sa nepodarilo odoslať. Skúste to znova.');
      }
      form.classList.add('sent');
      document.querySelector('.contact-title').textContent = 'Ďakujeme :)';
      const success = form.querySelector('.form-ok');
      success.tabIndex = -1;
      success.focus();
    } catch (failure) {
      error.textContent = failure instanceof SyntaxError || failure instanceof TypeError
        ? 'Správu sa nepodarilo odoslať. Skúste to znova alebo napíšte na info@hantverk.sk.'
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
