(function () {
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }

  function safeImageUrl(value, fallback) {
    const url = String(value || '');
    if (/^https:\/\//i.test(url) || /^assets\/[A-Za-z0-9_./-]+$/i.test(url) || /^data:image\/(png|jpeg|webp);base64,/i.test(url)) return escapeHtml(url);
    return fallback;
  }

  function createIdempotencyKey() {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') return globalThis.crypto.randomUUID();
    return `order-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  }

  function safeCart(value) {
    if (!Array.isArray(value)) return [];
    return value.filter(item => item && /^[A-Za-z0-9._:-]{1,100}$/.test(String(item.id)))
      .map(item => ({
        id: String(item.id), name: String(item.name || '').slice(0, 150),
        price: Number(item.price) || 0, img: String(item.img || '').slice(0, 500),
        unit: String(item.unit || 'un').slice(0, 20), quantity: Math.max(0, Number(item.quantity) || 0)
      }));
  }

  window.ModeloSecurity = { escapeHtml, safeImageUrl, createIdempotencyKey, safeCart };
})();
