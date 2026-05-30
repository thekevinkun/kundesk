// Clerk hosted sign-up page
// [[...sign-up]] catches all Clerk's internal sign-up sub-routes

import { SignUp } from "@clerk/nextjs";

export default function SignUpPage(): React.ReactElement {
  return (
    <main className="min-h-screen flex items-center justify-center bg-(--color-bg-page)">
      <SignUp />
    </main>
  );
}
