import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ar from './locales/ar.json'
import en from './locales/en.json'

const saved = localStorage.getItem('cf_lang')
const lng = saved === 'en' || saved === 'ar' ? saved : 'ar'

void i18n.use(initReactI18next).init({
  resources: {
    ar: { translation: ar },
    en: { translation: en },
  },
  lng,
  fallbackLng: 'ar',
  interpolation: { escapeValue: false },
})

export function applyDocumentDirection(language: string) {
  const dir = language === 'ar' ? 'rtl' : 'ltr'
  document.documentElement.lang = language
  document.documentElement.dir = dir
}

applyDocumentDirection(lng)

i18n.on('languageChanged', (language) => {
  localStorage.setItem('cf_lang', language)
  applyDocumentDirection(language)
})

export default i18n
