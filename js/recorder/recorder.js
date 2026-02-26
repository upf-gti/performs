import * as THREE from 'three';
import { PERFORMS } from '../Core.js';

let zip = typeof JSZip != 'undefined' ? new JSZip() : null;

class AnimationRecorder {
    constructor(numCameras, app) {
        this.isRecording = false;
        this.timeLimit = null;
        this.clock = new THREE.Clock();
        // for each camera:
        this.mediaRecorders = [];
        this.recordedChunks = [];
        this.renderers = [];
        
        this.handleDataAvailable = this.handleDataAvailable.bind(this);
        this.handleStop = this.handleStop.bind(this);
        
        this.exportZip = true;

        this.mimeType = MediaRecorder.isTypeSupported('video/webm;') ? 'video/webm;' : 'video/mp4';
        for (let i = 0; i < numCameras; i++) {
            // offscreen renderer for each camera
            const offscreenRenderer = new THREE.WebGLRenderer( {antialias: true} );
            offscreenRenderer.setSize(window.innerWidth, window.innerHeight);
            offscreenRenderer.setPixelRatio(window.devicePixelRatio);
            offscreenRenderer.toneMapping = THREE.LinearToneMapping;
            offscreenRenderer.toneMappingExposure = 1;
            this.renderers.push(offscreenRenderer);

            if (this.renderers[i].domElement.captureStream) {
                const stream = this.renderers[i].domElement.captureStream(60);
                const options = { mimeType: this.mimeType, videoBitsPerSecond: 5 * 1024 * 1024 }; // 5 Mbps

                const mediaRecorder = new MediaRecorder(stream, options);
                mediaRecorder.ondataavailable = (event) => this.handleDataAvailable(event, i);
                mediaRecorder.onstop = () => this.handleStop(i);

                this.mediaRecorders.push( mediaRecorder );
                this.recordedChunks.push([]);
            }
            else {
                console.error("Animation Recorder Error: CaptureSteam not supported.");
            }
        };
        this.app = app;
        window.addEventListener('resize', this._onWindowResize.bind(this));
    }

    _onWindowResize() {
        for (let i = 0; i < this.renderers.length; i++) {
            this.renderers[i].setSize(window.innerWidth, window.innerHeight);
        }
    }

    async manageMultipleCapture (keyframeApp) {
        this.keyframeApp = keyframeApp;
        let animations = [];
        
        // fill with animations that need to be recorded
        for (let animationName in keyframeApp.loadedAnimations) {
            let animation = keyframeApp.loadedAnimations[animationName];
            if (!animation.record) {
                continue;
            }
            animations.push(animationName);
        }
        this.remainingAnimations = animations.length;

        // record each animation sequentially
        for (let i = 0; i < animations.length; i++) {
            const animationName = animations[i];
            let animation = keyframeApp.loadedAnimations[animationName];
            // gui update with current animation name
            if(this.onStartCapture) {
                this.onStartCapture('(' + (i+1) + '/' + animations.length+ ') ' + animationName);
            }
            await this.manageCapture(animationName, animation.bodyAnimation.duration);
        }
    }

    manageCapture (animationName, timeLimit = null) {
        if (this.app.mode == PERFORMS.Modes.SCRIPT){
            if(this.onStartCapture) {
                this.onStartCapture('');
            }
            if (this.isRecording) { 
                this.stopCapture();
            }
            else { this.startCapture("BML"); }
        }
        else if (this.app.mode == PERFORMS.Modes.KEYFRAME) {
        
            return new Promise((resolve) => {
                this.onCaptureComplete = resolve;
                const crossfade = this.keyframeApp.useCrossFade;
                this.keyframeApp.useCrossFade = false;
                this.keyframeApp.onChangeAnimation(animationName);
                this.keyframeApp.useCrossFade = crossfade;
                
                this.startCapture(animationName);
                
                // automatically stop recording after animation stops
                this.timeLimit = timeLimit; // in seconds
            });
        }
    }

    startCapture (animationName) {
        this.isRecording = true;
        this.currentAnimationName = animationName; // Store the animation name

        this.enabledRecorders = [];

        for( let i = 0; i < this.app.cameras.length; i++) {
            if(!this.app.cameras[i].record) continue;

            this.recordedChunks[i] = [];
            this.enabledRecorders.push(i);
            this.mediaRecorders[i].start();
        }
        
        // start animation
        if (this.app.mode == PERFORMS.Modes.SCRIPT){
            this.app.scriptApp.replay();
        }
        else if (this.app.mode == PERFORMS.Modes.KEYFRAME) {
            this.app.keyframeApp.changePlayState(true); // start animation                
        }
    
        this.clock.start();

        // expected files to be downloaded - for current animation
        this.pendingFiles = this.enabledRecorders.length;
    }
        
    stopCapture () {
        this.isRecording = false;

        this.enabledRecorders.forEach(idx => {
            if (this.mediaRecorders[idx].state === 'recording') {
                this.mediaRecorders[idx].stop();
            }
        });

        if (this.onStopCapture){
            this.onStopCapture();
            // reset pose on final recording stop
            if (this.app.mode == PERFORMS.Modes.SCRIPT){
                this.app.scriptApp.ECAcontroller.reset(true);
            }
        }
    }

    handleDataAvailable (event, idx) {
        if (event.data.size > 0) {
            this.recordedChunks[idx].push(event.data);
        }
    }

    handleStop (idx) {
        if (!this.enabledRecorders.includes(idx)) {
            return; // Skip if this recorder was not enabled for recording
        }

        const animationName = this.currentAnimationName;
        const blob = new Blob(this.recordedChunks[idx], {type: this.mimeType});
        const camNumber = idx + 1;
        const name =  `${animationName} ${camNumber}.webm`;

        if(!zip && this.exportZip) {
            console.error("JSZip not imported. The recordings can't be downloaded.");
        }

        if(zip && this.exportZip) {
            // Add downloaded file video to zip in the specified folder:
            zip.folder(animationName).file(name, blob);
        }
        else {
            let a = document.createElement('a'); 
            // Then trigger the download link
            a.href = URL.createObjectURL(blob);
            a.download = name;
            a.click();
        }

        this.pendingFiles--;

        // if all files for current animation are ready, resolve promise to start next animation
        if (this.pendingFiles === 0) {
            
            if (this.onCaptureComplete) {
                this.onCaptureComplete();
                this.onCaptureComplete = null; // reset callback for next animation

                // refresh gui
                if (this.app.mode == PERFORMS.Modes.SCRIPT) {
                    // reset avatar pose / stop animation
                    this.app.scriptApp.ECAcontroller.reset(true);
                }
            }
            
            // zip after ALL animations are recorded
            this.remainingAnimations--;
            if (this.remainingAnimations === 0 && zip && this.exportZip) {
                this.downloadZip();
            }
        }

        // reset clock to 0
        this.clock.stop();
        this.clock.elapsedTime = 0;
    }

    async downloadZip() {
        const blob = await zip.generateAsync({type: 'blob'});

        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'recordings.zip';
        a.click();

        zip = new JSZip(); // reset zip for next recordings
    }

    update (scene, cameras) {
        // render for all cameras
        for (let i = 0; i < this.renderers.length; i++) {
            this.renderers[i].render( scene, cameras[i] );
        }

        if (this.timeLimit && this.clock.getElapsedTime() > this.timeLimit ) {
            if(this.app.mode == PERFORMS.Modes.KEYFRAME) {
                this.app.keyframeApp.changePlayState(false);  // stop animation
            }
            this.stopCapture();
        }
    }
}

export { AnimationRecorder }