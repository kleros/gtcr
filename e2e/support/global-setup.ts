import { RECORDING, startRecording } from './network'

/** A recording run starts from an empty store and one fixed time. */
export default function globalSetup() {
  if (RECORDING) startRecording()
}
