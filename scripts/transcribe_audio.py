#!/usr/bin/python3
import argparse
import json
from pathlib import Path

from faster_whisper import WhisperModel


def parse_args():
    parser = argparse.ArgumentParser(description="Transcribe local audio with faster-whisper.")
    parser.add_argument("audio")
    parser.add_argument("--out", required=True)
    parser.add_argument("--model", default="small")
    parser.add_argument("--language", default="ja")
    return parser.parse_args()


def main():
    args = parse_args()
    model = WhisperModel(args.model, device="cpu", compute_type="int8")
    language = None if args.language == "auto" else args.language
    segments_iter, info = model.transcribe(
        args.audio,
        language=language,
        beam_size=5,
        vad_filter=True,
    )
    segments = []
    for index, segment in enumerate(segments_iter):
        segments.append(
            {
                "index": index,
                "start": segment.start,
                "end": segment.end,
                "text": segment.text.strip(),
            }
        )
        if index and index % 50 == 0:
            print(f"transcribed {index} segments ({segment.end:.0f}s)", flush=True)

    payload = {
        "language": info.language,
        "language_probability": info.language_probability,
        "segments": segments,
    }
    Path(args.out).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()

