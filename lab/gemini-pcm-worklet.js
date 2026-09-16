/* Capture only: resample mono input to 16 kHz PCM without sending audio to speakers. */
class WorldviewPcmCapture extends AudioWorkletProcessor {
  constructor() { super(); this.samples=new Int16Array(1600); this.count=0; this.phase=0; this.sum=0; this.n=0; }
  process(inputs) {
    const input=inputs[0]?.[0];
    if(input)for(const sample of input){
      this.sum+=sample;this.n++;this.phase+=16000;
      if(this.phase>=sampleRate){
        this.phase-=sampleRate;const value=Math.max(-1,Math.min(1,this.sum/this.n));this.sum=0;this.n=0;
        this.samples[this.count++]=Math.round(value*(value<0?32768:32767));
        if(this.count===this.samples.length){this.port.postMessage(this.samples.buffer,[this.samples.buffer]);this.samples=new Int16Array(1600);this.count=0;}
      }
    }
    return true;
  }
}
registerProcessor('worldview-pcm-capture',WorldviewPcmCapture);
