# Meta glasses adapter placeholder

Do not build the first MVP around glasses. Keep all caddie logic in src/domain and src/services.

Later, add a small adapter here that does only three things:

1. Connect to Meta glasses.
2. Send camera/audio/events into the app.
3. Read caddie messages back to the player.

The rest of the app should not know whether the message came from phone UI, voice, watch or glasses.

Suggested interface later:

```ts
export interface GlassesAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  speak(text: string): Promise<void>;
  capturePhoto?(): Promise<string>;
}
```
