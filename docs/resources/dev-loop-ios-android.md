# Native Dev Loop (iOS + Android)

This repo is a pnpm monorepo:

- `packages/*` — native libraries (e.g. `@the-polyfills/get-random-values`). Each package is only a CocoaPod (`*.podspec` + `ios/`) and a Gradle module (`android/`) — it is not a standalone app and cannot be opened/built alone in Xcode or Android Studio with full type support.
- `apps/example-expo` — Expo (SDK 57, RN 0.86.3) host app used to develop, typecheck, and run the native code. It already depends on the library via `"@the-polyfills/get-random-values": "workspace:*"`.

Source of truth for the TurboModule API is always:

- `packages/get-random-values/src/NativeGetRandomValues.ts`
- `packages/get-random-values/package.json` → `codegenConfig` (`name: GetRandomValuesSpec`, `android.javaPackageName`)

`ios/GetRandomValues.h/.mm` and `android/.../GetRandomValuesModule.kt` must implement exactly what the Spec declares. Changing the Spec requires regenerating Codegen (see below).

## Prereqs

- Node per `packages/get-random-values/.nvmrc` (v24.13.0), pnpm 12
- iOS: Xcode (matching RN 0.86), CocoaPods, Watchman
- Android: JDK 17, Android Studio, `ANDROID_HOME` set, emulator or device
- From repo root once: `pnpm install`

## JS iteration (both platforms)

TurboModule JS is built with `react-native-builder-bob` (`packages/get-random-values/package.json` → `react-native-builder-bob`):

```sh
# from packages/get-random-values
pnpm dev      # nodemon: rebuilds lib/ on src/android/ios/podspec change
pnpm prepare  # one-shot bob build
pnpm typecheck
```

`apps/example-expo` resolves the library from source via `the-polyfills-get-random-values-source` custom condition, so usually no manual rebuild is needed for JS-only changes — just reload the app.

## iOS dev loop

Expo manages `apps/example-expo/ios/` via prebuild. That folder is generated (don't hand-edit project settings there); edit only `packages/*/ios/`.

```sh
cd apps/example-expo

# first time / after changing app.config.ts or native deps
pnpm ios              # expo prebuild (if needed) + pod install + run simulator
```

Useful variants (see `apps/example-expo/package.json`):

- `pnpm spec:regen` — one-command Spec regen for **both** platforms (no app build): `rm -rf ios android .expo` + `expo prebuild --platform all --no-install` + `pod install --project-directory=ios` (iOS Codegen) + `./android/gradlew -p android generateCodegenArtifactsFromSchema` (Android Codegen). The explicit `rm -rf` avoids Expo `--clean` `ENOTEMPTY ios/Pods` failures. Run this **before** `pnpm ios` / `pnpm android`, never after — it wipes `ios/`+`android/`, so any prior build is discarded by design.
- `pnpm ios:clean` — `rm -rf .expo ios` then rebuild. Legacy fallback if `spec:regen` fails or Codegen still looks stale.
- `pnpm ios:deep-clean` (`scripts/deep-clean-ios.sh`) — also clears `node_modules` (repo root), Watchman, and `~/Library/Developer/Xcode/DerivedData`.

### Xcode + type support

1. Run `pnpm ios` at least once so `apps/example-expo/ios/` and `Pods/` exist. `pod install` runs `install_modules_dependencies` from `GetRandomValues.podspec` and invokes `react-native codegen` on `src/NativeGetRandomValues.ts`, generating e.g. `ios/build/generated/ios/GetRandomValuesSpec/`.

2. Open `apps/example-expo/ios/*.xcworkspace` in Xcode (`pnpm ios:open` from `apps/example-expo`) — never the `.xcodeproj`, otherwise Pods/Codegen headers won't resolve.

3. Open `packages/get-random-values/ios/GetRandomValues.h/.mm` from the same Xcode window. Autocomplete for `NativeGetRandomValuesSpecJSI`, `facebook::react::ObjCTurboModule`, `SecRandomCopyBytes`, etc. resolves via `Pods/Headers/Public`.

4. `Cmd+B` to typecheck/compile only; press Run in Xcode or `pnpm ios` to launch the simulator. JS changes reload via Expo; native `.mm` changes require rebuild.

If `GetRandomValuesSpec.h` is red: you changed the Spec without running `pnpm spec:regen`, or you opened the package folder standalone. Run `pnpm spec:regen`, then re-open the workspace.

## Android dev loop

```sh
cd apps/example-expo

pnpm android          # prebuild (if needed) + gradle install + run emulator
```

For Spec changes use the shared one-command (no build): `pnpm spec:regen`, then `pnpm android` to build + run. Do not run `pnpm android` before `spec:regen` — the regen wipes `android/` by design. Legacy fallback: `pnpm android:clean` (`rm -rf .expo android`, then rebuild).

### Android Studio + type support

1. Run `pnpm android` at least once so `apps/example-expo/android/` exists and Codegen has run (`android/build/generated/.../NativeGetRandomValuesSpec.java`).

2. Open `apps/example-expo/android/` (the host app) in Android Studio via `pnpm android:open` from `apps/example-expo` — launching from the terminal inherits your shell PATH (nvm `node`), which Dock-launched Studio lacks and Gradle sync needs. Never open `packages/get-random-values/android/` alone, otherwise RN + Codegen classes won't resolve.

3. Check the JDK: this repo (RN 0.86 / Expo 57) requires **JDK 17**. Terminal already uses it (`JAVA_HOME` via jenv → Zulu 17), but Android Studio defaults to its bundled JBR (e.g. `jbr-25` in `android/.idea/gradle.xml`), which crashes the build with `Execution failed for task ':react-native-worklets:configureCMakeDebug'` plus `IllegalStateException: WARNING: A restricted method in java.lang.System has been called`. Fix in `Settings > Build Tools > Gradle > Gradle JDK` → select `17` (`/Library/Java/JavaVirtualMachines/zulu-17.jdk/Contents/Home`), then `File > Sync Project with Gradle Files`. Re-apply after every `pnpm spec:regen` (it wipes `android/`, including `.idea/`). Ignore `[CXX5304] SDK XML version` warnings unless the build itself fails.

4. Edit `packages/get-random-values/android/src/main/java/com/thepolyfills/getrandomvalues/GetRandomValuesModule.kt`. It must extend the generated `NativeGetRandomValuesSpec` and override every Spec method.

5. Rebuild from Android Studio (`Make Project`) or `pnpm android` to verify. Use Logcat filtered by `GetRandomValues` / `ReactNativeJS` for runtime logs.

If the generated `NativeGetRandomValuesSpec` is stale after a Spec change: run `pnpm spec:regen` (preferred) or `pnpm android:clean` (legacy).

## Spec-change checklist

Whenever `src/Native*.ts` changes:

1. Update `ios/*.h/*.mm` and `android/.../*.kt` to match (method names, arg types, return types — Codegen types are strict: `double` ↔ `Double`, `string` ↔ `String`, promises ↔ `Promise`, etc.).
2. `cd apps/example-expo && pnpm spec:regen` — regens iOS + Android Codegen without building the app.
3. `pnpm ios` and/or `pnpm android` to build + run.
4. Re-open `.xcworkspace` / re-sync Gradle, confirm no red imports, then run on device.

## Web (no native build)

`npx expo start --web` from `apps/example-expo` exercises the `.web.ts` implementation (`globalThis.crypto.getRandomValues`). Use it to verify the universal JS API without touching Xcode/Android Studio.

## Troubleshooting

- Stale native code / stale Codegen: run `pnpm spec:regen` first. If still stale, clean in this order — `.expo` → `ios`/`android` → `DerivedData` (`ios:deep-clean`) → `node_modules` + `pnpm install`.
- Two copies of `react-native`: keep a single `0.86.3` at the root; the example app must not nest its own RN.
- New Architecture must stay enabled — this library is a TurboModule (`getTurboModule` in `.mm`, `NativeGetRandomValuesSpec` in `.kt`).
- Never commit `apps/example-expo/ios`, `apps/example-expo/android`, `.expo/`, or `node_modules/` — they are regenerable.
