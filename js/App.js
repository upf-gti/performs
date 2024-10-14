
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { CharacterController } from './controllers/CharacterController.js';
import { AnimationRecorder } from './recorder/recorder.js';
import { sigmlStringToBML } from './sigml/SigmlToBML.js';
import { AppGUI } from './GUI.js';
import { BMLApp } from './BMLApp.js';
import { KeyframeApp } from './KeyframeApp.js';

// Correct negative blenshapes shader of ThreeJS
THREE.ShaderChunk[ 'morphnormal_vertex' ] = "#ifdef USE_MORPHNORMALS\n	objectNormal *= morphTargetBaseInfluence;\n	#ifdef MORPHTARGETS_TEXTURE\n		for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {\n	    objectNormal += getMorph( gl_VertexID, i, 1, 2 ) * morphTargetInfluences[ i ];\n		}\n	#else\n		objectNormal += morphNormal0 * morphTargetInfluences[ 0 ];\n		objectNormal += morphNormal1 * morphTargetInfluences[ 1 ];\n		objectNormal += morphNormal2 * morphTargetInfluences[ 2 ];\n		objectNormal += morphNormal3 * morphTargetInfluences[ 3 ];\n	#endif\n#endif";
THREE.ShaderChunk[ 'morphtarget_pars_vertex' ] = "#ifdef USE_MORPHTARGETS\n	uniform float morphTargetBaseInfluence;\n	#ifdef MORPHTARGETS_TEXTURE\n		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];\n		uniform sampler2DArray morphTargetsTexture;\n		uniform vec2 morphTargetsTextureSize;\n		vec3 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset, const in int stride ) {\n			float texelIndex = float( vertexIndex * stride + offset );\n			float y = floor( texelIndex / morphTargetsTextureSize.x );\n			float x = texelIndex - y * morphTargetsTextureSize.x;\n			vec3 morphUV = vec3( ( x + 0.5 ) / morphTargetsTextureSize.x, y / morphTargetsTextureSize.y, morphTargetIndex );\n			return texture( morphTargetsTexture, morphUV ).xyz;\n		}\n	#else\n		#ifndef USE_MORPHNORMALS\n			uniform float morphTargetInfluences[ 8 ];\n		#else\n			uniform float morphTargetInfluences[ 4 ];\n		#endif\n	#endif\n#endif";
THREE.ShaderChunk[ 'morphtarget_vertex' ] = "#ifdef USE_MORPHTARGETS\n	transformed *= morphTargetBaseInfluence;\n	#ifdef MORPHTARGETS_TEXTURE\n		for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {\n			#ifndef USE_MORPHNORMALS\n				transformed += getMorph( gl_VertexID, i, 0, 1 ) * morphTargetInfluences[ i ];\n			#else\n				transformed += getMorph( gl_VertexID, i, 0, 2 ) * morphTargetInfluences[ i ];\n			#endif\n		}\n	#else\n		transformed += morphTarget0 * morphTargetInfluences[ 0 ];\n		transformed += morphTarget1 * morphTargetInfluences[ 1 ];\n		transformed += morphTarget2 * morphTargetInfluences[ 2 ];\n		transformed += morphTarget3 * morphTargetInfluences[ 3 ];\n		#ifndef USE_MORPHNORMALS\n			transformed += morphTarget4 * morphTargetInfluences[ 4 ];\n			transformed += morphTarget5 * morphTargetInfluences[ 5 ];\n			transformed += morphTarget6 * morphTargetInfluences[ 6 ];\n			transformed += morphTarget7 * morphTargetInfluences[ 7 ];\n		#endif\n	#endif\n#endif";

class App {
    static Modes = { SCRIPT: 0, KEYFRAME: 1 };
    static Backgrounds = { OPEN:0, STUDIO: 1, PHOTOCALL: 2};

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

        this.mode = App.Modes.SCRIPT;
        this.bmlApp = new BMLApp();        
        this.keyframeApp = new KeyframeApp();   
        
        this.isAppReady = false;
        this.pendingMessageReceived = null;

        this.sceneColor = 0x46c219;
        this.background = App.Backgrounds.OPEN;

        this.logo = "./data/imgs/performs2.png";
    }

    setSpeed( value ){ this.speed = value; }
    getSpeed( ){ return this.speed; }

    changeMode( mode ) {
        this.mode = mode;
        if(this.currentCharacter) {
            this.currentCharacter.skeleton.pose();
        }
        if(this.bmlApp.ECAcontroller) {
            this.bmlApp.ECAcontroller.reset();
        }
    }

    // returns value (hex) with the colour in sRGB space
    getBackPlaneColour(){
        if ( !this.backPlane ){ return 0; }   
        return this.backPlane.material.color.getHex(); // css works in sRGB
    }
    // value (hex colour) in sRGB space 
    setBackPlaneColour( value ){
        this.sceneColor = value;
        this.scene.background.set(value);

        if ( this.backPlane ){ 
            this.backPlane.material.color.set( value );   
        }                

        if(this.ground) {
            this.ground.material.color.set( value ); 
        }
        return true;
    }
    
    setBackground( type ) {
        this.background = type;

        switch(type) {
            case App.Backgrounds.OPEN:
                this.backPlane.visible = false;
                this.ground.visible = true;
                break;
            case App.Backgrounds.STUDIO:
                this.backPlane.visible = true;
                this.backPlane.material.map = null;                            
                this.backPlane.material.needsUpdate = true;
                this.ground.visible = false;
                break;
            case App.Backgrounds.PHOTOCALL:
                this.backPlane.visible = true;
                this.ground.visible = false;
                let texture = null;
                if(typeof(this.logo) == 'string') {
                    texture = new THREE.TextureLoader().load( this.logo, (image) =>{            
                        image.repeat.set(20, 20);
                    });

                }
                else {
                    texture = new THREE.Texture( this.logo );
                    texture.colorSpace = THREE.SRGBColorSpace;
                }
                texture.format = THREE.RGBAFormat;
                texture.wrapT = THREE.RepeatWrapping;
                texture.wrapS = THREE.RepeatWrapping;
                texture.repeat.set(20, 20);
                texture.needsUpdate = true;
                
                if ( this.backPlane.material.map ) {

					this.backPlane.material.map.dispose();
				}

				this.backPlane.material.map = texture;

                this.backPlane.material.needsUpdate = true;
                break;
        }
    }
    // returns value (hex) with the colour in sRGB space
    getClothesColour(){
        if ( !this.avatarShirt ){ return 0; }   
        return this.avatarShirt.material.color.getHex(); // css works in sRGB
    }
    // value (hex colour) in sRGB space 
    setClothesColour( value ){
        if ( !this.avatarShirt ){ return false; }
        this.avatarShirt.material.color.set( value );   
        return true;
    }

    changeAvatar( avatarName ) {
        if ( this.currentCharacter ) this.scene.remove( this.currentCharacter.model ); // delete from scene current model
        this.currentCharacter = this.loadedCharacters[avatarName];
        this.scene.add( this.currentCharacter.model ); // add model to scene

        this.bmlApp.onChangeAvatar(avatarName);
        this.keyframeApp.onChangeAvatar(avatarName);
        
        if (this.currentCharacter.config) {
            this.currentCharacter.skeleton.bones[ this.currentCharacter.config.boneMap["ShouldersUnion"] ].getWorldPosition( this.controls[this.camera].target );
            this.controls.forEach((control) => {
                control.target.copy(this.controls[this.camera].target); 
                control.saveState();
                control.update();
            });
        }
        else {
            this.changeMode(App.Modes.KEYFRAME);
        }


        if ( this.gui ){ this.gui.refresh(); }
    }

    loadAvatar( modelFilePath, configFilePath, modelRotation, avatarName, callback = null, onerror = null ) {
        this.loaderGLB.load( modelFilePath, (glb) => {
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
                        if(!object.name.includes("Hat"))
                           object.material.side = THREE.FrontSide;
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
            }else{
                model.traverse( (object) => {
                    if ( object.isMesh || object.isSkinnedMesh ) {
                        if (object.skeleton){
                            skeleton = object.skeleton; 
                        }
                        object.material.side = THREE.FrontSide;
                        object.frustumCulled = false;
                        object.castShadow = true;
                        object.receiveShadow = true;
                        if (object.name == "Eyelashes") // eva
                        object.castShadow = false;
                        if(object.material.map) 
                        object.material.map.anisotropy = 16;
                } else if (object.isBone) {
                    object.scale.set(1.0, 1.0, 1.0);
                    }
                } );
    
                this.avatarShirt = model.getObjectByName( "Tops" );
            }

            if ( avatarName == "Kevin" ){
                let hair = model.getObjectByName( "Classic_short" );
                if( hair && hair.children.length > 1 ){ hair.children[1].renderOrder = 1; }
            }
                        
            // model.add( new THREE.SkeletonHelper( model ) );

            model.name = avatarName;

            this.loadedCharacters[avatarName] ={
                model, skeleton, config: null
            }

            if (configFilePath) {
                if(typeof(configFilePath) == 'string') {

                    fetch( configFilePath ).then(response => response.text()).then( (text) =>{
                        let config = JSON.parse( text );
                        config._filename = configFilePath;
                        this.loadedCharacters[avatarName].config = config;
                        this.bmlApp.onLoadAvatar(model, config, skeleton);
                        this.keyframeApp.onLoadAvatar(model, config, skeleton);
                        if (callback) {
                            callback();
                        }
                    })
                }
                else {
                    let config = configFilePath;
                    this.loadedCharacters[avatarName].config = config;
                    this.bmlApp.onLoadAvatar(model, config, skeleton);
                    this.keyframeApp.onLoadAvatar(model, config, skeleton);
                    
                    if (callback) {
                        callback();
                    }
                }
            }
            else {
                this.keyframeApp.onLoadAvatar(model, null, skeleton);
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

    newCameraFrom({azimuthAngle = 0, polarAngle = 0, depth = 0, controlsEnabled = false}) {
        let camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.01, 1000);
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

    init() {        
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
        // document.body.appendChild( this.renderer.domElement );
        
        this.newCameraFrom({azimuthAngle: 0, controlsEnabled: true}); // init main Camera (0)
        this.newCameraFrom({azimuthAngle: 25});
        this.newCameraFrom({azimuthAngle: -25});
    
        this.camera = 0;

        // IBL Light
        // var that = this;

        // new RGBELoader()
        //     .setPath( 'data/hdrs/' )
        //     .load( 'cafe.hdr', function ( texture ) {

        //         texture.mapping = THREE.EquirectangularReflectionMapping;

        //         // that.scene.background = texture;
        //         that.scene.environment = texture;

        //         that.renderer.render( that.scene, that.camera );
        // } );

        // include lights
        let hemiLight = new THREE.HemisphereLight( 0xffffff, 0xffffff, 0.5 );
        this.scene.add( hemiLight );

        let keySpotlight = new THREE.SpotLight( 0xffffff, 3.5, 0, 45 * (Math.PI/180), 0.5, 2 );
        keySpotlight.position.set( 0.5, 2, 2 );
        keySpotlight.target.position.set( 0, 1, 0 );
        // keySpotlight.castShadow = true;
        // keySpotlight.shadow.mapSize.width = 1024;
        // keySpotlight.shadow.mapSize.height = 1024;
        // keySpotlight.shadow.bias = 0.00001;
        this.scene.add( keySpotlight.target );
        this.scene.add( keySpotlight );

        let fillSpotlight = new THREE.SpotLight( 0xffffff, 2.0, 0, 45 * (Math.PI/180), 0.5, 2 );
        fillSpotlight.position.set( -0.5, 2, 1.5 );
        fillSpotlight.target.position.set( 0, 1, 0 );
        // fillSpotlight.castShadow = true;
        this.scene.add( fillSpotlight.target );
        this.scene.add( fillSpotlight );

        let dirLight = new THREE.DirectionalLight( 0xffffff, 2 );
        dirLight.position.set( 1.5, 5, 2 );
        dirLight.shadow.mapSize.width = 1024;
        dirLight.shadow.mapSize.height = 1024;
        dirLight.shadow.camera.left= -1;
        dirLight.shadow.camera.right= 1;
        dirLight.shadow.camera.bottom= -1;
        dirLight.shadow.camera.top= 1;
        dirLight.shadow.bias = 0.00001;
        dirLight.castShadow = true;
        this.scene.add( dirLight );

        // add entities
        const ground = this.ground = new THREE.Mesh( new THREE.PlaneGeometry(20,20), new THREE.MeshStandardMaterial( { color: sceneColor, opacity: 0.1, transparent:true, depthWrite: true, roughness: 1, metalness: 0 } ) );
        ground.name = 'Ground'
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add( ground );
        
        const texture = new THREE.TextureLoader().load( this.logo, (image) =>{            
           image.repeat.set(20, 20);
        });
        texture.format = THREE.RGBAFormat;
        texture.wrapT = THREE.RepeatWrapping;
        texture.wrapS = THREE.RepeatWrapping;
        let logo = new THREE.Mesh( new THREE.PlaneGeometry(0.5, 0.15 ), new THREE.MeshBasicMaterial( {color: new THREE.Color(0x323232), needsUpdate:true, map: texture, transparent: true, depthWrite: false, alphaTest: 0.9} ) );
        logo.position.set(2.6,0.15, -0.98);
        this.scene.add( logo );
       
        let backPlane = this.backPlane = new THREE.Mesh(createBackdropGeometry(15,10), new THREE.MeshStandardMaterial( { color: sceneColor, depthWrite: true, roughness: 1, metalness: 0} ) );
        backPlane.name = 'Chroma';
        backPlane.position.z = -1;
        backPlane.receiveShadow = true;
        backPlane.castShadow = true;
        backPlane.visible=false;
        this.scene.add( backPlane );

        this.setBackground(this.background);
        // so the screen is not black while loading
        this.changeCameraMode( false ); //moved here because it needs the backplane to exist
        this.renderer.render( this.scene, this.cameras[this.camera] );
        
        this.bmlApp.init(this.scene);

        const queryString = window.location.search;
        const urlParams = new URLSearchParams(queryString);
        let showControls = true;
        if(urlParams.has('controls')) {
            showControls = !(urlParams.get('controls') === "false");
        }

        let modelToLoad = ['https://webglstudio.org/3Dcharacters/Eva/Eva.glb', 'https://webglstudio.org/3Dcharacters/Eva/Eva.json', (new THREE.Quaternion()).setFromAxisAngle( new THREE.Vector3(1,0,0), 0 ), "Eva" ];
        if(urlParams.has('avatar')) {
            let avatar = urlParams.get('avatar');
            const path = avatar.split(".");
            let filename = path[path.length-2];
            filename = filename.split("/");
            filename = filename.pop();
            
            avatar += avatar.includes('models.readyplayer.me') ? '?pose=T&morphTargets=ARKit&lod=1' : '';

            modelToLoad = [ avatar, urlParams.get('config'), new THREE.Quaternion(), filename];          
        }
        this.loadAvatar(modelToLoad[0], modelToLoad[1], modelToLoad[2], modelToLoad[3], () => {
            this.changeAvatar( modelToLoad[3] );
            if ( typeof AppGUI != "undefined" && showControls) { this.gui = new AppGUI( this ); }
            if(!this.gui.avatarOptions[modelToLoad[3]]) {
                const name = modelToLoad[3];
                modelToLoad[3] = modelToLoad[0].includes('models.readyplayer.me') ? ("https://models.readyplayer.me/" + name + ".png?background=68,68,68") : AppGUI.THUMBNAIL;
                this.gui.avatarOptions[name] = modelToLoad;
                this.gui.refresh();
            }
            this.animate();
            $('#loading').fadeOut(); //hide();
            this.isAppReady = true;
                        
            if(this.pendingMessageReceived) {
                this.onMessage( this.pendingMessageReceived );
                this.pendingMessageReceived = null; // although onMessage is async, the variable this.pendingMessageReceived is not used. So it is safe to delete
            }
        });

        this.animationRecorder = new AnimationRecorder(this.cameras.length);
        this.animationRecorder.onStartCapture = (v) => {this.gui.showCaptureModal(v)};
        this.animationRecorder.onStopCapture = () => {this.gui.hideCaptureModal()};
        window.addEventListener( "message", this.onMessage.bind(this) );
        window.addEventListener( 'resize', this.onWindowResize.bind(this) );

    }

    animate() {

        requestAnimationFrame( this.animate.bind(this) );

        this.controls[this.camera].update(); // needed because of this.controls.enableDamping = true
        let delta = this.clock.getDelta()         
        // delta *= this.speed;
        this.elapsedTime += delta;
        
        switch( this.mode ){
            case App.Modes.SCRIPT: 
                this.bmlApp.update(delta); 
                break;
            case App.Modes.KEYFRAME:
                this.keyframeApp.update(delta); 
                break;
            default:
                break;
        }
        
        if (this.animationRecorder.isRecording) {
            this.animationRecorder.update(this.scene, this.cameras);
        }        

        this.renderer.render( this.scene, this.cameras[this.camera] );
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
            this.changeMode(App.Modes.SCRIPT);
            this.bmlApp.onMessage(data, (processedData) => {
                this.gui.setBMLInputText( 
                    JSON.stringify(this.bmlApp.msg.data, function(key, val) {
                        return val.toFixed ? Number(val.toFixed(3)) : val;
                    }) 
                );
            }); 
            return;
        } 
                        
        if(data.type == 'bvh' || data.type == 'bvhe') {
            this.changeMode(App.Modes.KEYFRAME);
            this.keyframeApp.onMessage(data, () => {
                if(this.gui) {
                    this.gui.refresh();
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

    toggleCameraMode() { 
        this.changeCameraMode( !this.cameraMode ); 
    }

    changeCameraMode( mode ) {

        if ( mode ) {
            this.controls[this.camera].enablePan = true;
            this.controls[this.camera].minDistance = 0.1;
            this.controls[this.camera].maxDistance = 10;
            this.controls[this.camera].minAzimuthAngle = THREE.Infinity;
            this.controls[this.camera].maxAzimuthAngle = THREE.Infinity;
            this.controls[this.camera].minPolarAngle = 0.0;
            this.controls[this.camera].maxPolarAngle = Math.PI;     
            this.setBackPlaneColour( 0x4f4f9c );
        } else {
            this.controls[this.camera].enablePan = false;
            this.controls[this.camera].minDistance = 0.7;
            this.controls[this.camera].maxDistance = 2;
            this.controls[this.camera].minAzimuthAngle = -2;
            this.controls[this.camera].maxAzimuthAngle = 2;
            this.controls[this.camera].minPolarAngle = 0.6;
            this.controls[this.camera].maxPolarAngle = 2.1;
            this.setBackPlaneColour( 0x46c219 );

            if ( this.currentCharacter && this.currentCharacter.config ){
                this.currentCharacter.skeleton.bones[ this.currentCharacter.config.boneMap["ShouldersUnion"] ].getWorldPosition( this.controls[this.camera].target );
            }
        }
        this.controls[this.camera].update();
        this.cameraMode = mode; 
    }

    loadFiles( files, callback ) {
        for(let i = 0; i < files.length; i++) {
            //load json (bml) file
            const file = files[i];
            const extension = file.name.substr(file.name.lastIndexOf(".") + 1);
            const formats = ['bvh', 'bvhe', 'glb', 'gltf'];
            if(formats.indexOf(extension) < 0) {
                alert(file.name +": Format not supported.\n\nFormats accepted:\n\t'bvh', 'bvhe'\n\t");
            }
        }

        
        this.keyframeApp.processMessageFiles(files).then((data) => {
            if(data[0].length) {
                this.changeMode(App.Modes.KEYFRAME);
                this.keyframeApp.onChangeAnimation(data[0]);
            }
            if(callback) {
                callback(data[0]);
            }
        });
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
            vertex.y = 0;
            vertex.z = (height - vertex.y); // Apply curve on Z axis
        }
        vertices.push(vertex.x);
        vertices.push(vertex.y);
        vertices.push(vertex.z);
    }
    vertices = new Float32Array(vertices);
    geometry.setAttribute( 'position', new THREE.BufferAttribute( vertices, 3 ) );
    return geometry;
}


let app = new App();
app.init();
window.global = {app:app};
export { App };
