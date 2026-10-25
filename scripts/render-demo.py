"""Edit real browser footage into a 27-second, captioned launch demo."""
import array
import json
import math
import random
import subprocess
import sys
import wave
from pathlib import Path

WORK = Path(sys.argv[1])
OUTPUT = Path(sys.argv[2])
FONT = Path('/usr/share/fonts/truetype/lato/Lato-Heavy.ttf')
REGULAR = Path('/usr/share/fonts/truetype/lato/Lato-Regular.ttf')
if not FONT.exists() or not REGULAR.exists():
    raise SystemExit('Install Lato fonts before rendering the demo.')
DURATIONS = [3.3, 5.1, 5.4, 3.5, 5.2, 5.3]
TRANSITION = 0.16
DURATION = sum(DURATIONS) - TRANSITION * 5


def run(arguments):
    subprocess.run(arguments, check=True)


def text_filter(text, name, x, y, size, color='edf0f7', regular=False):
    if '\n' in text:
        return ','.join(text_filter(line, f'{name}-{index}', x, f'{y}+{index * (size + 24)}', size, color, regular)
                        for index, line in enumerate(text.splitlines()))
    path = WORK / f'{name}.txt'
    path.write_text(text)
    font = REGULAR if regular else FONT
    return f"drawtext=fontfile={font}:textfile={path}:expansion=none:fontsize={size}:fontcolor=0x{color}:x={x}:y={y}:line_spacing=18"


def encode(arguments, target):
    run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-filter_threads', '1', *arguments,
         '-an', '-c:v', 'libx264', '-threads', '2', '-preset', 'medium', '-crf', '18',
         '-pix_fmt', 'yuv420p', '-r', '30', str(target)])


shots = json.loads((WORK / 'shots.json').read_text())['shots']
copy = [
    ('Paid.\nNot delivered.', 'The payment worked.\nThe request still failed.', 'ef91a8'),
    ('Break it.\nSafely.', 'Choose a failure.\nNo wallet. No funds.', 'b7a3ff'),
    ('Find the\nexact break.', 'Verified. Settled.\nDelivery failed.', '79d6b0'),
    ('Inspect the\ntransaction.', 'Fixture or Devnet.\nAlways labeled.', 'b7a3ff'),
    ('Keep the\nevidence.', 'Export the real trace\nas versioned JSON.', 'b7a3ff'),
]
scenes = []
for i, (shot, (heading, subtitle, accent)) in enumerate(zip(shots, copy)):
    crop = shot['crop']
    w, h, x, y = [crop[key] for key in ('width', 'height', 'x', 'y')]
    # A slow push-in adds motion without altering the recorded app state.
    filters = [
        f'crop={w}:{h}:{x}:{y}',
        'scale=1080:860:force_original_aspect_ratio=decrease',
        'pad=1080:860:(ow-iw)/2:(oh-ih)/2:color=0x101218',
        "zoompan=z='min(1+on*0.0001,1.025)':d=1:s=1080x860:fps=30",
        'pad=1920:1080:790:150:color=0x101218',
        'setsar=1',
        text_filter('settled?', f'brand-{i}', 72, 48, 36, 'b7a3ff'),
        text_filter('x402 / Solana', f'category-{i}', 1600, 58, 24, 'aeb8cc', True),
        text_filter(heading, f'heading-{i}', 72, 330, 92, accent),
        text_filter(subtitle, f'subtitle-{i}', 76, 620, 31, 'b8c2d5', True),
        text_filter('Simulated payments. Real debugging.', f'footnote-{i}', 76, 1000, 22, '929cb0', True),
        f'tpad=stop_mode=clone:stop_duration=1,trim=duration={DURATIONS[i]},setpts=PTS-STARTPTS',
    ]
    target = WORK / f'scene-{i}.mp4'
    encode(['-i', shot['path'], '-vf', ','.join(filters)], target)
    scenes.append(target)
    print(f'Edited scene {i + 1}/6', flush=True)

end_filters = [
    'drawbox=x=96:y=160:w=1728:h=2:color=0x444057:t=fill',
    text_filter('settled?', 'end-name', '(w-text_w)/2', 290, 164, 'b7a3ff'),
    text_filter('Local-first x402 debugging for Solana.', 'end-line', '(w-text_w)/2', 505, 46),
    text_filter('Free. Open source. No funds needed.', 'end-free', '(w-text_w)/2', 590, 35, 'b8c2d5', True),
    'drawbox=x=420:y=725:w=1080:h=100:color=0x29243c:t=fill',
    text_filter('github.com/royalpinto007/settled', 'end-url', '(w-text_w)/2', 756, 38),
    'fade=t=in:d=0.2,fade=t=out:st=4.9:d=0.4',
]
last = WORK / 'scene-5.mp4'
encode(['-f', 'lavfi', '-i', f'color=c=0x101218:s=1920x1080:r=30:d={DURATIONS[-1]}', '-vf', ','.join(end_filters)], last)
scenes.append(last)
print('Edited scene 6/6', flush=True)

# Original, deterministic synth bed. No stock music, samples or licensing dependency.
rate = 48000
samples = array.array('f', [0.0]) * int(DURATION * rate)
rng = random.Random(402)


def add_tone(start, length, frequency, amplitude, kind='pluck'):
    begin = int(start * rate)
    count = min(int(length * rate), len(samples) - begin)
    phase = 0.0
    for n in range(max(0, count)):
        t = n / rate
        if kind == 'kick':
            frequency_now = 46 + 115 * math.exp(-t * 27)
            phase += 2 * math.pi * frequency_now / rate
            value = math.sin(phase) * math.exp(-t * 18)
        elif kind == 'hat':
            value = (rng.random() * 2 - 1) * math.exp(-t * 90)
        else:
            envelope = min(1, t / 0.007) * math.exp(-t * (7 if kind == 'pluck' else 3))
            value = (math.sin(2 * math.pi * frequency * t) + .18 * math.sin(4 * math.pi * frequency * t)) * envelope
        samples[begin + n] += value * amplitude


beat = 60 / 112
notes = [146.83, 174.61, 220.0, 261.63, 220.0, 174.61, 164.81, 220.0]
for step in range(int(DURATION / (beat / 2))):
    t = step * beat / 2
    add_tone(t, .22, 0, .045 if step % 2 else .065, 'hat')
    add_tone(t, .5, notes[step % len(notes)] * 2, .07, 'pluck')
    if step % 2 == 0:
        add_tone(t, .35, 0, .24, 'kick')
    if step % 4 == 0:
        add_tone(t, .8, notes[(step // 4) % 4], .14, 'bass')
cut = 0
for duration in DURATIONS[:-1]:
    cut += duration - TRANSITION
    add_tone(cut, .18, 880, .09)
    add_tone(cut + .05, .16, 1320, .045)
pcm = array.array('h')
for index, value in enumerate(samples):
    t = index / rate
    fade = min(1, t / .15, max(0, (DURATION - t) / .75))
    pcm.append(int(math.tanh(value * 1.2) * .8 * fade * 32767))
audio = WORK / 'original-score.wav'
with wave.open(str(audio), 'wb') as wav:
    wav.setnchannels(1)
    wav.setsampwidth(2)
    wav.setframerate(rate)
    wav.writeframes(pcm.tobytes())

arguments = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-filter_complex_threads', '1']
for scene in scenes:
    arguments += ['-i', str(scene)]
arguments += ['-i', str(audio)]
transitions = []
previous = '0:v'
offset = 0
for i in range(1, len(scenes)):
    offset += DURATIONS[i - 1] - TRANSITION
    name = f'cut{i}'
    transitions.append(f'[{previous}][{i}:v]xfade=transition=fade:duration={TRANSITION}:offset={offset}[{name}]')
    previous = name
arguments += ['-filter_complex', ';'.join(transitions), '-map', f'[{previous}]', '-map', '6:a',
              '-t', str(DURATION), '-c:v', 'libx264', '-threads', '2', '-preset', 'medium', '-crf', '18',
              '-pix_fmt', 'yuv420p', '-af', 'volume=8dB', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
              '-movflags', '+faststart', str(OUTPUT)]
run(arguments)
run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-ss', '1.6', '-i', str(OUTPUT), '-frames:v', '1', str(OUTPUT.with_suffix('.png'))])
print(f'Encoded {DURATION:.2f}s at 1920x1080 with original AAC sound.', flush=True)
