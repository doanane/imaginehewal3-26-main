import { Redirect } from 'expo-router';

// There is one caregiver home. This path stays so older links and the verify step still land in the right place.
export default function CaregiverHomeRedirect() {
  return <Redirect href="/(caregiver)/dashboard" />;
}
