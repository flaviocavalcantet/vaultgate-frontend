/** English, the source language: every other language has exactly these keys. */
export const en = {
  app: {
    name: 'VaultGate',
    skipToContent: 'Skip to content',
    mainNavigation: 'Main',
  },
  nav: {
    home: 'Home',
    signOut: 'Sign out',
    signedInAs: 'Signed in as {{name}}',
  },
  home: {
    title: 'Your vault',
    body: 'Files, sharing and administration arrive here step by step.',
    account: 'Your account',
    loading: 'Loading your account…',
    failed: 'Your account could not be loaded. Try again in a moment.',
    retry: 'Try again',
    name: 'Name',
    email: 'Email',
    groups: 'Groups',
    noGroups: 'None',
    notSet: 'Not set',
  },
  signIn: {
    title: 'Sign in to VaultGate',
    body: "You sign in with your organization's account.",
    expired: 'Your session ended. Sign in again to continue.',
    failed: 'Signing in did not work. Try again.',
    button: 'Sign in',
    working: 'Signing you in…',
  },
  notFound: {
    title: 'Page not found',
    body: 'There is nothing at this address.',
    back: 'Back to the start',
  },
  error: {
    title: 'Something went wrong',
    body: 'The page could not be shown. Reload it, and if it happens again, tell your administrator.',
    reload: 'Reload',
  },
} as const
