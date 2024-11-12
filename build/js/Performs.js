import * as THREE  from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ScriptApp, findIndexOfBoneByName } from './ScriptApp.js';
import { KeyframeApp, computeAutoBoneMap } from './KeyframeApp.js';


export { AnimationRecorder, Performs} 