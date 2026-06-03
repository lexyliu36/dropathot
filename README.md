# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Run application
npn run dev
then go into server/ and npm run dev

seed local seed data data
Input:
    curl -s https://ipinfo.io/json
Output:
{
  "ip": "108.6.12.40",
  "hostname": "pool-108-6-12-40.nycmny.fios.verizon.net",
  "city": "New York City",
  "region": "New York",
  "country": "US",
  "loc": "40.7143,-74.0060",
  "org": "AS701 Verizon Business",
  "postal": "10001",
  "timezone": "America/New_York",
  "readme": "https://ipinfo.io/missingauth"
}%
Then:
node server/seed.js --lat=40.7143 --lng=-74.0060