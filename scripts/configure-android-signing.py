#!/usr/bin/env python3
"""Add a release signing config to the generated Android project.

The keystore is written by CI (or by the local release script) and every value
comes from environment variables so no secret is stored in the repository.
"""

from pathlib import Path

BUILD_GRADLE = Path("android/app/build.gradle")
MARKER = "questRelease"


def main() -> None:
    if not BUILD_GRADLE.exists():
        raise SystemExit("android/app/build.gradle is missing — run expo prebuild first.")

    source = BUILD_GRADLE.read_text()
    if MARKER in source:
        return

    if "signingConfigs {" not in source:
        raise SystemExit("No signingConfigs block found in build.gradle.")

    source = source.replace(
        "signingConfigs {",
        """signingConfigs {
        questRelease {
            storeFile file("quest-release.keystore")
            storePassword System.getenv("QUEST_STORE_PASSWORD")
            keyAlias System.getenv("QUEST_KEY_ALIAS")
            keyPassword System.getenv("QUEST_KEY_PASSWORD")
        }""",
        1,
    )
    source = source.replace(
        "signingConfig signingConfigs.debug",
        "signingConfig signingConfigs.questRelease",
    )
    BUILD_GRADLE.write_text(source)
    print("Configured questRelease signing.")


if __name__ == "__main__":
    main()
