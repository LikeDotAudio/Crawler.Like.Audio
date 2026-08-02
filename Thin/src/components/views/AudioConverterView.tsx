"use client";

import React, { useState, useRef } from "react";
import { Upload, Music, FileAudio, Download, Play, Pause, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Script from "next/script";

export function AudioConverterView() {
  const [file, setFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [convertedFileUrl, setConvertedFileUrl] = useState<string>("");
  const [convertedFileName, setConvertedFileName] = useState<string>("");
  const [error, setError] = useState("");
  const [targetFormat, setTargetFormat] = useState<"mp3" | "wav">("mp3");
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (!selected) return;
    
    const validExtensions = [".mp3", ".wav", ".aac", ".ogg", ".flac", ".m4a"];
    const ext = "." + selected.name.toLowerCase().split('.').pop();
    
    if (!validExtensions.includes(ext)) {
      setError("Please upload a supported audio file (MP3, WAV, AAC, OGG, FLAC, M4A).");
      return;
    }

    setFile(selected);
    setAudioUrl(URL.createObjectURL(selected));
    setConvertedFileUrl("");
    setConvertedFileName("");
    setError("");
    setIsPlaying(false);
    
    if (ext === ".mp3") setTargetFormat("wav");
    else setTargetFormat("mp3");
  };

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const audioBufferToWav = (buffer: AudioBuffer): ArrayBuffer => {
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

  const encodeAudioBufferToMp3 = (buffer: AudioBuffer): Int8Array => {
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

  const handleConversion = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError("");

    try {
      // Decode audio
      const arrayBuffer = await file.arrayBuffer();
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);

      let convertedBlob: Blob;
      let newName = "";

      const isTargetWav = targetFormat === "wav";
      
      // We give it a tiny timeout so the UI can paint the "Processing..." state
      await new Promise(res => setTimeout(res, 50));

      if (isTargetWav) {
        // Convert to WAV
        const wavData = audioBufferToWav(decodedBuffer);
        convertedBlob = new Blob([wavData], { type: "audio/wav" });
        newName = file.name.substring(0, file.name.lastIndexOf('.')) + ".wav";
      } else {
        // Convert to MP3
        const mp3Data = encodeAudioBufferToMp3(decodedBuffer);
        convertedBlob = new Blob([mp3Data as any], { type: "audio/mp3" });
        newName = file.name.substring(0, file.name.lastIndexOf('.')) + ".mp3";
      }

      const objectUrl = URL.createObjectURL(convertedBlob);
      setConvertedFileUrl(objectUrl);
      setConvertedFileName(newName);
    } catch (err: any) {
      setError("Failed to convert file: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-6">
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.1/lame.min.js" strategy="lazyOnload" />
      <div className="w-full space-y-8">
        
        <header className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-white/10">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3 mb-2">
              <Music className="w-8 h-8 text-primary" /> Media Converter
            </h2>
            <p className="text-muted-foreground mt-1">Instantly convert between MP3 and WAV entirely in your browser.</p>
          </div>
          
          <div className="flex items-center gap-4">
            <label className="relative cursor-pointer group">
              <div className="absolute inset-0 bg-pink-500/20 rounded-xl blur-lg transition-all group-hover:bg-pink-500/40"></div>
              <div className="relative flex items-center gap-2 bg-pink-600 hover:bg-pink-500 text-white px-6 py-3 rounded-xl shadow-lg transition-all border border-pink-400/30 font-medium">
                <Upload size={18} />
                Upload Audio File
              </div>
              <input type="file" accept=".mp3,.wav,.aac,.ogg,.flac,.m4a" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
        </header>

        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl flex items-center gap-3">
            <span className="font-semibold">Error:</span> {error}
          </motion.div>
        )}

        {!file && !error && (
          <div className="mt-8 bg-slate-900/30 border border-slate-800/50 rounded-3xl p-16 text-center max-w-3xl mx-auto shadow-2xl flex flex-col items-center gap-6">
            <div className="w-24 h-24 bg-pink-500/10 rounded-full flex items-center justify-center">
              <Music size={40} className="text-pink-400" />
            </div>
            <h2 className="text-2xl font-semibold text-slate-200">Upload an Audio File</h2>
            <p className="text-slate-400 max-w-md">Input: MP3, WAV, AAC, OGG, FLAC, M4A.<br/>Output: MP3 or WAV.<br/>Conversion is processed instantly on your local machine.</p>
          </div>
        )}

        {file && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid lg:grid-cols-2 gap-8 mt-8 max-w-5xl mx-auto">
            {/* Input Section */}
            <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 p-8 rounded-3xl shadow-xl flex flex-col items-center justify-center relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Music size={120} />
              </div>
              <div className="z-10 flex flex-col items-center text-center">
                <FileAudio size={48} className="text-pink-400 mb-4" />
                <h3 className="text-xl font-bold text-slate-200 mb-1 line-clamp-1 max-w-[300px]" title={file.name}>
                  {file.name}
                </h3>
                <p className="text-sm text-slate-400 mb-6 font-mono">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                
                <audio 
                  ref={audioRef} 
                  src={audioUrl} 
                  onEnded={() => setIsPlaying(false)}
                  onPause={() => setIsPlaying(false)}
                  onPlay={() => setIsPlaying(true)}
                  className="hidden" 
                />
                
                <button 
                  onClick={togglePlay}
                  className="w-16 h-16 bg-slate-800 hover:bg-slate-700 text-white rounded-full flex items-center justify-center shadow-lg border border-slate-700 transition-all mb-8"
                >
                  {isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
                </button>
                
                <div className="w-full text-left mb-6">
                  <label className="text-sm font-semibold text-slate-400 mb-2 block">Convert to format:</label>
                  <select 
                    value={targetFormat}
                    onChange={(e) => {
                      setTargetFormat(e.target.value as "mp3" | "wav");
                      setConvertedFileUrl("");
                    }}
                    className="w-full bg-slate-950 border border-slate-700 text-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all appearance-none"
                  >
                    <option value="mp3" disabled={file.name.toLowerCase().endsWith('.mp3')}>MP3 (Compressed)</option>
                    <option value="wav" disabled={file.name.toLowerCase().endsWith('.wav')}>WAV (Lossless)</option>
                  </select>
                </div>
                
                <button
                  onClick={handleConversion}
                  disabled={isProcessing || !!convertedFileUrl}
                  className="relative group w-full overflow-hidden rounded-xl"
                >
                  <div className={`absolute inset-0 transition-all ${isProcessing ? 'bg-orange-500/40' : 'bg-gradient-to-r from-pink-600 to-orange-500 group-hover:opacity-90'}`}></div>
                  <div className="relative flex items-center justify-center gap-2 px-6 py-4 text-white font-bold tracking-wide">
                    {isProcessing ? (
                      <>
                        <RefreshCw size={20} className="animate-spin" />
                        Converting...
                      </>
                    ) : convertedFileUrl ? (
                      <>Converted!</>
                    ) : (
                      <>
                        <RefreshCw size={20} />
                        Convert to {targetFormat.toUpperCase()}
                      </>
                    )}
                  </div>
                </button>
              </div>
            </div>

            {/* Output Section */}
            <AnimatePresence>
              {convertedFileUrl && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }} 
                  animate={{ opacity: 1, scale: 1 }} 
                  className="bg-gradient-to-br from-slate-900 to-slate-800 backdrop-blur-xl border border-pink-500/20 p-8 rounded-3xl shadow-xl flex flex-col items-center justify-center relative overflow-hidden"
                >
                  <div className="absolute -top-10 -right-10 w-40 h-40 bg-pink-500/20 blur-3xl rounded-full"></div>
                  <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-orange-500/20 blur-3xl rounded-full"></div>
                  
                  <div className="z-10 flex flex-col items-center text-center">
                    <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mb-6 shadow-lg border border-emerald-500/30">
                      <Download size={32} />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-100 mb-2">Success!</h3>
                    <p className="text-slate-400 mb-8 max-w-[280px]">
                      Your file has been successfully converted to <strong>{convertedFileName.endsWith('.wav') ? 'WAV' : 'MP3'}</strong> format.
                    </p>
                    
                    <a 
                      href={convertedFileUrl} 
                      download={convertedFileName}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 px-8 rounded-xl shadow-lg transition-all border border-emerald-400/30 flex items-center justify-center gap-2 hover:scale-[1.02]"
                    >
                      <Download size={20} />
                      Download {convertedFileName}
                    </a>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
}
