import React from 'react';
import { useTranslation } from 'react-i18next';
import { PiGlobe } from 'react-icons/pi';
import { LANGUAGES } from '../i18n';

/**
 * Compact language selector for the pre-auth landing screen.
 *
 * The app already auto-detects the visitor's language via
 * i18next-browser-languagedetector (querystring → cookie → localStorage →
 * navigator → htmlTag, falling back to English). This control is only a
 * manual override for visitors whose device language differs from the
 * language they want to read in. Changing it persists through the detector's
 * localStorage cache, so the choice survives reloads and carries into the
 * authenticated app.
 *
 * Styled for the dark landing surface (light text on zinc-900) and kept
 * small so it sits unobtrusively in the top corner on every viewport.
 */
const AuthLanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();

  // i18n.language can be a regional variant (e.g. "en-GB"); match on the
  // base so the <select> reflects the active resource bundle.
  const current =
    LANGUAGES.find((l) => l.value === i18n.language)?.value ??
    LANGUAGES.find((l) => i18n.language?.startsWith(l.value))?.value ??
    'en';

  return (
    <div className="relative flex items-center gap-1.5 text-white/60">
      <PiGlobe aria-hidden className="size-4 shrink-0" />
      <label htmlFor="auth-language" className="sr-only">
        Language
      </label>
      <select
        id="auth-language"
        value={current}
        onChange={(e) => i18n.changeLanguage(e.target.value)}
        className="cursor-pointer rounded-md border border-white/10 bg-white/5 py-1 pl-2 pr-7 text-xs text-white/80 outline-none transition-colors hover:bg-white/10 focus:border-white/30 focus:ring-0">
        {LANGUAGES.map((l) => (
          <option key={l.value} value={l.value} className="bg-zinc-800 text-white">
            {l.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default AuthLanguageSwitcher;
