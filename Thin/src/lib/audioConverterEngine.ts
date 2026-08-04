export interface ConversionOptions {
  file: File;
  targetFormat: "mp3" | "wav";
}

export interface ConversionResult {
  blob: Blob;
  newName: string;
}

export const audioBufferToWav = (buffer: AudioBuffer): ArrayBuffer => {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const out = new ArrayBuffer(length);
  const view = new DataView(out);
  const channels = [];
  let sample = 0;
  let offset = 0;
  let pos = 0;

  const setString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  setString(0, 'RIFF');
  view.setUint32(4, 36 + buffer.length * 2 * numOfChan, true);
  setString(8, 'WAVE');
  setString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numOfChan, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * 2 * numOfChan, true);
  view.setUint16(32, numOfChan * 2, true);
  view.setUint16(34, 16, true);
  setString(36, 'data');
  view.setUint32(40, buffer.length * 2 * numOfChan, true);

  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  offset = 44;
  while (pos < buffer.length) {
    for (let i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][pos]));
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      view.setInt16(offset, sample, true);
      offset += 2;
    }
    pos++;
  }

  return out;
};

export const encodeAudioBufferToMp3 = (buffer: AudioBuffer): Int8Array => {
  const lamejs = (window as any).lamejs;
  if (!lamejs) throw new Error("MP3 Encoder is not loaded yet.");
  
  const channels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const mp3encoder = new lamejs.Mp3Encoder(channels, sampleRate, 192); // 192kbps
  
  const mp3Data: Int8Array[] = [];
  const left = buffer.getChannelData(0);
  const right = channels > 1 ? buffer.getChannelData(1) : left;
  const sampleBlockSize = 1152;
  
  const floatToInt16 = (f32: Float32Array): Int16Array => {
    const i16 = new Int16Array(f32.length);
    for (let i = 0; i < f32.length; i++) {
      let s = Math.max(-1, Math.min(1, f32[i]));
      i16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return i16;
  };
  
  const left16 = floatToInt16(left);
  const right16 = floatToInt16(right);
  
  for (let i = 0; i < left16.length; i += sampleBlockSize) {
    const leftChunk = left16.subarray(i, i + sampleBlockSize);
    const rightChunk = right16.subarray(i, i + sampleBlockSize);
    const mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
    if (mp3buf.length > 0) {
      mp3Data.push(mp3buf);
    }
  }
  const mp3buf = mp3encoder.flush();
  if (mp3buf.length > 0) {
    mp3Data.push(mp3buf);
  }
  
  const totalLength = mp3Data.reduce((acc, val) => acc + val.length, 0);
  const result = new Int8Array(totalLength);
  let offset = 0;
  for (let i = 0; i < mp3Data.length; i++) {
    result.set(mp3Data[i], offset);
    offset += mp3Data[i].length;
  }
  return result;
};

export const processAudioFile = async (options: ConversionOptions): Promise<ConversionResult> => {
  const { file, targetFormat } = options;
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);

  let convertedBlob: Blob;
  let newName = "";
  const isTargetWav = targetFormat === "wav";

  if (isTargetWav) {
    const wavData = audioBufferToWav(decodedBuffer);
    convertedBlob = new Blob([wavData], { type: "audio/wav" });
    newName = file.name.substring(0, file.name.lastIndexOf('.')) + ".wav";
  } else {
    const mp3Data = encodeAudioBufferToMp3(decodedBuffer);
    convertedBlob = new Blob([mp3Data as any], { type: "audio/mp3" });
    newName = file.name.substring(0, file.name.lastIndexOf('.')) + ".mp3";
  }

  return { blob: convertedBlob, newName };
};
