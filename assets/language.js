// Keep the current section or project when moving between the two domains.
document.querySelectorAll('[data-language]').forEach(link => {
  link.addEventListener('click', () => {
    const target = new URL(link.href);
    target.hash = location.hash;
    link.href = target.href;
  });
});
