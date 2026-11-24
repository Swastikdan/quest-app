# Quest

Single-user daily rhythm app built with Expo Router and React Native.

## Build and release

The Android release workflow is in `.github/workflows/android-release.yml`.

1. Bump `version` in `app.json` or trigger the workflow manually with a version.
2. Push a tag such as `v1.0.2`:
   ```bash
   git tag v1.0.2
   git push origin v1.0.2
   ```
3. GitHub Actions builds a signed APK and publishes:
   - `app-release.apk`
   - `latest.json` (the in-app update manifest)
4. In the app: **Settings → App update → Download & install**.

The updater is Android-only. The APK is signed with the `questRelease` keystore,
configured by `scripts/configure-android-signing.py` from these repository secrets:

- `ANDROID_KEYSTORE_BASE64`
- `QUEST_STORE_PASSWORD`
- `QUEST_KEY_ALIAS`
- `QUEST_KEY_PASSWORD`

The first release-signed build must be installed once manually. After that, the
same signing key allows in-app APK updates.
