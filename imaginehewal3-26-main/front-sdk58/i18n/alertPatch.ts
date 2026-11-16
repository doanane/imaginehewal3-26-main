import { Alert } from 'react-native';
import { getLang } from './index';
import { translateText } from './translate';

/** Confirmation boxes and error pop-ups are drawn by the phone, not by our Text, so they are translated here, once, for the whole app. */
let done = false;
if (!done) {
  done = true;
  const original = Alert.alert.bind(Alert);
  (Alert as any).alert = (title: string, message?: string, buttons?: any[], options?: any) => {
    const lang = getLang();
    if (lang === 'en') return original(title, message, buttons, options);
    return original(
      translateText(title, lang),
      message ? translateText(message, lang) : message,
      buttons?.map((b) => (b && typeof b.text === 'string' ? { ...b, text: translateText(b.text, lang) } : b)),
      options,
    );
  };
}
