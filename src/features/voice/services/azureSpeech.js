import { CLEAR_SPEECH_EQ, EQ_PRESET, normalizeEqPreset } from '../model/eqPreset.js'

let activePlayback = null
let audioContext = null
let sdkPromise = null
let speechGeneration = 0

function loadSdk() {
  if (!sdkPromise) {
    sdkPromise = import('microsoft-cognitiveservices-speech-sdk').catch((cause) => {
      sdkPromise = null
      throw cause
    })
  }
  return sdkPromise
}

export function hasSpeechCredential(credential) {
  return Boolean(credential?.token && credential?.region)
}

export function isAzureSpeaking() {
  return Boolean(activePlayback)
}

function getAudioContext() {
  if (audioContext) return audioContext
  const AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext
  if (!AudioContextClass) throw new Error('WEB_AUDIO_UNAVAILABLE')
  audioContext = new AudioContextClass()
  return audioContext
}

function closePlayback(playback) {
  try {
    playback.source?.stop()
  } catch {
    // 이미 끝난 source다.
  }
  try {
    playback.synthesizer?.close()
  } catch {
    // 이미 닫힌 synthesizer다.
  }
  try {
    playback.audioConfig?.close()
    playback.outputStream?.close()
  } catch {
    // 출력 스트림 정리는 best effort다.
  }
}

function releasePlayback(playback) {
  if (activePlayback === playback) activePlayback = null
  closePlayback(playback)
}

/** 재생 중인 안내를 즉시 끊는다. Web Audio source와 Azure 합성을 함께 정리한다. */
export function stopAzureSpeech() {
  speechGeneration += 1
  const playback = activePlayback
  if (!playback) return

  activePlayback = null
  playback.cancelled = true
  if (playback.source) playback.source.onended = null
  playback.settle({ spoken: false, reason: 'STOPPED' })
  closePlayback(playback)
}

function connectEqPipeline(context, source, preset) {
  const compressor = context.createDynamicsCompressor()
  compressor.threshold.value = -18
  compressor.knee.value = 20
  compressor.ratio.value = 8
  compressor.attack.value = 0.003
  compressor.release.value = 0.25

  if (preset === EQ_PRESET.CLEAR_SPEECH) {
    const highPass = context.createBiquadFilter()
    highPass.type = 'highpass'
    highPass.frequency.value = CLEAR_SPEECH_EQ.highPass.frequency
    highPass.Q.value = CLEAR_SPEECH_EQ.highPass.q

    const peaking = context.createBiquadFilter()
    peaking.type = 'peaking'
    peaking.frequency.value = CLEAR_SPEECH_EQ.peaking.frequency
    peaking.gain.value = CLEAR_SPEECH_EQ.peaking.gain
    peaking.Q.value = CLEAR_SPEECH_EQ.peaking.q

    source.connect(highPass)
    highPass.connect(peaking)
    peaking.connect(compressor)
  } else {
    source.connect(compressor)
  }
  compressor.connect(context.destination)
}

async function playAudioData(playback, audioData, preset, generation) {
  const context = getAudioContext()
  await context.resume()
  const bytes = audioData instanceof ArrayBuffer ? audioData.slice(0) : audioData?.buffer?.slice(0)
  if (!bytes) throw new Error('AZURE_AUDIO_MISSING')
  const buffer = await context.decodeAudioData(bytes)
  if (generation !== speechGeneration || playback.cancelled) return

  const source = context.createBufferSource()
  source.buffer = buffer
  playback.source = source
  connectEqPipeline(context, source, normalizeEqPreset(preset))
  source.onended = () => {
    if (playback.cancelled || activePlayback !== playback) return
    releasePlayback(playback)
    playback.settle({ spoken: true, reason: null, fallback: false })
  }
  source.start()
}

/** Azure audioData를 Web Audio로 재생한다. SSML은 서버 결과를 그대로 사용한다. */
export async function speakSsmlWithAzure(ssml, credential, options = {}) {
  stopAzureSpeech()
  const generation = ++speechGeneration
  const speechSdk = await loadSdk()
  if (generation !== speechGeneration) return { spoken: false, reason: 'STOPPED' }

  const config = speechSdk.SpeechConfig.fromAuthorizationToken(credential.token, credential.region)
  config.speechSynthesisOutputFormat = speechSdk.SpeechSynthesisOutputFormat.Riff24Khz16BitMonoPcm
  const outputStream = speechSdk.AudioOutputStream.createPullStream()
  const audioConfig = speechSdk.AudioConfig.fromStreamOutput(outputStream)
  const synthesizer = new speechSdk.SpeechSynthesizer(config, audioConfig)

  return new Promise((resolve, reject) => {
    let settled = false
    const playback = {
      synthesizer,
      audioConfig,
      outputStream,
      source: null,
      cancelled: false,
      settle: (result) => {
        if (settled) return
        settled = true
        resolve(result)
      },
      fail: (cause) => {
        if (settled) return
        settled = true
        reject(cause)
      },
    }
    activePlayback = playback

    synthesizer.speakSsmlAsync(
      ssml,
      async (result) => {
        if (result?.reason !== speechSdk.ResultReason.SynthesizingAudioCompleted) {
          releasePlayback(playback)
          playback.fail(new Error(result?.errorDetails || '음성을 합성하지 못했어요.'))
          return
        }
        try {
          await playAudioData(playback, result.audioData, options.eqPreset, generation)
          if (generation !== speechGeneration || playback.cancelled) {
            playback.settle({ spoken: false, reason: 'STOPPED' })
          }
        } catch (cause) {
          releasePlayback(playback)
          playback.fail(cause)
        }
      },
      (cause) => {
        releasePlayback(playback)
        playback.fail(new Error(String(cause)))
      },
    )
  })
}
