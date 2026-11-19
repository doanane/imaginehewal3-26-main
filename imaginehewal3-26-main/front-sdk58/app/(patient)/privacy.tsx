import { Redirect } from 'expo-router';
import React from 'react';

/** "Privacy and data" and the Privacy centre are one place: it shows who can see your data, lets you stop sharing, download everything, or delete your account. */
export default function PrivacyRedirect() {
  return <Redirect href={'/(patient)/privacy-center' as any} />;
}
