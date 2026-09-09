import json
import subprocess
from pathlib import Path

ARTIFACTS = Path("/opt/cursor/artifacts")
SCREENSHOTS = ARTIFACTS / "screenshots"
TIMELINE = json.loads((ARTIFACTS / "demo-timeline.json").read_text())

IMAGE_MAP = {
    "login-then-dashboard": ["01-login.png", "02-dashboard.png"],
    "dashboard": ["02-dashboard.png"],
    "attendance-reports": ["03-attendance.png"],
    "leave": ["04-leave.png"],
    "employees-org": ["05-employees.png", "06-org.png"],
    "payslips": ["07-payslips.png"],
    "reports": ["08-reports.png"],
    "dashboard-close": ["02-dashboard.png"],
}


def segment_duration(segment: dict) -> float:
    return segment["audioDuration"] + segment.get("pauseAfter", 0)


def build_concat() -> Path:
    lines = []
    for segment in TIMELINE["segments"]:
        images = IMAGE_MAP[segment["screen"]]
        total = segment_duration(segment)
        if len(images) == 1:
            durations = [total]
        else:
            durations = [total / len(images)] * len(images)

        for image, duration in zip(images, durations):
            lines.append(f"file '{SCREENSHOTS / image}'")
            lines.append(f"duration {duration:.3f}")

    last_image = SCREENSHOTS / IMAGE_MAP[TIMELINE["segments"][-1]["screen"]][-1]
    lines.append(f"file '{last_image}'")

    concat_path = ARTIFACTS / "demo-slideshow.txt"
    concat_path.write_text("\n".join(lines) + "\n")
    return concat_path


def main() -> None:
    concat_path = build_concat()
    slideshow = ARTIFACTS / "demo-slideshow.mp4"
    final = ARTIFACTS / "digitix-hrms-demo.mp4"

    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(concat_path),
            "-vf",
            "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=white,format=yuv420p",
            "-r",
            "30",
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "18",
            "-pix_fmt",
            "yuv420p",
            str(slideshow),
        ],
        check=True,
    )

    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(slideshow),
            "-i",
            str(ARTIFACTS / "demo-audio-final.wav"),
            "-map",
            "0:v:0",
            "-map",
            "1:a:0",
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "18",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-profile:a",
            "aac_low",
            "-ar",
            "48000",
            "-ac",
            "2",
            "-b:a",
            "256k",
            "-shortest",
            "-movflags",
            "+faststart",
            str(final),
        ],
        check=True,
    )

    subprocess.run(
        ["cp", str(final), str(ARTIFACTS / "recording_demo.mp4")],
        check=True,
    )

    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(final),
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    print(f"Final video duration: {result.stdout.strip()}s")


if __name__ == "__main__":
    main()
