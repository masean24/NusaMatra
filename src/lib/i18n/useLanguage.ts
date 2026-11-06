import { useSyncExternalStore } from 'react';
import { language, subscribeLanguage, type Language } from './index';

export function useLanguage(): Language {
  return useSyncExternalStore(subscribeLanguage, language);
}
