// Methodology accordion toggle
document.querySelectorAll('.methodology-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const block = btn.closest('.methodology-block');
    block.classList.toggle('open');
    btn.querySelector('.toggle-icon').textContent =
      block.classList.contains('open') ? '▲' : '▼';
  });
});
