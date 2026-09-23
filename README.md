# Pixel Perfect Display

Implement exactly the screenshot and nothing else

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://pracharsudiodemo.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/4f3a958d-c057-4318-a94c-8a967ded5e8c).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```


## Secure licensing setup

Prachar Studio now uses server-side authentication and centralized license records.

Set these server environment variables before deployment:

```text
PRACHAR_OWNER_EMAIL=
PRACHAR_OWNER_PASSWORD=
PRACHAR_SESSION_SECRET=
SUPABASE_URL=
SUPABASE_SECRET_KEY=
```

Run the SQL migration in `supabase/migrations/003_secure_licensing.sql` against the connected Supabase project.

Never prefix server secrets with `VITE_`. The Supabase secret key and owner credentials must remain server-only.

Owner login creates an HTTP-only session. Customer activation creates a server session tied to a single-use license. Permanent licenses do not expire; trial licenses expire seven days after activation. Owner key generation and revocation require the server owner session.
