"use client";

import { useEffect, useRef, useState } from "react";

const storageKey = "smokeshop-age-confirmed";

export default function AgeGate() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [ready, setReady] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    try { setConfirmed(sessionStorage.getItem(storageKey) === "true"); } catch { /* Ask again when browser storage is unavailable. */ }
    setReady(true);
  }, []);

  useEffect(() => {
    const modal = dialog.current;
    if (ready && !confirmed && modal && !modal.open) modal.showModal();
    return () => { if (modal?.open) modal.close(); };
  }, [ready, confirmed]);

  function accept() {
    try { sessionStorage.setItem(storageKey, "true"); } catch { /* Consent still applies to this mounted visit. */ }
    dialog.current?.close();
    setConfirmed(true);
  }

  if (confirmed) return null;
  return (
    <dialog ref={dialog} className="age-gate" aria-labelledby="age-heading" aria-describedby="age-description"
      onCancel={event => event.preventDefault()}>
      <span className="age-mark" dir="ltr">18+</span>
      <h2 id="age-heading">تأیید سن برای ورود</h2>
      <p id="age-description">این کاتالوگ مخصوص افراد ۱۸ سال یا بیشتر است. مصرف دخانیات به سلامت آسیب می‌رساند.</p>
      {denied ? <>
        <p role="status">ورود به کاتالوگ برای افراد زیر ۱۸ سال امکان‌پذیر نیست.</p>
        <button className="button primary" onClick={() => location.replace("about:blank")}>خروج از سایت</button>
      </> : <div className="age-actions">
        <button className="button primary" autoFocus onClick={accept}>۱۸ سال یا بیشتر دارم</button>
        <button className="button secondary" onClick={() => setDenied(true)}>زیر ۱۸ سال دارم</button>
      </div>}
      <p className="age-explanation">تأیید شما برای همین نشست مرورگر نگهداری می‌شود.</p>
    </dialog>
  );
}
