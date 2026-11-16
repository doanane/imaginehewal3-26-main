import { Redirect } from 'expo-router';

/** This screen used to show made-up conversations. Conversations are real and live in the Care tab, so anything that still links
 *  here lands there. */
export default function ChatRedirect() {
  return <Redirect href={'/(patient)/messages' as any} />;
}
