(function () {
  'use strict';

  // Both quotations were already present in the original page source.
  // Extend this collection with personally chosen quotes and verified attributions.
  const quotes = [
    { id: 'understanding', text: 'When we are in ignorance, everything justified appears foolish and everything foolish appears justified' },
    { id: 'knowledge', text: 'Of all intoxication, the intoxication of knowledge is the worst.' }
  ];

  function selectQuote(previousId, random = Math.random) {
    const eligible = quotes.filter(quote => quote.id !== previousId);
    const candidates = eligible.length ? eligible : quotes;
    return candidates[Math.floor(random() * candidates.length)];
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { quotes, selectQuote };
  if (typeof document === 'undefined') return;

  document.addEventListener('DOMContentLoaded', function () {
    const element = document.getElementById('rotating-quote');
    if (!element) return;
    const key = 'homepageLastQuote';
    let previousId = null;
    try { previousId = sessionStorage.getItem(key); } catch (error) { /* Storage is optional. */ }
    if (!previousId) {
      try { previousId = localStorage.getItem(key); } catch (error) { /* Use a random quote. */ }
    }
    const quote = selectQuote(previousId);
    element.textContent = '“' + quote.text + '”';
    try { sessionStorage.setItem(key, quote.id); } catch (error) { /* The quotation still displays. */ }
    try { localStorage.setItem(key, quote.id); } catch (error) { /* Session preference may still work. */ }
  });
})();
