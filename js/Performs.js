import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { AnimationRecorder } from './recorder/recorder.js';
import { GUI } from './GUI.js';
import { ScriptApp } from './ScriptApp.js';
import { KeyframeApp } from './KeyframeApp.js';
import { findIndexOfBoneByName } from './sigml/Utils.js';
import { computeAutoBoneMap } from './retargeting/retargeting.js'

// Correct negative blenshapes shader of ThreeJS
THREE.ShaderChunk[ 'morphnormal_vertex' ] = "#ifdef USE_MORPHNORMALS\n	objectNormal *= morphTargetBaseInfluence;\n	#ifdef MORPHTARGETS_TEXTURE\n		for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {\n	    objectNormal += getMorph( gl_VertexID, i, 1, 2 ) * morphTargetInfluences[ i ];\n		}\n	#else\n		objectNormal += morphNormal0 * morphTargetInfluences[ 0 ];\n		objectNormal += morphNormal1 * morphTargetInfluences[ 1 ];\n		objectNormal += morphNormal2 * morphTargetInfluences[ 2 ];\n		objectNormal += morphNormal3 * morphTargetInfluences[ 3 ];\n	#endif\n#endif";
THREE.ShaderChunk[ 'morphtarget_pars_vertex' ] = "#ifdef USE_MORPHTARGETS\n	uniform float morphTargetBaseInfluence;\n	#ifdef MORPHTARGETS_TEXTURE\n		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];\n		uniform sampler2DArray morphTargetsTexture;\n		uniform vec2 morphTargetsTextureSize;\n		vec3 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset, const in int stride ) {\n			float texelIndex = float( vertexIndex * stride + offset );\n			float y = floor( texelIndex / morphTargetsTextureSize.x );\n			float x = texelIndex - y * morphTargetsTextureSize.x;\n			vec3 morphUV = vec3( ( x + 0.5 ) / morphTargetsTextureSize.x, y / morphTargetsTextureSize.y, morphTargetIndex );\n			return texture( morphTargetsTexture, morphUV ).xyz;\n		}\n	#else\n		#ifndef USE_MORPHNORMALS\n			uniform float morphTargetInfluences[ 8 ];\n		#else\n			uniform float morphTargetInfluences[ 4 ];\n		#endif\n	#endif\n#endif";
THREE.ShaderChunk[ 'morphtarget_vertex' ] = "#ifdef USE_MORPHTARGETS\n	transformed *= morphTargetBaseInfluence;\n	#ifdef MORPHTARGETS_TEXTURE\n		for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {\n			#ifndef USE_MORPHNORMALS\n				transformed += getMorph( gl_VertexID, i, 0, 1 ) * morphTargetInfluences[ i ];\n			#else\n				transformed += getMorph( gl_VertexID, i, 0, 2 ) * morphTargetInfluences[ i ];\n			#endif\n		}\n	#else\n		transformed += morphTarget0 * morphTargetInfluences[ 0 ];\n		transformed += morphTarget1 * morphTargetInfluences[ 1 ];\n		transformed += morphTarget2 * morphTargetInfluences[ 2 ];\n		transformed += morphTarget3 * morphTargetInfluences[ 3 ];\n		#ifndef USE_MORPHNORMALS\n			transformed += morphTarget4 * morphTargetInfluences[ 4 ];\n			transformed += morphTarget5 * morphTargetInfluences[ 5 ];\n			transformed += morphTarget6 * morphTargetInfluences[ 6 ];\n			transformed += morphTarget7 * morphTargetInfluences[ 7 ];\n		#endif\n	#endif\n#endif";

class Performs {
    static Modes = { SCRIPT: 0, KEYFRAME: 1 };
    static Backgrounds = { OPEN:0, STUDIO: 1, PHOTOCALL: 2};
    static ATELIER_URL = "https://webglstudio.org/projects/signon/performs-atelier/";
    constructor() {
        
        this.elapsedTime = 0; // clock is ok but might need more time control to dinamicaly change signing speed
        this.clock = new THREE.Clock();
        this.loaderGLB = new GLTFLoader();
        
        this.scene = null;
        this.renderer = null;
        this.camera = null;
        this.cameras = [];
        this.controls = [];
        this.cameraMode = 0;

        this.loadedCharacters = {};
        this.currentCharacter = null;

        this.speed = 1;
        this.backPlane = null;
        this.avatarShirt = null;
        this.autoplay = false;

        this.mode = Performs.Modes.SCRIPT;
        this.scriptApp = new ScriptApp();        
        this.keyframeApp = new KeyframeApp();   
        
        this.isAppReady = false;
        this.pendingMessageReceived = null;
        this.showControls = true;

        this.sceneColor = 0x46c219;
        this.background = Performs.Backgrounds.OPEN;

        this.logo = "./data/imgs/performs2.png";
        this._atelier = null;

        this.raycaster = new THREE.Raycaster();
    }

    setSpeed( value ){ this.speed = value; }
    // value (hex colour) in sRGB space 
    setBackPlaneColour( value ){
        this.sceneColor = value;
        this.scene.background.set(value);

        if ( this.backPlane ){ 
            if(this.backPlane.material.color) {
                this.backPlane.material.color.set( value );   
            }
            else {
                this.photocallMaterial.uniforms.color.value.set(value);
                this.backPlane.material.uniforms.color.value.set(value);
                this.backPlane.material.needsUpdate = true;
            }
        }                

        if(this.ground) {
            this.ground.material.color.set( value ); 
        }
        return true;
    }
    
    setBackground( type, image = null ) {
        this.background = type;

        switch(type) {
            case Performs.Backgrounds.OPEN:
                this.backPlane.visible = false;
                this.ground.visible = true;
                break;
            case Performs.Backgrounds.STUDIO:
                this.backPlane.visible = true;
                // this.backPlane.material.map = null;        
                this.backPlane.material = this.studioMaterial;                    
                this.backPlane.material.color.set(this.sceneColor);
                this.backPlane.material.needsUpdate = true;
                this.ground.visible = false;
               
                break;
            case Performs.Backgrounds.PHOTOCALL:
                this.backPlane.visible = true;
                this.ground.visible = false;
                // let texture = null;
                if(image) {
                    if(typeof(image) == 'string') {
                        this.logoTexture = new THREE.TextureLoader().load( this.logo);
    
                    }
                    else {
                        this.logoTexture = new THREE.Texture( this.logo );
                        this.logoTexture.colorSpace = THREE.SRGBColorSpace;
                    }                           
                    this.logoTexture.needsUpdate = true;

                    const shader = this.backPlane.material.userData.shader;
                    if ( shader ) {

                        shader.uniforms.textureMap.value = this.logoTexture;

                    }
                    else {
                        this.photocallMaterial.uniforms.textureMap.value = this.logoTexture;      

                    }
                }
                this.backPlane.material = this.photocallMaterial;

                if(this.backPlane.material.color) {
                    this.backPlane.material.color.set(this.sceneColor);
                }
                else {
                    this.backPlane.material.uniforms.color.value.set(this.sceneColor);
                }

                this.backPlane.material.needsUpdate = true;
                break;
        }
    }
        
    setPhotocallOffset(offset) {
        if(!this.backPlane.material.uniforms) {
            const shader = this.backPlane.material.userData.shader;
            if ( shader ) {
                shader.uniforms.offset.value = offset;
            }
        }
        else {
            this.backPlane.material.uniforms.offset.value = offset;
        }
        this.backPlane.material.needsUpdate = true;
        this.repeatOffset = offset;
    }

    // value (hex colour) in sRGB space 
    setClothesColour( value ){
        if ( !this.avatarShirt ){ return false; }
        this.avatarShirt.material.color.set( value );   
        return true;
    }

    
    // Change the default settings for the scene and the applications mode options
    async setConfiguration(settings) {
        const innerAvatarSettings = (settings) => {
            if(settings.cloth) {
                let clothColor = settings.cloth;
                if(typeof(clothColor) == 'string'){
                    clothColor = clothColor.replace('0x', '#');
                }
                this.setClothesColour(clothColor);
            }

            if(settings.position) {
                let position = settings.position;
                position = position.split(',');
                position = position.map(v => v = Number(v));
                this.currentCharacter.model.position.fromArray(position);
            }

            if(settings.scale) {
                let scale = settings.scale;
                scale = Number(scale);
                this.currentCharacter.model.scale.fromArray([scale, scale, scale]);
            }
            
            if(settings.animations) {
                this.keyframeApp.processMessageFiles( settings.animations).then(
                    (animations) => {
                        this.keyframeApp.currentAnimation = animations[0];
                        this.changeMode(Performs.Modes.KEYFRAME);
                        if(this.autoplay) {
                            this.keyframeApp.changePlayState(true);
                        }
                        if(settings.onReady) {
                            settings.onReady();
                        }
                    }
                )
            }
            else if(settings.scripts) {
                this.scriptApp.processMessageFiles(settings.scripts).then(
                    (results) => {
                        this.scriptApp.onMessage(results);
                        this.changeMode(Performs.Modes.SCRIPT);
                        if(this.autoplay) {
                            this.scriptApp.replay();
                        }
                        if(settings.onReady) {
                            settings.onReady();
                        }
                    }
                );
            }
            else if(settings.onReady) {
                settings.onReady();
            }
        }

        let rotation = null;
        if(settings.rotation) {
            rotation = settings.rotation;
            rotation = rotation.split(',');    
            rotation = rotation.map(v => v = Number(v));        
        }
        
        if(settings.autoplay != undefined) {
            this.autoplay = settings.autoplay;
        }
        
        if(settings.crossfade != undefined) {
            this.keyframeApp.useCrossFade = settings.crossfade;
        }

        if(settings.srcEmbeddedTransforms != undefined) {
            this.keyframeApp.srcEmbedWorldTransforms = settings.srcEmbeddedTransforms;
        }
        if(settings.trgEmbeddedTransforms != undefined) {
            this.keyframeApp.trgEmbedWorldTransforms = settings.trgEmbeddedTransforms;
        }

        if(settings.srcReferencePose != undefined) {
            this.keyframeApp.srcPoseMode = settings.srcReferencePose;
        }
        if(settings.trgReferencePose != undefined) {
            this.keyframeApp.trgPoseMode = settings.trgReferencePose;
        }

        let loadConfig = true;
        if(settings.avatar) {
            let avatar = settings.avatar;
            const path = avatar.split(".");
            let filename = path[path.length-2];
            filename = filename.split("/");
            filename = filename.pop();
            
            if(!this.currentCharacter || this.currentCharacter && this.currentCharacter.model.name != filename) {
                loadConfig = false;
                $('#loading').fadeIn(); 
                let thumbnail = null;
                if( avatar.includes('models.readyplayer.me') ) {
                    avatar+= '?pose=T&morphTargets=ARKit&lod=1';
                    thumbnail =  "https://models.readyplayer.me/" + filename + ".png?background=68,68,68";
                }
                if(this.gui) {
                    this.gui.avatarOptions[filename] = [avatar, settings.config, rotation || new THREE.Quaternion(), thumbnail];
                }
                this.loadAvatar(avatar, settings.config, rotation || new THREE.Quaternion(), filename, () => {
                    this.changeAvatar( filename );
                    innerAvatarSettings(settings);
    
                    $('#loading').fadeOut(); //hide();               
                });
            }
            
        }
        if(loadConfig) {
            innerAvatarSettings(settings);
            if(settings.config) {
                let name = this.currentCharacter.model.name;
                try {
                    const response = await fetch(settings.config);
                    if (!response.ok) {
                        throw new Error(`Response status: ${response.status}`);
                    }
                    let config = await response.json();                        
                    config._filename = settings.config; 

                    this.currentCharacter.config = config;
                    this.scriptApp.onLoadAvatar(this.currentCharacter.model, this.currentCharacter.config, this.currentCharacter.skeleton);
                    this.currentCharacter.skeleton.pose();
                    this.scriptApp.ECAcontroller.reset();                        
                    this.changeMode(Performs.Modes.SCRIPT);
                    if(this.gui) {
                        this.gui.avatarOptions[name][1] = config._filename;
                        if(this.gui.settingsActive) {
                            this.gui.createSettingsPanel();             
                        }
                    }
                }
                catch (error) {
                    console.error(error.message, "File error!");
                }
            }
            if(rotation) {
                this.currentCharacter.model.quaternion.fromArray(rotation);
            }
        }

        if(settings.controls != undefined) {
            this.showControls = !(settings.controls === "false" || settings.controls === false);
        }

        // Default background
        if(settings.background) {
            let background = settings.background;
            switch(background.toLocaleLowerCase()) {
                case 'studio':
                    this.background = Performs.Backgrounds.STUDIO;
                    break;
                case 'photocall':
                        this.background = Performs.Backgrounds.PHOTOCALL;
                        break;
                default:
                    break;
            }
            this.setBackground(this.background);            
        }

        if(settings.img) {
            this.setBackground( Performs.Backgrounds.PHOTOCALL);         

            let image =settings.img;
            const imgCallback = ( event ) => {

                this.logo = event.target;        
                this.setBackground( Performs.Backgrounds.PHOTOCALL, this.logo);         
            }

            const img = new Image();            
            img.onload = imgCallback;    
            fetch(image)
            .then(function (response) {
                if (response.ok) {
                response.blob().then(function (miBlob) {
                    var objectURL = URL.createObjectURL(miBlob);
                    img.src = objectURL;
                });
                } else {
                console.log("Bad request");
                }
            })
            .catch(function (error) {
                console.log("Error:" + error.message);
            });        

        }

        // Default background color
        if(settings.color) {
            if(typeof(settings.color) == 'string'){
                settings.color = settings.color.replace('0x', '#');
            }
            this.sceneColor = settings.color;
            this.setBackPlaneColour(this.sceneColor);                                  
        }

        if(settings.offset) {
            let offset = Number(settings.offset);
            this.setPhotocallOffset(offset);
        }

        // Default light color
        if(settings.light) {
            let light = settings.light;
            if(typeof(light) == 'string'){
                light = light.replace('0x', '#');
            }
            this.dirLight.color.set(light);                          
        }

        // Default light position
        if(settings.lightpos) {
            let light = settings.lightpos;
            light = light.split(',');
            if(light.length == 3) {
                this.dirLight.position.set(Number(light[0]), Number(light[1]), Number(light[2]));                  
            }           
        }
        
        if(settings.restrictView != undefined) {
            let view = (settings.restrictView === "false" || settings.restrictView === false);
            this.changeCameraMode( view ); //moved here because it needs the backplane to exist
        }

        if(settings.applyIdle != undefined) {
            this.scriptApp.applyIdle = settings.applyIdle;
        }
    }

    // Change app mode: Keyframe or Script
    changeMode( mode ) {
        this.mode = mode;
        if(this.currentCharacter) {
            this.currentCharacter.skeleton.pose();
        }
        if(this.scriptApp.ECAcontroller) {
            this.scriptApp.ECAcontroller.reset();
            this.scriptApp.ECAcontroller.update(0,0);
        }

        if(this.gui) {
            this.gui.onChangeMode(mode);
        }
        if(this.mode == Performs.Modes.KEYFRAME && this.keyframeApp.currentAnimation) {
            this.keyframeApp.onChangeAnimation(this.keyframeApp.currentAnimation);
            if(this.autoplay) {
                this.keyframeApp.changePlayState(true);
            }
        }
    }

    getSpeed( ){ return this.speed; }

    // returns value (hex) with the colour in sRGB space
    getBackPlaneColour(){       
        return this.sceneColor; // css works in sRGB
    }

    // returns value (hex) with the colour in sRGB space
    getClothesColour(){
        if ( !this.avatarShirt ){ return 0; }   
        return this.avatarShirt.material.color.getHexString(); // css works in sRGB
    }

    init(options) {        
        this.scene = new THREE.Scene();
        const sceneColor = this.sceneColor = window.debugMode ? 0x4f4f9c : 0x46c219;
        this.scene.background = new THREE.Color( sceneColor );

        // renderer
        this.renderer = new THREE.WebGLRenderer( { antialias: true } );
        this.renderer.setPixelRatio( window.devicePixelRatio );
        this.renderer.setSize( window.innerWidth, window.innerHeight );

        this.renderer.toneMapping = THREE.LinearToneMapping;
        this.renderer.toneMappingExposure = 1;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.VSMShadowMap;
        
        // camera views
        this.createCameras();
   
        // lights
        this.createLights();

        // background
        this.createBackgrounds();

        // animation recorder
        this.createRecorder();

        // so the screen is not black while loading
        this.changeCameraMode( false ); //moved here because it needs the backplane to exist
        this.renderer.render( this.scene, this.cameras[this.camera] );        
        this.scriptApp.init(this.scene);
    
        if(!options)  {
            options = {};
            // Get URL params to configurate the scene
            const queryString = window.location.search;
            const urlParams = new URLSearchParams(queryString);       
            for (const [key, value] of urlParams.entries()) {
                options[key] = value;
            }
        }

        let modelToLoad = ['https://webglstudio.org/3Dcharacters/Eva_Low/Eva_Low.glb', 'https://webglstudio.org/3Dcharacters/Eva_Low/Eva_Low.json', (new THREE.Quaternion()).setFromAxisAngle( new THREE.Vector3(1,0,0), 0 ), "EvaLow" ];
        
        // Default avatar & config file
        if(options.avatar) {
            let avatar = options.avatar;
            const path = avatar.split(".");
            let filename = path[path.length-2];
            filename = filename.split("/");
            filename = filename.pop();
            
            avatar += avatar.includes('models.readyplayer.me') ? '?pose=T&morphTargets=ARKit&lod=1' : '';

            modelToLoad = [ avatar, options.config, new THREE.Quaternion(), filename];          
        }

        if(options.rotation) {
            let rotation = options.rotation;
            rotation = rotation.split(',');
            modelToLoad[2].fromArray(rotation);
        }
        
        // Load default avatar
        this.loadAvatar(modelToLoad[0], modelToLoad[1], modelToLoad[2], modelToLoad[3], () => {
            this.changeAvatar( modelToLoad[3] );
          
            this.setConfiguration(options);
            // Create the GUI only if the class exists or the showControls flag is true
            if ( typeof GUI != "undefined" && this.showControls) { 
                this.gui = new GUI( this ); 
                if(!this.gui.avatarOptions[modelToLoad[3]]) {
                    const name = modelToLoad[3];
                    modelToLoad[3] = modelToLoad[0].includes('models.readyplayer.me') ? ("https://models.readyplayer.me/" + name + ".png?background=68,68,68") : GUI.THUMBNAIL;
                    this.gui.avatarOptions[name] = modelToLoad;
                    this.gui.refresh();
                }
            }
            else {
                window.document.body.appendChild(this.renderer.domElement);
            }

            $('#loading').fadeOut(); //hide();
            this.animate();
            this.isAppReady = true;
                        
            if(this.pendingMessageReceived) {
                this.onMessage( this.pendingMessageReceived );
                this.pendingMessageReceived = null; // although onMessage is async, the variable this.pendingMessageReceived is not used. So it is safe to delete
            }
        });

        // Create event listeners
        window.addEventListener( "message", this.onMessage.bind(this) );
        window.addEventListener( 'resize', this.onWindowResize.bind(this) );
    }
    
    newCameraFrom({azimuthAngle = 0, polarAngle = 0, depth = 0, controlsEnabled = false}) {
        let camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.01, 1000);
        camera.record = true;
        let controls = new OrbitControls( camera, this.renderer.domElement );

        controls.target.set(0, 1.3, 0);
        let newPos = new THREE.Vector3( 0, 1.5, Math.cos(5*Math.PI/180) );
        let distance = newPos.distanceTo(controls.target);

        let dir = new THREE.Vector3().subVectors(newPos, controls.target).normalize();
        dir.applyAxisAngle(new THREE.Vector3(1,0,0), polarAngle * Math.PI / 180);
        dir.applyAxisAngle(new THREE.Vector3(0,1,0), azimuthAngle * Math.PI / 180);
        newPos.addVectors(controls.target, dir.multiplyScalar(distance));
        newPos.add(new THREE.Vector3(0,0,depth));

        controls.object.position.set(...newPos);

        controls.enableDamping = true; // this requires controls.update() during application update
        controls.dampingFactor = 0.1;
        controls.enabled = controlsEnabled;
        controls.update();

        this.cameras.push(camera); 
        this.controls.push(controls);
        
        return {camera: camera, controls: controls};
    }

    createCameras() {
        this.newCameraFrom({azimuthAngle: 0, controlsEnabled: true}); // init main Camera (0)
        this.newCameraFrom({azimuthAngle: 25});
        this.newCameraFrom({azimuthAngle: -25});
    
        this.camera = 0;
    }

    createLights() {
        const hemiLight = new THREE.HemisphereLight( 0xffffff, 0xffffff, 0.5 );
        this.scene.add( hemiLight );

        const keySpotlight = new THREE.SpotLight( 0xffffff, 3.5, 0, 45 * (Math.PI/180), 0.5, 2 );
        keySpotlight.position.set( 0.5, 2, 2 );
        keySpotlight.target.position.set( 0, 1, 0 );
        this.scene.add( keySpotlight.target );
        this.scene.add( keySpotlight );

        const fillSpotlight = new THREE.SpotLight( 0xffffff, 2.0, 0, 45 * (Math.PI/180), 0.5, 2 );
        fillSpotlight.position.set( -0.5, 2, 1.5 );
        fillSpotlight.target.position.set( 0, 1, 0 );
        // fillSpotlight.castShadow = true;
        this.scene.add( fillSpotlight.target );
        this.scene.add( fillSpotlight );

        const dirLight = this.dirLight = new THREE.DirectionalLight( 0xffffff, 2 );
        dirLight.position.set( 1.5, 5, 2 );
        dirLight.shadow.mapSize.width = 512;
        dirLight.shadow.mapSize.height = 512;
        dirLight.shadow.camera.left= -5;
        dirLight.shadow.camera.right= 5;
        dirLight.shadow.camera.bottom= -5;
        dirLight.shadow.camera.top= 5;
        dirLight.shadow.camera.near= 0.5;
        dirLight.shadow.camera.far= 20;
        dirLight.shadow.blurSamples= 10;
        dirLight.shadow.radius= 3;
        dirLight.shadow.bias = 0.00001;
        dirLight.castShadow = true;
        this.scene.add( dirLight );
    }

    createBackgrounds() {
        // Create transparent ground for Open space
        const ground = this.ground = new THREE.Mesh( new THREE.PlaneGeometry(20,20), new THREE.MeshStandardMaterial( { color: this.sceneColor, opacity: 0.1, transparent:true, depthWrite: true, roughness: 1, metalness: 0 } ) );
        ground.name = 'Ground'
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add( ground );
        
        // Create an standard material for Studio space
        this.studioMaterial = new THREE.MeshStandardMaterial( { color: this.sceneColor, depthWrite: true, roughness: 1, metalness: 0} );
        
        // Create a customized standard material for Photocall space        
        this.logoTexture = new THREE.TextureLoader().load(this.logo);
        this.logoTexture.wrapS = THREE.RepeatWrapping;
        this.repeatOffset = 0;
        this.photocallMaterial = new THREE.MeshStandardMaterial( { color: this.sceneColor, depthWrite: true, roughness: 1, metalness: 0} );
        this.photocallMaterial.onBeforeCompile = async (shader) => {
            shader.uniforms.textureMap = {value: this.logoTexture}; 
            shader.uniforms.repeat = {value: [20,20]};
            shader.uniforms.offset = {value: this.repeatOffset};
            
            shader.vertexShader = '#define USE_UV;\n#define USE_TRANSMISSION;\nvarying vec3 vPosition;\n' + shader.vertexShader;
            
            //prepend the input to the shader
            shader.fragmentShader = '#define USE_UV;\nuniform sampler2D textureMap\n;uniform vec2 repeat; // Texture repetition count\nuniform float offset; // Offset for the texture in UV space;\nvarying vec3 vWorldPosition;\n' + shader.fragmentShader;

            shader.fragmentShader = 
            shader.fragmentShader.replace(
            'vec4 diffuseColor = vec4( diffuse, opacity );', 
            'vec4 diffuseColor = vec4( diffuse, 1.0 );\n\n\
            \ if (vWorldPosition.y > 0.0) { \n\
                \ // Scale the UV coordinates by the repeat factor\n\
                \ vec2 uvScaled = vUv * repeat;\n\n\
                \ // Use mod to wrap the UVs for repeating the texture\n\
                \ vec2 uvMod = mod(uvScaled, 1.0);\n\
                \ // Shrink the UV space to account for the gaps\n\
                \ float shrinkFactor = 1.0 - 2.0 * offset; // Shrink the texture to fit between gaps\n\
                \ // Only apply the texture inside the non-gap area\n\
                \ if (uvMod.x > offset && uvMod.x < (1.0 - offset) && uvMod.y > offset && uvMod.y < (1.0 - offset)) {\n\
                    \ // Calculate the "shrunken" UV coordinates to fit the texture within the non-gap area\n\
                    \ vec2 uv = fract(uvScaled);\n\
                    \ vec2 uvShrink = (uv - vec2(offset)) / shrinkFactor;\n\
                    \ vec2 smooth_uv = uvScaled;\n\
                    \ vec4 duv = vec4(dFdx(smooth_uv), dFdy(smooth_uv));\n\
                    \ vec4 texColor = textureGrad(textureMap, uvShrink, duv.xy, duv.zw);\n\n\
                    \ diffuseColor = mix(texColor, diffuseColor, 1.0 - texColor.a);\n\
                \ }\n\
            \ }\n'
            )
            this.photocallMaterial.userData.shader = shader;
            const urlParams = new URLSearchParams(window.location.search);
            
            // Default background image
            if(urlParams.has('img')) {

                const img = new Image();            
                img.onload = ( event ) => {

                    this.logo = event.target;        
                    this.setBackground( Performs.Backgrounds.PHOTOCALL, this.logo);         
                };   
                
                // Load image
                const imageURL = urlParams.get('img');
                try {
                    const response = await fetch(imageURL);
                    if (!response.ok) {
                        throw new Error(`Response status: ${response.status}`);
                    }
                    const blob = await response.blob();                    
                    const objectURL = URL.createObjectURL(blob);
                    img.src = objectURL;
                                        
                }
                catch(error) {
                    console.error(error.message, "File error!");
                };        
            }
        };

        // Create background mesh for Studio and Photocall space
        let backPlane = this.backPlane = new THREE.Mesh(createBackdropGeometry(15,10), this.studioMaterial );
        backPlane.name = 'Chroma';
        backPlane.position.z = -1;
        backPlane.receiveShadow = true;
        backPlane.castShadow = true;
        backPlane.visible = false;
        this.scene.add( backPlane );

        this.setBackground(this.background);
    }

    createRecorder() {
        
        this.animationRecorder = new AnimationRecorder(this.cameras.length, this);
        this.animationRecorder.onStartCapture = (v) => {
            if(this.gui) {
                this.gui.showCaptureModal(v);
            }
        };
        this.animationRecorder.onStopCapture = () => {
            if(this.gui) {
                this.gui.hideCaptureModal();
            }
        };    
    }
    
    loadAvatar( modelFilePath, configFile, modelRotation, avatarName, callback = null, onerror = null ) {
        this.loaderGLB.load( modelFilePath, async (glb) => {
            let model = glb.scene;
            model.quaternion.premultiply( modelRotation );
            model.castShadow = true;
            let skeleton = null;

            if(avatarName == "Witch") {
                model.traverse( (object) => {
                    if ( object.isMesh || object.isSkinnedMesh ) {
                        if (object.skeleton){
                            skeleton = object.skeleton; 
                        }                    
                        if(!object.name.includes("Hat")) {
                            object.material.side = THREE.FrontSide;
                        }
                        object.frustumCulled = false;
                        object.castShadow = true;
                        object.receiveShadow = true;
                        if (object.name == "Eyelashes") // eva
                        object.castShadow = false;
                        if(object.material.map) 
                        object.material.map.anisotropy = 16;
                        if(object.name == "Hair") {
                            object.material.map = null;
                            object.material.color.set(0x6D1881);
                        }
                        if(object.name.includes("Bottom")) {
                            object.material.map = null;
                            object.material.color.set(0x000000);
                        }
                        if(object.name.includes("Top")) {
                            object.material.map = null;
                            object.material.color.set(0x000000);
                        }
                        if(object.name.includes("Shoes")) {
                            object.material.map = null;
                            object.material.color.set(0x19A7A3);
                        }
                    } else if (object.isBone) {
                        object.scale.set(1.0, 1.0, 1.0);
                    }
                } );
            }
            else {
                model.traverse( (object) => {
                    if ( object.isMesh || object.isSkinnedMesh ) {
                        if (object.skeleton){
                            skeleton = object.skeleton; 
                        }
                        object.material.side = THREE.FrontSide;
                        object.frustumCulled = false;
                        object.castShadow = true;
                        object.receiveShadow = true;
                        if (object.name == "Eyelashes") {
                            object.castShadow = false;
                        }
                        if(object.material.map) {
                            object.material.map.anisotropy = 16;
                        }
                    } else if (object.isBone) {
                        object.scale.set(1.0, 1.0, 1.0);
                    }
                });
    
                this.avatarShirt = model.getObjectByName( "Tops" ) || model.getObjectByName( "Top" );
            }

            if ( avatarName == "Kevin" ){
                let hair = model.getObjectByName( "Classic_short" );
                if( hair && hair.children.length > 1 ){ 
                    hair.children[1].renderOrder = 1; 
                }
            }
                        
            model.name = avatarName;

            this.loadedCharacters[avatarName] ={
                model, skeleton, config: null
            }

            // Load config file and set automatically the Script mode
            if (configFile) {
                // Read the file if it's a URL
                if(typeof(configFile) == 'string') {                    
                    const response = await fetch( configFile );
                    
                    if(response.ok) {
                        const text = await response.text()                       
                        
                        let config = JSON.parse( text );
                        config._filename = configFile;
                        this.loadedCharacters[avatarName].config = config;
                        this.scriptApp.onLoadAvatar(model, config, skeleton);
                        this.keyframeApp.onLoadAvatar(this.loadedCharacters[avatarName]);
                    }                        
                    if (callback) {
                        callback();
                    }                                      
                }
                else {
                    // Set the config file data if it's an object
                    const config = configFile;
                    this.loadedCharacters[avatarName].config = config;
                    this.scriptApp.onLoadAvatar(model, config, skeleton);
                    this.keyframeApp.onLoadAvatar(this.loadedCharacters[avatarName]);
                    
                    if (callback) {
                        callback();
                    }
                }
            }
            else {
                // If there isn't a config file, automatically set Keyframe mode as default
                this.keyframeApp.onLoadAvatar(this.loadedCharacters[avatarName]);
                if (callback) {
                    callback();
                }
            }
        }, null, (err) => {
            if(onerror) {
                onerror(err);
            }
        });
    }

    animate() {

        requestAnimationFrame( this.animate.bind(this) );

        // don't let the camera to be under the ground 
        if(this.cameraMode) {
            let centerPosition = this.controls[this.camera].target.clone();
            centerPosition.y = 0;
            let groundPosition = this.cameras[this.camera].position.clone();
            groundPosition.y = 0;
            let d = (centerPosition.distanceTo(groundPosition));
    
            let origin = new THREE.Vector2(this.controls[this.camera].target.y,0);
            let remote = new THREE.Vector2(0,d); // replace 0 with raycasted ground altitude
            let angleRadians = Math.atan2(remote.y - origin.y, remote.x - origin.x);
            this.controls[this.camera].maxPolarAngle = angleRadians - 0.01;
        }

        this.controls[this.camera].update(); // needed because of this.controls.enableDamping = true
        let delta = this.clock.getDelta()         
        // delta *= this.speed;
        this.elapsedTime += delta;
        
        switch( this.mode ){
            case Performs.Modes.SCRIPT: 
                this.scriptApp.update(delta); 
                break;
            case Performs.Modes.KEYFRAME:
                this.keyframeApp.update(delta); 
                break;
            default:
                break;
        }
        
        if (this.animationRecorder && this.animationRecorder.isRecording) {
            this.animationRecorder.update(this.scene, this.cameras);
        }        

        this.renderer.render( this.scene, this.cameras[this.camera] );
    }

    // Force feet to touch the ground
    precomputeFeetOffset(avatarName) {
        const character = this.loadedCharacters[avatarName];
        const map = computeAutoBoneMap( character.skeleton );
        character.LToeName = character.model.getObjectByName(map.nameMap.LFoot).children[0].name;
        character.RToeName = character.model.getObjectByName(map.nameMap.RFoot).children[0].name;
        const LtoePos = character.model.getObjectByName(map.nameMap.LFoot).children[0].getWorldPosition(new THREE.Vector3());
        const RtoePos = character.model.getObjectByName(map.nameMap.RFoot).children[0].getWorldPosition(new THREE.Vector3);
      
        // Cast a ray downwards from the left toe's position
        let dir = new THREE.Vector3(0, 1, 0);
        this.raycaster.layers.enableAll()
        this.raycaster.set( new THREE.Vector3(LtoePos.x, -1, LtoePos.z), dir);
              
        const intersects = this.raycaster.intersectObjects(character.model.children[0].children, true); // Adjust based on your scene setup
        let diff = 0;
        if (intersects.length > 0) {
            // Get the ground position from the first intersection
            const groundPosition = intersects[0].point;
            diff = groundPosition.y;
        }

        character.LToePos = LtoePos;
        character.RToePos = RtoePos;
        return diff;
    }

    onMessage(event) {
        if ( !this.isAppReady ) { 
            this.pendingMessageReceived = event; 
            return; 
        }

        let data = event.data;
        
        if ( typeof( data ) == "string" ) { 
            try { 
                data =  JSON.parse( data ); 
            }
            catch( e ) { 
                if(data.includes("setImmediate")) {
                    return;
                }
                console.error("Error while parsing an external message: ", event ); 
            };
        }
        
        if ( !data ) {
            return;
        }

        if ( Array.isArray(data) ){
            this.changeMode(Performs.Modes.SCRIPT);
            this.scriptApp.onMessage(data, (processedData) => {
                
                if(this.gui) {
                    this.gui.setBMLInputText( 
                        JSON.stringify(this.scriptApp.msg.data, function(key, val) {
                            return val.toFixed ? Number(val.toFixed(3)) : val;
                        }) 
                    );
                }
                
                if(this.autoplay) {
                    this.scriptApp.replay();
                }
            }); 
            return;
        } 
                        
        if(data.type == 'bvh' || data.type == 'bvhe' || data.type == "glb" || data.type == "gltf" || data.type == "fbx") {
            this.changeMode(Performs.Modes.KEYFRAME);
            this.keyframeApp.onMessage(data, () => {
                
                if(this.gui) {
                    this.gui.refresh();
                }
                if(this.autoplay) {
                    this.keyframeApp.changePlayState(true);
                }
            });
        }
        else {
            return; 
        }
    }
    
    onWindowResize() {
        for (let i = 0; i < this.cameras.length; i++) {
            this.cameras[i].aspect = window.innerWidth / window.innerHeight;
            this.cameras[i].updateProjectionMatrix();
        }
        this.renderer.setSize( window.innerWidth, window.innerHeight );
    }

        
    changeAvatar( avatarName ) {
        if ( this.currentCharacter ) {
            this.scene.remove( this.currentCharacter.model ); // delete current model from scene
        }

        // Update the current character and add the model to the scene
        this.currentCharacter = this.loadedCharacters[avatarName];
        this.scene.add( this.currentCharacter.model ); 
        
        // Compute the distance between the feet bones and the mesh for force to touch the ground
        const diffToGround = this.precomputeFeetOffset(avatarName);
        this.loadedCharacters[avatarName].diffToGround = diffToGround;
        this.loadedCharacters[avatarName].position = this.currentCharacter.model.position.clone();
          
        // Set the avatars to each app mode
        this.scriptApp.onChangeAvatar(avatarName);
        this.keyframeApp.onChangeAvatar(avatarName);
        
        if (this.currentCharacter.config) {
            this.currentCharacter.skeleton.bones[ this.currentCharacter.config.boneMap["ShouldersUnion"] ].getWorldPosition( this.controls[this.camera].target );
            this.controls.forEach((control) => {
                control.target.copy(this.controls[this.camera].target); 
                control.saveState();
                control.update();
            });
            if(this.scriptApp.currentIdle) {
                this.scriptApp.bindAnimationToCharacter(this.scriptApp.currentIdle, this.currentCharacter.model.name);
            }
        }
        else {
            this.changeMode(Performs.Modes.KEYFRAME);
        }

        // Search the top mesh
        this.currentCharacter.model.traverse((object) => {
            if(object.isSkinnedMesh && (object.name.includes("Top") || object.name.includes("Shirt"))) {
                this.avatarShirt = object;
            }
        })
        
        if ( this.gui ){ 
            this.gui.refresh(); 
        }
    }

    toggleCameraMode() { 
        this.changeCameraMode( !this.cameraMode ); 
    }

    changeCameraMode( mode ) {

        if ( mode ) { // Free camera controls
            this.controls[this.camera].enablePan = true;
            this.controls[this.camera].minDistance = 0.1;
            this.controls[this.camera].maxDistance = 10;
            this.controls[this.camera].minAzimuthAngle = THREE.Infinity;
            this.controls[this.camera].maxAzimuthAngle = THREE.Infinity;
            this.controls[this.camera].minPolarAngle = 0.0;
            this.controls[this.camera].maxPolarAngle = Math.PI;     
        } else { // Restricted camera controls
            this.controls[this.camera].enablePan = false;
            this.controls[this.camera].minDistance = 0.7;
            this.controls[this.camera].maxDistance = 2;
            this.controls[this.camera].minAzimuthAngle = -2;
            this.controls[this.camera].maxAzimuthAngle = 2;
            this.controls[this.camera].minPolarAngle = 0.6;
            this.controls[this.camera].maxPolarAngle = 2.1;

            if ( this.currentCharacter && this.currentCharacter.config ){
                this.currentCharacter.skeleton.bones[ this.currentCharacter.config.boneMap["ShouldersUnion"] ].getWorldPosition( this.controls[this.camera].target );
            }
        }
        this.controls[this.camera].update();
        this.cameraMode = mode; 
    }

    openAtelier(name, model, config, fromFile = true, rotation = 0) {
            
        let rawConfig = config;
        if(config && !fromFile) {
            rawConfig = JSON.parse(JSON.stringify(config));
            const skeleton = this.currentCharacter.skeleton;
            const innerLocationToObjects = (locations) => {
                let result = {};
                const bindMat4 = new THREE.Matrix4();
                const bindMat3 = new THREE.Matrix3();
                for(let part in locations) {
                    
                    const obj = [];
                    const location = locations[part];
                    let idx = findIndexOfBoneByName( skeleton, location.parent.name );
                    if ( idx < 0 ){ continue; }
    
                    obj.push(location.parent.name);
                    bindMat4.copy( skeleton.boneInverses[ idx ] ).invert();
                    obj.push( location.position.clone().applyMatrix4( bindMat4 ) ); // from mesh space to bone local space
                    
                    // check direction of distance vector 
                    if(location.direction) {
                        bindMat3.setFromMatrix4( bindMat4 );
                        obj.push( location.direction.clone().applyMatrix3( bindMat3 ) );

                    }    
                    result[part] = obj;
                }
                return result;
            }
            rawConfig.bodyController.bodyLocations = innerLocationToObjects(config.bodyController.bodyLocations);
            rawConfig.bodyController.handLocationsL = innerLocationToObjects(config.bodyController.handLocationsL);
            rawConfig.bodyController.handLocationsR = innerLocationToObjects(config.bodyController.handLocationsR);
        }
        const atelierData = [name, model, rawConfig, rotation];        
        localStorage.setItem("atelierData", JSON.stringify(atelierData));
        if(!this._atelier || this._atelier.closed) {
            this._atelier = window.open(Performs.ATELIER_URL, "Atelier");            
        }
        else {
            this._atelier.location.reload();
        }
        this._atelier.focus();
    }
}

// Function to create a curved backdrop geometry
function createBackdropGeometry(width = 5, height = 5, segments = 32) {
    // Create a geometry object
    const geometry = new THREE.PlaneGeometry(width, height, segments, segments);
    const position = geometry.attributes.position;
    // Modify vertices to create a curved transition from floor to background
    let vertices = [];
    for (let i = 0; i < position.count; i++) {
        let vertex = new THREE.Vector3();
        vertex.fromBufferAttribute( position, i );
       
        if( vertex.y < 0) {
            vertex.z = -vertex.y; // Apply curve on Z axis
            vertex.y = 0;
        }
        vertices.push(vertex.x);
        vertices.push(vertex.y);
        vertices.push(vertex.z);
    }
    vertices = new Float32Array(vertices);
    geometry.setAttribute( 'position', new THREE.BufferAttribute( vertices, 3 ) );
    return geometry;
}

export { Performs };
