// Інтерфейс написаний українською; англійська — переклад основних підписів (часткова).
import { EN } from './en';

let lang: 'uk' | 'en' = 'uk';
export const setLang = (l: 'uk' | 'en') => { lang = l; };
export const getLang = () => lang;
export const t = (s: string): string => (lang === 'en' ? EN[s] ?? s : s);
