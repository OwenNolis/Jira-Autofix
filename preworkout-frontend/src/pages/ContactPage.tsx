import React, { useState } from 'react';
import './ContactPage.css';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Partial<typeof form>>({});

  function validate() {
    const errs: Partial<typeof form> = {};
    if (!form.name.trim()) errs.name = 'Naam is verplicht.';
    if (!form.email.trim()) errs.email = 'E-mail is verplicht.';
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) errs.email = 'Ongeldig e-mailadres.';
    if (!form.subject.trim()) errs.subject = 'Onderwerp is verplicht.';
    if (!form.message.trim()) errs.message = 'Bericht is verplicht.';
    return errs;
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setErrors((prev) => ({ ...prev, [e.target.name]: undefined }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setSubmitted(true);
  }

  function handleReset() {
    setForm({ name: '', email: '', subject: '', message: '' });
    setErrors({});
    setSubmitted(false);
  }

  return (
    <div className="contact-page">
      <div className="contact-container">
        <h1 className="contact-title">Contact</h1>
        <p className="contact-subtitle">
          Heb je een vraag, opmerking of wil je samenwerken? Stuur ons een bericht en we nemen zo snel mogelijk contact op.
        </p>

        <div className="contact-grid">
          {/* Contact info */}
          <aside className="contact-info">
            <div className="contact-info-item">
              <span className="contact-info-icon">📍</span>
              <div>
                <strong>Adres</strong>
                <p>Sportlaan 12, 3600 Genk, België</p>
              </div>
            </div>
            <div className="contact-info-item">
              <span className="contact-info-icon">📧</span>
              <div>
                <strong>E-mail</strong>
                <p>info@pulsepre.be</p>
              </div>
            </div>
            <div className="contact-info-item">
              <span className="contact-info-icon">📞</span>
              <div>
                <strong>Telefoon</strong>
                <p>+32 89 00 00 00</p>
              </div>
            </div>
            <div className="contact-info-item">
              <span className="contact-info-icon">🕐</span>
              <div>
                <strong>Openingsuren</strong>
                <p>Ma – Vr: 09:00 – 17:00</p>
              </div>
            </div>
          </aside>

          {/* Contact form */}
          <div className="contact-form-wrapper">
            {submitted ? (
              <div className="contact-success">
                <span className="contact-success-icon">✅</span>
                <h2>Bericht verzonden!</h2>
                <p>Bedankt voor je bericht. We nemen zo snel mogelijk contact met je op.</p>
                <button className="btn-primary" onClick={handleReset}>Nieuw bericht</button>
              </div>
            ) : (
              <form className="contact-form" onSubmit={handleSubmit} noValidate>
                <div className="contact-form-group">
                  <label htmlFor="contact-name">Naam</label>
                  <input
                    id="contact-name"
                    name="name"
                    type="text"
                    placeholder="Jouw naam"
                    value={form.name}
                    onChange={handleChange}
                    autoComplete="name"
                  />
                  {errors.name && <span className="contact-field-error">{errors.name}</span>}
                </div>

                <div className="contact-form-group">
                  <label htmlFor="contact-email">E-mail</label>
                  <input
                    id="contact-email"
                    name="email"
                    type="email"
                    placeholder="jouw@email.be"
                    value={form.email}
                    onChange={handleChange}
                    autoComplete="email"
                  />
                  {errors.email && <span className="contact-field-error">{errors.email}</span>}
                </div>

                <div className="contact-form-group">
                  <label htmlFor="contact-subject">Onderwerp</label>
                  <select
                    id="contact-subject"
                    name="subject"
                    value={form.subject}
                    onChange={handleChange}
                  >
                    <option value="">Kies een onderwerp…</option>
                    <option value="bestelling">Vraag over bestelling</option>
                    <option value="product">Productvraag</option>
                    <option value="retour">Retour / Ruil</option>
                    <option value="samenwerking">Samenwerking</option>
                    <option value="overig">Overig</option>
                  </select>
                  {errors.subject && <span className="contact-field-error">{errors.subject}</span>}
                </div>

                <div className="contact-form-group">
                  <label htmlFor="contact-message">Bericht</label>
                  <textarea
                    id="contact-message"
                    name="message"
                    placeholder="Jouw bericht…"
                    rows={5}
                    value={form.message}
                    onChange={handleChange}
                  />
                  {errors.message && <span className="contact-field-error">{errors.message}</span>}
                </div>

                <button type="submit" className="btn-primary contact-submit">Verstuur bericht</button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
