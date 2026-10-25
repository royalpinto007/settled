"""Score and mux the frame-rendered GSAP composition. No stock samples."""
import array
import math
import random
import subprocess
import sys
import wave
from pathlib import Path

WORK = Path(sys.argv[1])
OUTPUT = Path(sys.argv[2])
DURATION = 28
RATE = 48000
rng = random.Random(402)
left = array.array('f', [0.0]) * (DURATION * RATE)
right = array.array('f', [0.0]) * (DURATION * RATE)


def add(start, length, frequency=110, amplitude=.1, kind='pluck', pan=0):
    begin = int(start * RATE)
    count = min(int(length * RATE), len(left) - begin)
    phase = 0.0
    for n in range(max(0, count)):
        t = n / RATE
        if kind == 'kick':
            phase += 2 * math.pi * (45 + 100 * math.exp(-t * 32)) / RATE
            value = math.sin(phase) * math.exp(-t * 17)
        elif kind == 'tick':
            value = (rng.random() * 2 - 1) * math.exp(-t * 130)
        elif kind == 'sweep':
            envelope = math.sin(math.pi * t / length) ** 2
            value = ((rng.random() * 2 - 1) * .45 + math.sin(2 * math.pi * (170 * t + 800 * t * t)) * .12) * envelope
        elif kind == 'pad':
            envelope = min(1, t / .3, (length - t) / .4)
            value = (math.sin(2 * math.pi * frequency * t) + .25 * math.sin(2 * math.pi * frequency * 1.003 * t)) * envelope
        else:
            envelope = min(1, t / .004) * math.exp(-t * (8 if kind == 'pluck' else 4))
            value = (math.sin(2 * math.pi * frequency * t) + .16 * math.sin(4 * math.pi * frequency * t)) * envelope
        gain = amplitude * value
        left[begin + n] += gain * (1 - max(0, pan) * .5)
        right[begin + n] += gain * (1 + min(0, pan) * .5)


# Restrained opening, then a bass-led 120 BPM pulse. Editorial hits follow GSAP cues.
chords = [(110, 130.81, 164.81), (87.31, 110, 130.81), (130.81, 164.81, 196), (98, 123.47, 146.83)]
for bar in range(7):
    for index, note in enumerate(chords[bar % 4]):
        add(bar * 4, 4.1, note * 2, .022, 'pad', (index - 1) * .7)
for step in range(56):
    t = step * .5
    if t >= 3.9 and t < 25.9:
        add(t, .35, amplitude=.19, kind='kick')
        add(t + .25, .04, amplitude=.022, kind='tick', pan=.65)
        note = chords[(step // 8) % 4][0]
        add(t, .42, note / 2, .14, 'bass')
        if step % 2:
            add(t, .7, chords[(step // 8) % 4][(step // 2) % 3] * 4, .045, 'pluck', pan=-.55)
for cue in [.14, .86, 1.85, 4, 4.9, 5.55, 6.9, 9.1, 10, 10.9, 13.8, 17.65, 19.05, 24.45]:
    add(cue, .04, amplitude=.08, kind='tick')
    add(cue, .25, 880 if cue != 10.9 else 220, .055, 'pluck')
for cue in [3.0, 7.75, 13.5, 17.35, 22.4]:
    add(max(0, cue - .25), .55, amplitude=.095, kind='sweep', pan=.2)
    add(cue + .16, .35, amplitude=.20, kind='kick')
for note in [110, 164.81, 220, 261.63]:
    add(22.9, 3.7, note, .055, 'pad')

pcm = array.array('h')
for index, (a, b) in enumerate(zip(left, right)):
    t = index / RATE
    fade = min(1, t / .08, max(0, (DURATION - t) / .7))
    for value in (a, b):
        pcm.append(int(math.tanh(value) * .88 * fade * 32767))
audio = WORK / 'motion-score.wav'
with wave.open(str(audio), 'wb') as wav:
    wav.setnchannels(2)
    wav.setsampwidth(2)
    wav.setframerate(RATE)
    wav.writeframes(pcm.tobytes())
subprocess.run([
    'ffmpeg', '-v', 'error', '-y', '-i', str(WORK / 'motion-silent.mp4'), '-i', str(audio),
    '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-af', 'loudnorm=I=-17:TP=-1.5:LRA=7',
    '-c:a', 'aac', '-b:a', '192k', '-ar', str(RATE), '-ac', '2', '-t', str(DURATION),
    '-movflags', '+faststart', str(OUTPUT)
], check=True)
print(f'Muxed {DURATION}s GSAP edit with original stereo score.', flush=True)
