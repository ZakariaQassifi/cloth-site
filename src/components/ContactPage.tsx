import React, { useState } from 'react';
import { Mail, Phone, MapPin, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useTranslation, type TranslationKey } from '../i18n/useI18n';
import { brandConfig } from '../config/brand';
import { Container } from './Container';
import { Button } from './Button';
import './ContactPage.css';

interface FormData {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
  subject?: string;
  message?: string;
}

const EMPTY_FORM: FormData = {
  name: '',
  email: '',
  phone: '',
  subject: '',
  message: '',
};

const SUBJECT_OPTIONS = [
  { value: 'general', labelKey: 'contact.subject.general' },
  { value: 'order', labelKey: 'contact.subject.order' },
  { value: 'shipping', labelKey: 'contact.subject.shipping' },
  { value: 'returns', labelKey: 'contact.subject.returns' },
  { value: 'other', labelKey: 'contact.subject.other' },
];

export const ContactPage: React.FC = () => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [submitMessage, setSubmitMessage] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
    if (submitStatus !== 'idle') {
      setSubmitStatus('idle');
      setSubmitMessage('');
    }
  };

  const validateForm = (): boolean => {
    const nextErrors: FormErrors = {};
    if (!formData.name.trim()) nextErrors.name = t('contact.error.nameRequired');
    if (!formData.email.trim()) {
      nextErrors.email = t('contact.error.emailRequired');
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      nextErrors.email = t('contact.error.emailInvalid');
    }
    if (!formData.subject.trim()) nextErrors.subject = t('contact.error.subjectRequired');
    if (!formData.message.trim()) nextErrors.message = t('contact.error.messageRequired');
    if (formData.message.trim().length < 10) nextErrors.message = t('contact.error.messageTooShort');

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setSubmitStatus('idle');
    setSubmitMessage('');

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        setSubmitStatus('success');
        setSubmitMessage(t('contact.successMessage'));
        setFormData(EMPTY_FORM);
      } else {
        setSubmitStatus('error');
        setSubmitMessage(result.message || t('contact.error.submitFailed'));
      }
    } catch {
      setSubmitStatus('error');
      setSubmitMessage(t('contact.error.unexpectedError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="contact-page">
      <div className="contact-page__header">
        <Container maxWidth="lg">
          <h1 className="contact-page__title">{t('contact.title')}</h1>
          <p className="contact-page__subtitle">{t('contact.subtitle')}</p>
        </Container>
      </div>

      <div className="contact-page__content">
        <Container maxWidth="lg">
          <div className="contact-grid">
            {/* Contact Info */}
            <div className="contact-info">
              <h2 className="contact-info__title">{t('contact.info.title')}</h2>
              <p className="contact-info__description">{t('contact.info.description')}</p>

              <div className="contact-methods">
                <div className="contact-method">
                  <div className="contact-method__icon">
                    <Mail size={24} />
                  </div>
                  <div className="contact-method__details">
                    <h3>{t('contact.info.email')}</h3>
                    <a href={`mailto:${brandConfig.supportEmail}`} className="contact-method__value">
                      {brandConfig.supportEmail}
                    </a>
                    <p className="contact-method__note">{t('contact.info.emailNote')}</p>
                  </div>
                </div>

                <div className="contact-method">
                  <div className="contact-method__icon">
                    <Phone size={24} />
                  </div>
                  <div className="contact-method__details">
                    <h3>{t('contact.info.phone')}</h3>
                    <a href={`tel:${brandConfig.supportPhone}`} className="contact-method__value">
                      {brandConfig.supportPhone}
                    </a>
                    <p className="contact-method__note">{t('contact.info.phoneNote')}</p>
                  </div>
                </div>

                <div className="contact-method">
                  <div className="contact-method__icon">
                    <MapPin size={24} />
                  </div>
                  <div className="contact-method__details">
                    <h3>{t('contact.info.address')}</h3>
                    <p className="contact-method__value">{brandConfig.address}</p>
                    <p className="contact-method__note">{t('contact.info.addressNote')}</p>
                  </div>
                </div>
              </div>

              <div className="contact-hours">
                <h3>{t('contact.info.hours.title')}</h3>
                <p>{t('contact.info.hours.weekdays')}</p>
                <p>{t('contact.info.hours.weekend')}</p>
              </div>
            </div>

            {/* Contact Form */}
            <div className="contact-form-wrapper">
              <div className="contact-form-card">
                <h2 className="contact-form__title">{t('contact.form.title')}</h2>
                <p className="contact-form__description">{t('contact.form.description')}</p>

                {submitStatus !== 'idle' && (
                  <div className={`contact-form__alert contact-form__alert--${submitStatus}`}>
                    {submitStatus === 'success' ? (
                      <>
                        <CheckCircle size={20} />
                        {submitMessage}
                      </>
                    ) : (
                      <>
                        <AlertCircle size={20} />
                        {submitMessage}
                      </>
                    )}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="contact-form" noValidate>
                  <div className="form-group">
                    <label htmlFor="name" className="form-label">
                      {t('contact.form.name')} <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      className={`form-input ${errors.name ? 'error' : ''}`}
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder={t('contact.form.namePlaceholder')}
                      required
                    />
                    {errors.name && <span className="form-error">{errors.name}</span>}
                  </div>

                  <div className="form-grid form-grid--2col">
                    <div className="form-group">
                      <label htmlFor="email" className="form-label">
                        {t('contact.form.email')} <span className="required">*</span>
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        className={`form-input ${errors.email ? 'error' : ''}`}
                        value={formData.email}
                        onChange={handleInputChange}
                        placeholder={t('contact.form.emailPlaceholder')}
                        required
                      />
                      {errors.email && <span className="form-error">{errors.email}</span>}
                    </div>

                    <div className="form-group">
                      <label htmlFor="phone" className="form-label">
                        {t('contact.form.phone')}
                      </label>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        className={`form-input ${errors.phone ? 'error' : ''}`}
                        value={formData.phone}
                        onChange={handleInputChange}
                        placeholder={t('contact.form.phonePlaceholder')}
                      />
                      {errors.phone && <span className="form-error">{errors.phone}</span>}
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="subject" className="form-label">
                      {t('contact.form.subject')} <span className="required">*</span>
                    </label>
                    <select
                      id="subject"
                      name="subject"
                      className={`form-input ${errors.subject ? 'error' : ''}`}
                      value={formData.subject}
                      onChange={handleInputChange}
                      required
                    >
                      <option value="">{t('contact.form.subjectPlaceholder')}</option>
                      {SUBJECT_OPTIONS.map((opt) => {
                        const labelKey = opt.labelKey as TranslationKey;
                        return (
                          <option key={opt.value} value={opt.value}>
                            {t(labelKey)}
                          </option>
                        );
                      })}
                    </select>
                    {errors.subject && <span className="form-error">{errors.subject}</span>}
                  </div>

                  <div className="form-group">
                    <label htmlFor="message" className="form-label">
                      {t('contact.form.message')} <span className="required">*</span>
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      className={`form-input ${errors.message ? 'error' : ''}`}
                      value={formData.message}
                      onChange={handleInputChange}
                      placeholder={t('contact.form.messagePlaceholder')}
                      rows={6}
                      required
                    />
                    {errors.message && <span className="form-error">{errors.message}</span>}
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    fullWidth
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? <Loader2 size={20} className="spin" /> : t('contact.form.submit')}
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </Container>
      </div>
    </div>
  );
};