import { headers } from 'next/headers';

/** The visitor's address chain as the platform in front of the app set it, for the API's limits. */
export async function visitorForwardedFor(): Promise<string | null> {
  return (await headers()).get('x-forwarded-for');
}
