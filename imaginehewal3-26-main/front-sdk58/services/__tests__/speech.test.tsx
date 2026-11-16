/** Listen and Copy must do something visible in every build: speak, or say plainly why not; copy, or offer to share. */
const mockSpeak = jest.fn();
const mockStop = jest.fn();
let mockSpeechPresent = true;
let mockClipboardPresent = true;
const mockSetString = jest.fn(() => Promise.resolve());
const mockShare = jest.fn(() => Promise.resolve());

jest.mock('react-native', () => ({ Alert: { alert: jest.fn() }, Share: { share: (...a: any[]) => (mockShare as any)(...a) } }));
jest.mock('../native', () => ({
  NATIVE_NAMES: { clipboard: 'ExpoClipboard' },
  getSpeech: () => (mockSpeechPresent ? { speak: mockSpeak, stop: mockStop } : null),
  expoModulePresent: (n: string) => n === 'ExpoClipboard' && mockClipboardPresent,
}));
jest.mock('expo-clipboard', () => ({ setStringAsync: (...a: any[]) => (mockSetString as any)(...a) }), { virtual: true });

import { Alert } from 'react-native';
import { chunkForSpeech, copyText, explainNoSpeech, silentSwitchHint, speak, speechAvailable, stopSpeaking } from '../speech';

beforeEach(() => { mockSpeechPresent = true; mockClipboardPresent = true; [mockSpeak, mockStop, mockSetString, mockShare, Alert.alert as jest.Mock].forEach((m) => (m as jest.Mock).mockClear()); });

test('short text is spoken once, in the chosen voice, after stopping anything already playing', () => {
  expect(speak('Drink water.', { language: 'en' })).toBe('started');
  expect(mockStop).toHaveBeenCalled();
  expect(mockSpeak).toHaveBeenCalledTimes(1);
  expect(mockSpeak).toHaveBeenCalledWith('Drink water.', expect.objectContaining({ language: 'en-GB' }));
});

test('callbacks fire: start on the first piece, done on the last', () => {
  const onStart = jest.fn(), onDone = jest.fn();
  speak('Hello there.', { onStart, onDone });
  const opts = mockSpeak.mock.calls[0][1];
  opts.onStart(); opts.onDone();
  expect(onStart).toHaveBeenCalledTimes(1); expect(onDone).toHaveBeenCalledTimes(1);
});

test('a long answer is read in sentence-sized pieces, none too long, nothing lost', () => {
  const long = Array.from({ length: 400 }, (_, i) => `This is sentence number ${i}.`).join(' ');
  const parts = chunkForSpeech(long);
  expect(parts.length).toBeGreaterThan(1);
  expect(parts.every((p) => p.length <= 3000)).toBe(true);
  expect(parts.join(' ').replace(/\s+/g, ' ')).toBe(long);
  speak(long, { onDone: jest.fn() });
  expect(mockSpeak).toHaveBeenCalledTimes(parts.length);
  expect(mockSpeak.mock.calls[0][1].onDone).toBeUndefined();                 // only the last piece reports "done"
  expect(mockSpeak.mock.calls[parts.length - 1][1].onDone).toBeDefined();
});

test('a build without the speech module is reported, never silent', () => {
  mockSpeechPresent = false;
  expect(speechAvailable()).toBe(false);
  expect(speak('Hello')).toBe('unavailable');
  expect(mockSpeak).not.toHaveBeenCalled();
  explainNoSpeech(true);
  expect(Alert.alert).toHaveBeenCalledWith(expect.stringContaining('not in this version'), expect.stringContaining('Rebuild'));
  stopSpeaking();                                                             // and stopping is always safe
});

test('the silent switch reminder is shown once per session', () => {
  const show = jest.fn();
  silentSwitchHint(show); silentSwitchHint(show);
  expect(show).toHaveBeenCalledTimes(1);
  expect(show.mock.calls[0][0]).toMatch(/silent/i);
});

test('copy uses the clipboard when the build has it', async () => {
  await expect(copyText('Eat less salt')).resolves.toBe('copied');
  expect(mockSetString).toHaveBeenCalledWith('Eat less salt');
  expect(mockShare).not.toHaveBeenCalled();
});

test('copy falls back to the share sheet when the clipboard is missing, and says if even that fails', async () => {
  mockClipboardPresent = false;
  await expect(copyText('Eat less salt')).resolves.toBe('shared');
  expect(mockShare).toHaveBeenCalledWith({ message: 'Eat less salt' });
  mockShare.mockImplementationOnce(() => Promise.reject(new Error('no')));
  await expect(copyText('x')).resolves.toBe('failed');
});
