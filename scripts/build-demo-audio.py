import asyncio
import json
import subprocess
from pathlib import Path

import edge_tts

ARTIFACTS = Path("/opt/cursor/artifacts")
NORMALIZED = ARTIFACTS / "audio-normalized"
SEGMENTS = json.loads(Path("/workspace/scripts/demo-segments.json").read_text())
VOICE = "en-IN-NeerjaNeural"
RATE = "+5%"


async def generate_segment(index: int, text: str) -> Path:
    out = ARTIFACTS / f"demo-seg-{index:02d}.mp3"
    communicate = edge_tts.Communicate(text, VOICE, rate=RATE)
    await communicate.save(str(out))
    return out


def duration(path: Path) -> float:
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(path),
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    return float(result.stdout.strip())


def normalize_audio(input_path: Path, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(input_path),
            "-ar",
            "48000",
            "-ac",
            "2",
            "-c:a",
            "pcm_s16le",
            str(output_path),
        ],
        check=True,
        capture_output=True,
    )


def make_silence(output_path: Path, seconds: float) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-f",
            "lavfi",
            "-i",
            "anullsrc=r=48000:cl=stereo",
            "-t",
            str(seconds),
            "-c:a",
            "pcm_s16le",
            str(output_path),
        ],
        check=True,
        capture_output=True,
    )


async def main() -> None:
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    NORMALIZED.mkdir(parents=True, exist_ok=True)

    timeline = []
    concat_parts: list[Path] = []

    for index, segment in enumerate(SEGMENTS):
        raw = await generate_segment(index, segment["text"])
        normalized = NORMALIZED / f"seg-{index:02d}.wav"
        normalize_audio(raw, normalized)
        concat_parts.append(normalized)

        seg_duration = duration(normalized)
        timeline.append(
            {
                **segment,
                "index": index,
                "audioDuration": seg_duration,
                "pauseAfter": segment.get("pauseAfter", 0),
            }
        )

        pause = segment.get("pauseAfter", 0)
        if pause > 0:
            silence = NORMALIZED / f"silence-{index:02d}.wav"
            make_silence(silence, pause)
            concat_parts.append(silence)

    concat_file = ARTIFACTS / "demo-concat-list.txt"
    concat_file.write_text("\n".join(f"file '{path}'" for path in concat_parts) + "\n")

    voice_only = ARTIFACTS / "demo-voiceover-final.wav"
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(concat_file),
            "-af",
            "volume=1.4",
            "-c:a",
            "pcm_s16le",
            str(voice_only),
        ],
        check=True,
    )

    voice_duration = duration(voice_only)
    fade_out = max(0, voice_duration - 3)

    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(ARTIFACTS / "bg-music-raw.mp3"),
            "-i",
            str(voice_only),
            "-filter_complex",
            (
                f"[0:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:{voice_duration},"
                f"asetpts=PTS-STARTPTS,volume=0.25,afade=t=in:st=0:d=2,afade=t=out:st={fade_out}:d=3[bg];"
                f"[1:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=1.0[voice];"
                f"[bg][voice]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,"
                f"volume=1.5,alimiter=limit=0.98[aout]"
            ),
            "-map",
            "[aout]",
            "-ar",
            "48000",
            "-ac",
            "2",
            "-c:a",
            "pcm_s16le",
            str(ARTIFACTS / "demo-audio-final.wav"),
        ],
        check=True,
    )

    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(ARTIFACTS / "demo-audio-final.wav"),
            "-c:a",
            "libmp3lame",
            "-b:a",
            "320k",
            str(ARTIFACTS / "demo-audio-final.mp3"),
        ],
        check=True,
    )

    timeline_path = ARTIFACTS / "demo-timeline.json"
    timeline_path.write_text(
        json.dumps({"totalDuration": voice_duration, "segments": timeline}, indent=2)
    )

    vol = subprocess.run(
        [
            "ffmpeg",
            "-i",
            str(ARTIFACTS / "demo-audio-final.wav"),
            "-af",
            "volumedetect",
            "-f",
            "null",
            "-",
        ],
        capture_output=True,
        text=True,
    )
    for line in vol.stderr.splitlines():
        if "mean_volume" in line or "max_volume" in line:
            print(line.strip())

    print(f"Voice duration: {voice_duration:.2f}s")


if __name__ == "__main__":
    asyncio.run(main())
