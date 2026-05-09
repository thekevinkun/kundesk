// Clerk hosted sign-in page
// [[...sign-in]] catches all Clerk's internal sign-in sub-routes

import { SignIn } from "@clerk/nextjs";

export default function SignInPage(): React.ReactElement {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--color-bg-page)]">
      <SignIn />
    </main>
  );
}
