import { Redirect } from 'expo-router';

/** Messages used to be a hidden tab, which bounced people back to Home. It is now the normal screen at /(patient)/messages. */
export default function CareRedirect() {
  return <Redirect href={'/(patient)/messages' as any} />;
}
