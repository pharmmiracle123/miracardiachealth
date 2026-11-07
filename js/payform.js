// ============================================================
// MIRACARDIAC - "I have made payment" details form
// Paystack does not tell us WHO paid (only an email + reference), so after
// the Paystack popup succeeds the student confirms: First name, Surname,
// Email, Amount paid, Date & time. The Paystack reference is attached
// automatically so the admin can look it up in the Paystack dashboard.
//
// askPaymentDetails({ user, amount, courseTitle, reference })
//   -> resolves with the details object when the student taps
//      "I have made payment", or null if they tap "Fill in later".
// ============================================================

const STYLE_ID = 'mc-payform-style';
function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
  .mcpf-back{position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,.65);display:flex;align-items:flex-end;justify-content:center;font-family:Inter,system-ui,sans-serif}
  .mcpf{width:100%;max-width:440px;max-height:94dvh;overflow-y:auto;background:#fff;color:#0f172a;border-radius:24px 24px 0 0;padding:20px 18px calc(20px + env(safe-area-inset-bottom))}
  @media(min-width:520px){.mcpf-back{align-items:center}.mcpf{border-radius:24px}}
  .mcpf h2{margin:0 0 4px;font-size:18px;font-weight:800}
  .mcpf p.s{margin:0 0 14px;font-size:12.5px;color:#64748b;line-height:1.45}
  .mcpf .ref{background:#f1f5f9;border-radius:12px;padding:8px 10px;font-size:11.5px;color:#475569;margin-bottom:12px;word-break:break-all}
  .mcpf .ref b{font-family:ui-monospace,monospace;color:#0f172a}
  .mcpf .g{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .mcpf label{display:block;font-size:11.5px;font-weight:600;color:#475569;margin:0 0 4px}
  .mcpf input{width:100%;border:1px solid #cbd5e1;border-radius:12px;padding:11px 12px;font-size:15px;color:#0f172a;background:#fff;outline:none;box-sizing:border-box}
  .mcpf input:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.15)}
  .mcpf .f{margin-bottom:10px}
  .mcpf .err{display:none;margin:2px 0 10px;font-size:12px;color:#dc2626}
  .mcpf .err.on{display:block}
  .mcpf button.go{width:100%;border:0;border-radius:14px;padding:14px;font-size:15px;font-weight:700;color:#fff;background:#059669;cursor:pointer}
  .mcpf button.go:disabled{opacity:.6}
  .mcpf button.later{display:block;width:100%;margin-top:8px;border:0;background:none;color:#64748b;font-size:12.5px;padding:8px;cursor:pointer}
  `;
  document.head.appendChild(s);
}

const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const localInputValue = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function askPaymentDetails({ user, amount, courseTitle = '', reference = '' }) {
  injectStyle();
  const parts = String((user && user.displayName) || '').trim().split(/\s+/).filter(Boolean);
  const first = parts[0] || '', sur = parts.slice(1).join(' ');

  return new Promise(resolve => {
    const back = document.createElement('div');
    back.className = 'mcpf-back';
    back.innerHTML = `
      <div class="mcpf" role="dialog" aria-modal="true" aria-labelledby="mcpfT">
        <h2 id="mcpfT">Confirm your payment</h2>
        <p class="s">${courseTitle ? esc(courseTitle) + ' · ' : ''}Fill this in as it appears on your payment so we can approve your access quickly.</p>
        ${reference ? `<div class="ref">Payment reference: <b>${esc(reference)}</b></div>` : ''}
        <div class="g">
          <div class="f"><label for="mcpfFn">First name</label><input id="mcpfFn" autocomplete="given-name" value="${esc(first)}" /></div>
          <div class="f"><label for="mcpfSn">Surname</label><input id="mcpfSn" autocomplete="family-name" value="${esc(sur)}" /></div>
        </div>
        <div class="f"><label for="mcpfEm">Email used to pay</label><input id="mcpfEm" type="email" autocomplete="email" value="${esc((user && user.email) || '')}" /></div>
        <div class="g">
          <div class="f"><label for="mcpfAm">Amount paid (₦)</label><input id="mcpfAm" type="number" inputmode="decimal" min="1" value="${esc(amount || '')}" /></div>
          <div class="f"><label for="mcpfDt">Date &amp; time</label><input id="mcpfDt" type="datetime-local" value="${localInputValue()}" /></div>
        </div>
        <p class="err" id="mcpfErr"></p>
        <button class="go" id="mcpfGo" type="button">I have made payment</button>
        <button class="later" id="mcpfLater" type="button">Fill in later</button>
      </div>`;
    document.body.appendChild(back);
    const $ = id => back.querySelector('#' + id);
    const done = v => { back.remove(); resolve(v); };

    $('mcpfLater').onclick = () => done(null);
    $('mcpfGo').onclick = () => {
      const firstName = $('mcpfFn').value.trim(), surname = $('mcpfSn').value.trim();
      const email = $('mcpfEm').value.trim().toLowerCase();
      const amt = Number($('mcpfAm').value), dt = $('mcpfDt').value;
      const bad = !firstName ? 'Enter your first name.'
        : !surname ? 'Enter your surname.'
        : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'Enter a valid email.'
        : !(amt > 0) ? 'Enter the amount you paid.'
        : !dt ? 'Enter the date and time you paid.' : '';
      if (bad) { const e = $('mcpfErr'); e.textContent = bad; e.classList.add('on'); return; }
      $('mcpfGo').disabled = true;
      done({
        firstName, surname, userName: firstName + ' ' + surname,
        claimEmail: email, claimAmount: amt,
        claimPaidAt: new Date(dt).toISOString(),
        detailsSubmittedAt: Date.now()
      });
    };
    setTimeout(() => { const f = $('mcpfFn'); if (f && !f.value) f.focus(); }, 50);
  });
}
