# AI Caddie Starter

GitHub update guide:
git add .
git commit -m "Beskriv vad du ändrade"
git push

This is a simple Expo / React Native starter for a golf AI caddie.

It already includes:

- player profile with club carry lengths
- lie selection: tee, fairway, rough, sand, green, recovery
- deterministic club recommendation logic
- Open-Meteo weather fetch
- GPS permission and nearest local course lookup
- voice readout with Expo Speech
- manual shot logging
- basic round analysis
- Supabase schema for later sync
- adapter folder for Meta glasses later

It does not include green reading yet. That is intentional.

## Install

1. Install Node.js LTS.
2. Install Git.
3. Install VS Code or Cursor.
4. Install Expo Go on your phone.
5. Download this folder and open it in VS Code/Cursor.

## Run on mobile

In the project folder:

```bash
npm install
npx expo start
```

Then scan the QR code with Expo Go.

If package versions complain, create a fresh Expo project and copy the `src`, `App.tsx`, `supabase`, and `ROADMAP.md` files into it:

```bash
npx create-expo-app@latest ai-caddie
cd ai-caddie
npx expo install expo-location expo-speech @react-native-async-storage/async-storage
npm install @supabase/supabase-js react-native-url-polyfill
```

## What to edit first

1. Open `src/data/defaultProfile.ts` and change the starter club lengths.
2. Open `src/data/sampleCourse.ts` and add your real home course.
3. Run the app and test:
   - change distance
   - select lie
   - listen to recommendation
   - save shots
   - check analysis

## Architecture

Keep code split like this:

- `src/domain` = pure golf logic. No GPS, no Supabase, no Meta.
- `src/services` = phone services such as storage, weather, GPS and speech.
- `src/data` = starter/demo data.
- `src/adapters` = future integrations, for example Meta glasses.
- `supabase` = database schema.

This makes future upgrades safer. You can improve club logic without breaking UI, or add Meta glasses without rewriting score/analysis.

## Supabase later

The app stores everything locally first. When you want login/sync:

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Copy `.env.example` to `.env` and add your project URL and anon key.
4. Add save/load calls from `src/services/supabaseClient.ts`.

Important: Do not put private OpenAI/API secrets inside the mobile app. Put sensitive calls in a backend or Supabase Edge Function.

## Course data later

Start with manual JSON for your own course. Then add one provider at a time:

- OpenStreetMap for course geometry
- GolfCourseAPI or similar for global courses
- Supabase for your own cleaned course database

The app uses a `CourseProvider` interface so you can replace local demo data without changing the app screens.

## License

This starter code is MIT-style: use it freely. Check the license of any open-source golf project before copying code into your app.
