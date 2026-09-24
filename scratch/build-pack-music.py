#!/usr/bin/env python3
"""Generate 20 unique looping electronic tracks per rhythm pack."""
from __future__ import annotations

import math
import subprocess
import wave
from pathlib import Path

import numpy as np

try:
    from scipy.signal import lfilter as _lfilter
except ImportError:
    _lfilter = None

SR = 44100
BARS = 16
PACKS = {
    "rhythm-battle": {
        "bpms": [128, 132, 136, 140, 126, 144, 138, 148, 134, 142, 150, 130, 146, 152, 128, 154, 136, 148, 140, 156],
        "style": "battle",
    },
    "neon-runner": {
        "bpms": [118, 122, 128, 132, 120, 136, 140, 124, 144, 130, 148, 126, 134, 150, 122, 138, 146, 128, 142, 152],
        "style": "neon",
    },
    "mirror-rhythm": {
        "bpms": [120, 124, 128, 132, 126, 136, 140, 122, 134, 144, 130, 138, 148, 124, 142, 152, 128, 136, 146, 154],
        "style": "mirror",
    },
}
SCALES = {
    "minor": np.array([0, 2, 3, 5, 7, 8, 10]),
    "dorian": np.array([0, 2, 3, 5, 7, 9, 10]),
    "phrygian": np.array([0, 1, 3, 5, 7, 8, 10]),
    "pent": np.array([0, 3, 5, 7, 10]),
    "mixolydian": np.array([0, 2, 4, 5, 7, 9, 10]),
}
PROGS = [
    [0, 5, 3, 4],
    [0, 3, 4, 0],
    [0, 4, 5, 3],
    [0, 5, 4, 0],
    [0, 2, 4, 5],
    [0, 4, 3, 5],
]


def midi_hz(m: float) -> float:
    return 440.0 * (2.0 ** ((m - 69.0) / 12.0))


def deg_midi(root: int, scale: np.ndarray, deg: int, octv: int = 0) -> int:
    span, idx = divmod(int(deg), len(scale))
    return int(root + scale[idx] + 12 * (span + octv))


def lp(x: np.ndarray, cutoff: float) -> np.ndarray:
    x = np.asarray(x, dtype=np.float64)
    if x.size == 0:
        return x
    a = math.exp(-2.0 * math.pi * cutoff / SR)
    if _lfilter is not None:
        return _lfilter([1.0 - a], [1.0, -a], x)
    y = np.empty_like(x)
    acc = 0.0
    b = 1.0 - a
    for i, s in enumerate(x):
        acc = b * float(s) + a * acc
        y[i] = acc
    return y


def env_ad(n: int, a: float, d: float, s: float = 0.0) -> np.ndarray:
    t = np.arange(n) / SR
    attack = np.clip(t / max(a, 1e-4), 0, 1)
    decay = s + (1 - s) * np.exp(-np.maximum(t - a, 0) / max(d, 1e-4))
    return attack * decay


def kick(n: int, rng: np.random.Generator, punch: float) -> np.ndarray:
    t = np.arange(n) / SR
    freq = (150 + punch * 40) * np.exp(-t * (16 + punch * 6)) + 32
    phase = 2 * np.pi * np.cumsum(freq) / SR
    body = np.sin(phase) * np.exp(-t * 9)
    click = np.sin(2 * np.pi * 2100 * t) * np.exp(-t * 90) * 0.22
    return np.tanh((body + click) * (1.5 + punch * 0.4))


def snare(n: int, rng: np.random.Generator, snap: float) -> np.ndarray:
    t = np.arange(n) / SR
    noise = rng.uniform(-1, 1, n) * np.exp(-t * (14 + snap * 8))
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 18) * 0.35
    return np.tanh(lp(noise, 4200) * 1.4 + tone)


def hat(n: int, rng: np.random.Generator, bright: float) -> np.ndarray:
    t = np.arange(n) / SR
    noise = rng.uniform(-1, 1, n) * np.exp(-t * (48 - bright * 10))
    return lp(noise, 9000 + bright * 4000) * (0.45 + bright * 0.2)


def add(buf: np.ndarray, start: int, wave: np.ndarray, gain: float = 1.0) -> None:
    if start >= len(buf) or start < 0:
        return
    end = min(len(buf), start + len(wave))
    buf[start:end] += wave[: end - start] * gain


def saw(t: np.ndarray, f: float) -> np.ndarray:
    return 2.0 * ((t * f) % 1.0) - 1.0


def square(t: np.ndarray, f: float, pw: float = 0.5) -> np.ndarray:
    return np.where((t * f) % 1.0 < pw, 1.0, -1.0)


def sine(t: np.ndarray, f: np.ndarray | float) -> np.ndarray:
    return np.sin(2 * np.pi * f * t)


def render_song(style: str, index: int, bpm: int) -> np.ndarray:
    seed = {"battle": 20260911, "neon": 770077, "mirror": 910091}[style] + index * 131
    rng = np.random.default_rng(seed)
    beat = 60.0 / bpm
    sixteenth = beat / 4.0
    beat_n = int(round(beat * SR))
    n = int(round(BARS * 4 * beat * SR))
    left = np.zeros(n, dtype=np.float64)
    right = np.zeros(n, dtype=np.float64)

    if style == "battle":
        scale_name = ["minor", "phrygian", "pent"][index % 3]
        root = 45 + (index * 3) % 10
        punch, bright, bass_oct, lead_oct = 0.9, 0.35, 0, 2
    elif style == "neon":
        scale_name = ["minor", "dorian", "pent"][index % 3]
        root = 48 + (index * 2) % 8
        punch, bright, bass_oct, lead_oct = 0.45, 0.7, 0, 2
    else:
        scale_name = ["dorian", "mixolydian", "minor"][index % 3]
        root = 50 + (index * 2) % 7
        punch, bright, bass_oct, lead_oct = 0.3, 0.85, 1, 3

    scale = SCALES[scale_name]
    prog = PROGS[index % len(PROGS)]
    swing = 0.04 + (index % 5) * 0.018
    motif = [int(rng.integers(0, 8)) if rng.random() > 0.18 else -1 for _ in range(8)]
    bass_pat = [0, 0, 4, 0, 7, 0, 4, 3] if index % 2 == 0 else [0, 7, 0, 3, 0, 5, 4, 0]
    hat_pat = [1, 0, 1, 1, 1, 0, 1, 0] if style != "neon" else [1, 1, 1, 1, 1, 0, 1, 1]
    kick_pat = {
        "battle": [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0],
        "neon": [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0],
        "mirror": [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    }[style]
    if index % 4 == 3:
        kick_pat = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0]
    snare_on = {8, 24} if style != "battle" else {8, 24, 28} if index % 3 == 0 else {8, 24}

    # drums
    for bar in range(BARS):
        for s16 in range(16):
            step = bar * 16 + s16
            start = int(round(step * sixteenth * SR))
            if s16 % 2 == 1:
                start += int(swing * sixteenth * SR)
            if kick_pat[s16] and (bar >= 0):
                add(left, start, kick(int(0.28 * SR), rng, punch), 0.95)
                add(right, start, kick(int(0.28 * SR), rng, punch), 0.95)
            if (step % 16) in snare_on and bar >= 1:
                sn = snare(int(0.22 * SR), rng, punch)
                add(left, start, sn, 0.55 + punch * 0.15)
                add(right, start, sn, 0.55 + punch * 0.15)
            if hat_pat[s16 % 8] and not (style == "mirror" and bar < 2 and s16 % 4 != 0):
                h = hat(int(0.07 * SR), rng, bright)
                pan = 0.35 if s16 % 2 == 0 else 0.65
                add(left, start, h, (1 - pan) * 0.35)
                add(right, start, h, pan * 0.35)

    # bass / pad / lead per bar
    for bar in range(BARS):
        chord = prog[bar % 4]
        chord_root = deg_midi(root, scale, chord, bass_oct)
        third = deg_midi(root, scale, chord + 2, bass_oct + 1)
        fifth = deg_midi(root, scale, chord + 4, bass_oct + 1)
        bar_start = int(round(bar * 4 * beat * SR))
        # bass notes
        for b in range(8):
            note_i = bass_pat[b]
            midi = deg_midi(root, scale, chord + (note_i % 7), bass_oct if b % 2 == 0 else bass_oct)
            if b % 4 == 3:
                midi = chord_root + 12
            dur = int(0.42 * beat_n)
            t = np.arange(dur) / SR
            f = midi_hz(midi)
            if style == "battle":
                wave = np.tanh(saw(t, f) * 1.7 + sine(t, f * 0.5) * 0.6)
            elif style == "neon":
                wave = np.tanh(saw(t, f) * 0.9 + sine(t, f) * 0.8 + saw(t, f * 1.005) * 0.4)
            else:
                wave = sine(t, f) * 0.7 + square(t, f, 0.4) * 0.25
            wave *= env_ad(dur, 0.01, 0.16, 0.18)
            wave = lp(wave, 380 + (index % 5) * 70)
            start = bar_start + int(b * beat_n / 2)
            add(left, start, wave, 0.42)
            add(right, start, wave, 0.42)
        # pad from bar 4
        if bar >= 4:
            dur = int(4 * beat * SR)
            t = np.arange(dur) / SR
            pad = (
                saw(t, midi_hz(chord_root + 12))
                + saw(t, midi_hz(third + 12) * 1.003)
                + saw(t, midi_hz(fifth + 12) * 0.997)
            ) / 3
            pad *= env_ad(dur, 0.2, 1.4, 0.55)
            pad = lp(pad, 900 + bright * 800)
            if style == "neon":
                add(left, bar_start, pad, 0.16)
                add(right, bar_start, pad * 0.85, 0.18)
            elif style == "mirror":
                add(left, bar_start, pad, 0.12)
                add(right, bar_start, pad, 0.12)
            else:
                add(left, bar_start, pad * 0.7, 0.1)
                add(right, bar_start, pad * 0.7, 0.1)
        # lead from bar 8
        if bar >= 8:
            for s8 in range(8):
                deg = motif[s8]
                if deg < 0:
                    continue
                midi = deg_midi(root, scale, chord + deg, lead_oct)
                dur = int(0.38 * beat_n)
                t = np.arange(dur) / SR
                f = midi_hz(midi) * (1 + 0.01 * np.sin(2 * np.pi * 5.2 * t))
                if style == "battle":
                    wave = square(t, f, 0.38 + (index % 3) * 0.08)
                    wave = np.tanh(wave * 1.4)
                    g = 0.16
                elif style == "neon":
                    wave = saw(t, f) * 0.7 + sine(t, f * 2) * 0.25
                    g = 0.14
                else:
                    mod = sine(t, midi_hz(midi) * 2.02)
                    wave = np.sin(2 * np.pi * f * t + mod * 1.8 * np.exp(-t * 5))
                    g = 0.18
                wave *= env_ad(dur, 0.008, 0.12, 0.08)
                start = bar_start + int(s8 * beat_n / 2)
                if style == "mirror":
                    if s8 % 2 == 0:
                        add(left, start, wave, g)
                        add(right, start, wave * 0.25, g * 0.4)
                    else:
                        add(right, start, wave, g)
                        add(left, start, wave * 0.25, g * 0.4)
                else:
                    add(left, start, wave, g * 0.92)
                    add(right, start, wave, g)
        # neon arp 16ths in second half
        if style == "neon" and bar >= 8:
            arp = [0, 2, 4, 7, 4, 2, 0, 4]
            for s16 in range(16):
                midi = deg_midi(root, scale, chord + arp[s16 % 8], 2)
                dur = int(0.12 * beat_n)
                t = np.arange(dur) / SR
                wave = square(t, midi_hz(midi), 0.25) * env_ad(dur, 0.004, 0.05)
                start = bar_start + int(s16 * sixteenth * SR)
                add(left, start, wave, 0.07)
                add(right, start, wave, 0.09)

    # sidechain ducking on kicks
    duck = np.ones(n)
    for bar in range(BARS):
        for s16 in range(16):
            if not kick_pat[s16]:
                continue
            start = int(round((bar * 16 + s16) * sixteenth * SR))
            length = min(beat_n, n - start)
            if length <= 0:
                continue
            t = np.arange(length) / SR
            duck[start : start + length] *= 1.0 - (0.42 if style == "neon" else 0.28) * np.exp(-t * 14)
    left *= duck
    right *= duck

    stereo = np.stack([left, right], axis=1)
    peak = np.max(np.abs(stereo))
    stereo *= 0.9 / max(peak, 1e-6)
    stereo = np.tanh(stereo * 1.12)
    fade = int(0.012 * SR)
    ramp = np.linspace(0, 1, fade)
    stereo[:fade, 0] *= ramp
    stereo[:fade, 1] *= ramp
    stereo[-fade:, 0] *= ramp[::-1]
    stereo[-fade:, 1] *= ramp[::-1]
    return stereo.astype(np.float32)


def write_wav(path: Path, stereo: np.ndarray) -> None:
    pcm = np.clip(stereo * 32767.0, -32767, 32767).astype(np.int16)
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes(pcm.tobytes())


def main() -> None:
    root = Path(__file__).resolve().parents[1] / "assets" / "audio" / "packs"
    root.mkdir(parents=True, exist_ok=True)
    credits = [
        "Original electronic loops composed for 오늘의게임 rhythm packs.",
        "Each file is a unique 16-bar loop (battle / neon / mirror palettes).",
        "",
    ]
    for pack, meta in PACKS.items():
        out_dir = root / pack
        out_dir.mkdir(parents=True, exist_ok=True)
        for i, bpm in enumerate(meta["bpms"]):
            wav = out_dir / f"{i+1:02d}.wav"
            mp3 = out_dir / f"{i+1:02d}.mp3"
            print(f"{pack} {i+1:02d} @ {bpm} BPM")
            stereo = render_song(meta["style"], i, bpm)
            write_wav(wav, stereo)
            subprocess.check_call(
                [
                    "ffmpeg",
                    "-y",
                    "-i",
                    str(wav),
                    "-codec:a",
                    "libmp3lame",
                    "-b:a",
                    "112k",
                    "-ar",
                    "44100",
                    str(mp3),
                ],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            wav.unlink()
            credits.append(f"{pack}/{i+1:02d}.mp3 — {bpm} BPM")
    (root / "CREDITS.txt").write_text("\n".join(credits) + "\n", encoding="utf-8")
    print("done")


if __name__ == "__main__":
    main()
