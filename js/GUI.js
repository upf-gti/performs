import * as THREE from "three"
import { LX } from 'lexgui';
import 'lexgui/components/codeeditor.js';
import { Performs } from './Performs.js'

class GUI {

    static THUMBNAIL = "data/imgs/monster.png";
    constructor( performs ){
        this.performs = performs;
        this.randomSignAmount = 0;
        // available model models paths - [model, config, rotation, thumbnail]
        this.avatarOptions = {
            "EvaLow": [Performs.AVATARS_URL+'Eva_Low/Eva_Low.glb', Performs.AVATARS_URL+'Eva_Low/Eva_Low.json', 0, Performs.AVATARS_URL+'Eva_Low/Eva_Low.png'],
            "Witch": [Performs.AVATARS_URL+'Eva_Witch/Eva_Witch.glb', Performs.AVATARS_URL+'Eva_Witch/Eva_Witch.json', 0, Performs.AVATARS_URL+'Eva_Witch/Eva_Witch.png'],
            "Kevin": [Performs.AVATARS_URL+'Kevin/Kevin.glb', Performs.AVATARS_URL+'Kevin/Kevin.json', 0, Performs.AVATARS_URL+'Kevin/Kevin.png'],
            "Ada": [Performs.AVATARS_URL+'Ada/Ada.glb', Performs.AVATARS_URL+'Ada/Ada.json',0, Performs.AVATARS_URL+'Ada/Ada.png'],
            "Eva": ['https://models.readyplayer.me/66e30a18eca8fb70dcadde68.glb', Performs.AVATARS_URL+'ReadyEva/ReadyEva_v3.json',0, 'https://models.readyplayer.me/66e30a18eca8fb70dcadde68.png?background=68,68,68']
        }

        // take canvas from dom, detach from dom, attach to lexgui 
        this.performs.renderer.domElement.remove(); // removes from dom
        this.mainArea = LX.init();
        this.mainArea.root.ondrop = this.onDropFiles.bind(this);

        this.mainArea.onresize = (bounding) => this.performs.onCanvasResize(bounding.width, bounding.height);
        this.bmlInputData = { openButton: null, dialog: null, codeObj: null, prevInstanceText: "" };
        this.sigmlInputData = { openButton: null, dialog: null, codeObj: null, prevInstanceText:"" };
        this.glossInputData = { openButton: null, dialog: null, textArea: null,  glosses: "" };

        this.gui = null;
        
        const [canvasArea, panelArea] = this.mainArea.split({type:"horizontal", sizes: ["88%", "12%"], minimizable: true});
        canvasArea.attach( this.performs.renderer.domElement );
        canvasArea.onresize = (bounding) => this.resize(bounding.width, bounding.height);
        canvasArea.root.appendChild(this.performs.renderer.domElement);

        this.panel = panelArea.addPanel({height: "100%"});
        panelArea.addOverlayButtons([{
            icon: "fa fa-xmark",
            class: "relative",
            callback: () => {
                if(this.settingsActive || this.cameraActive || this.lightsActive) {
                    this.mainArea._moveSplit(-100);
                }
                this.mainArea.extend();
                this.settingsActive = this.backgroundsActive = this.avatarsActive = this.cameraActive = this.lightsActive = false;
            }
        }], {float: "rt"});

        this.mainArea.extend();

        this.branchesOpened = {"Customization" : true, "Transformations": true, "Recording": true, "Animation": true};
        // sessionStorage: only for this domain and this tab. Memory is kept during reload (button), reload (link) and F5. New tabs will not know of this memory
        // localStorage: only for this domain. New tabs will see that memory
        if ( window.sessionStorage ){
            let text;
            text = window.sessionStorage.getItem( "msg" );
            this.performs.scriptApp.msg = text ? JSON.parse( text ) : null;
            text = window.sessionStorage.getItem( "bmlInput" ); 
            this.bmlInputData.prevInstanceText = text ? text : "";
            text = window.sessionStorage.getItem( "sigmlInput" ); 
            this.sigmlInputData.prevInstanceText = text ? text : "";
            text = window.sessionStorage.getItem( "glossInput" ); 
            this.glossInputData.glosses = text ? text : "";
            
            window.addEventListener("beforeunload", (event) => {
                // event.returnValue = "\\o/";
                window.sessionStorage.setItem( "msg", JSON.stringify(this.performs.scriptApp.msg) );
                if( this.bmlInputData && this.bmlInputData.codeObj ){
                    window.sessionStorage.setItem( "bmlInput", this.bmlInputData.codeObj.getText() );
                }
                if( this.sigmlInputData && this.sigmlInputData.codeObj ){
                    window.sessionStorage.setItem( "sigmlInput", this.sigmlInputData.codeObj.getText() );
                }
                if( this.glossInputData && this.glossInputData.glosses ){
                    window.sessionStorage.setItem( "glossInput", this.glossInputData.glosses );
                }
            });

            window.addEventListener("keyup", (event) => {
                if(event.key == " ") {
                    if(this.performs.mode == Performs.Modes.KEYFRAME) {
                        if(Object.keys(this.performs.keyframeApp.loadedAnimations).length) {
                            this.performs.keyframeApp.changePlayState();
                            if(this.settingsActive) {
                                this.createSettingsPanel();             
                            }
                            this.changePlayButtons(this.performs.keyframeApp.playing);
                        }
                        else {
                            LX.popup("No animations to play!", null, {size:["200px", "auto"]})
                        }
                    }
                    else if (this.performs.mode == Performs.Modes.SCRIPT) {
                        if(event.target.tagName == 'TEXTAREA') {
                            return;
                        }
                        this.performs.scriptApp.replay();
                        if(this.settingsActive) {
                            this.createSettingsPanel();             
                        }
                    }                    
                }
                else if(event.key == 'Escape') {
                    if(this.settingsActive || this.cameraActive || this.lightsActive) {
                        this.mainArea._moveSplit(-100);
                    }
                    this.mainArea.extend();
                    this.settingsActive = this.cameraActive = this.lightsActive = this.avatarsActive = this.backgroundsActive = false;
                }
            });
        }

        this.playing = false;
        this.captureEnabled = false;
        this.controlsActive = true;
        
        this.createIcons(canvasArea);

    }

    resize(width, height) {
        
        const aspect = width / height;
        for(let i = 0; i < this.performs.cameras.length; i++) {
            this.performs.cameras[i].aspect = aspect;
            this.performs.cameras[i].updateProjectionMatrix();
        }
        this.performs.renderer.setSize(width, height);
    }

    refresh(){
        if(this.gui) {
            this.gui.refresh();
        }
        if(this.settingsActive) {
            this.createSettingsPanel();             
        }
    }

    createSettingsPanel(force = false) {
        const p = this.panel;
        p.clear();

        if(p.getBranch("Animation")) {
            this.branchesOpened["Animation"] = !p.getBranch("Animation").content.parentElement.classList.contains("closed");
        }

        p.branch("Animation", {icon: "fa-solid fa-hands-asl-interpreting", closed: !this.branchesOpened["Animation"]});
        
        p.addText(null,"Animation mode options", null, {disabled: true});
        p.sameLine();

        let btn = p.addButton(null, "Script animation", (v, e) => {
            if (this.performs.currentCharacter.config) {
                this.performs.changeMode(Performs.Modes.SCRIPT);
                if(this.performs.scriptApp.currentIdle) {
                    this.performs.scriptApp.bindAnimationToCharacter(this.performs.scriptApp.currentIdle, this.performs.currentCharacter.model.name);
                }
            }
            else {
                this.performs.changeMode(-1);   
            }
            this.createSettingsPanel();
            const resetBtn = this.mainArea.sections[0].panels[2].root.querySelector("button[title='Reset pose']");
            if(resetBtn) {
                resetBtn.classList.remove("hidden");
            }

        }, {icon: "fa fa-code"} );

        if(this.performs.mode == Performs.Modes.SCRIPT || this.performs.mode == -1) {
            btn.children[0].classList.add("selected");
        }
        btn = p.addButton(null, "Keyframing animation",  (v, e) => {
            this.performs.changeMode(Performs.Modes.KEYFRAME);
            this.createSettingsPanel(); 
            
            const resetBtn = this.mainArea.sections[0].panels[2].root.querySelector("button[title='Reset pose']");
            if(resetBtn) {
                resetBtn.classList.add("hidden");
            }
        }, {icon: "fa fa-film"} );
        
        if(this.performs.mode == Performs.Modes.KEYFRAME) {
            btn.children[0].classList.add("selected");
        }

        p.endLine();
        p.sameLine();
        p.addText(null, "Script animation", null, {disabled: true});
        p.addText(null, "Clip animation", null, {disabled: true});
        p.endLine();

        p.addSeparator();

        if(!force) {
            if(this.performs.mode == Performs.Modes.SCRIPT || this.performs.mode == -1) {
                this.createBMLPanel(p, this.createSettingsPanel.bind(this));
            }
            else {
                this.createKeyframePanel(p, this.createSettingsPanel.bind(this));
            }
        }

        p.branch( "Transformations", { icon: "fa-solid fa-up-down-left-right", closed: !this.branchesOpened["Transformations"]} );

        const model = this.performs.currentCharacter.model;
        p.addVector3("Position", [model.position.x, model.position.y, model.position.z], (value, event) => {
            model.position.set(value[0], value[1], value[2]);
        }, {step:0.01});
        p.addVector3("Rotation", [THREE.MathUtils.radToDeg(model.rotation.x), THREE.MathUtils.radToDeg(model.rotation.y), THREE.MathUtils.radToDeg(model.rotation.z)], (value, event) => {
            model.rotation.set(THREE.MathUtils.degToRad(value[0]), THREE.MathUtils.degToRad(value[1]), THREE.MathUtils.degToRad(value[2]));
        }, {step:0.01});
        p.addNumber("Scale", model.scale.x, (value, event) => {
            model.scale.set(value, value, value);
        }, {step:0.01});      

        if(p.getBranch("Export")) {
            this.branchesOpened["Export"] = !p.getBranch("Export").content.parentElement.classList.contains("closed");
        }
        p.branch( "Export", { icon: "fa-solid fa-file-export", closed: !this.branchesOpened["Export"]} );
        p.addButton(null, "Export", (v) => {
            this.showExportDialog();
        })

    }

    createBackgroundsPanel() {

        const p = this.panel;
        if(p.getBranch("Backgrounds")) {
            this.branchesOpened["Backgrounds"] = !p.getBranch("Backgrounds").content.parentElement.classList.contains("closed");
        }
        p.clear();
        p.branch("Backgrounds");
        let color = this.performs.sceneColor;
        if( color instanceof String ) {
            color = Number(color.replace("#", "").replace("0x", ""));
        }
        color = new THREE.Color(color);

        p.addColor("Color", "#" + color.getHexString(), (value, event) => {
            this.performs.setBackPlaneColour(value);
        });
        
        // Open space
        const openBtn = p.addButton(null, "Open space", (value)=> {
            this.performs.setBackground( Performs.Backgrounds.OPEN);
            this.createBackgroundsPanel();
        }, {img: "./data/imgs/open-space.png", className: "centered"});
        openBtn.children[0].classList.add("roundedbtn");
        if( this.performs.background == Performs.Backgrounds.OPEN ) {
            openBtn.children[0].classList.add('selected');
        }
        // Studio background
        const studioBtn = p.addButton(null, "Studio", (value)=> {
            this.performs.setBackground( Performs.Backgrounds.STUDIO);
            this.createBackgroundsPanel();
        }, {img: "./data/imgs/studio-space.png", className: "centered"});
        studioBtn.children[0].classList.add("roundedbtn");        
        if( this.performs.background == Performs.Backgrounds.STUDIO ) {
            studioBtn.children[0].classList.add('selected');

            const ebtn = p.addButton(null, "Edit properties", (e) => {

                this.showStudioPropertiesDialog( );
                
            }, {icon: "fa fa-pen-to-square", className: "centered"});
            ebtn.children[0].style.width = "40px";
        }
        // Photocall background
        const photocallBtn = p.addButton(null, "Photocall", (value)=> {
            this.performs.setBackground( Performs.Backgrounds.PHOTOCALL);
            this.createBackgroundsPanel();
        }, {img: "./data/imgs/photocall-space.png", className: "centered"});
        photocallBtn.children[0].classList.add("roundedbtn");
        if( this.performs.background == Performs.Backgrounds.PHOTOCALL ) {
            photocallBtn.children[0].classList.add('selected');
            const ebtn = p.addButton(null, "Edit properties", (e) => {

                this.showPhotocallPropertiesDialog( );
                
            }, {icon: "fa fa-pen-to-square", className: "centered"});
            ebtn.children[0].style.width = "40px";
        }
    }

    showStudioPropertiesDialog() {
        const dialog = new LX.Dialog("Properties", (panel) => {
            let formFile = true;
            panel.sameLine();

            const logoFile = panel.addFile("File", (v, e) => {
                
                const files = panel.widgets["File"].domEl.children[1].files;
                if(!files.length) {
                    return;
                }
                const path = files[0].name.split(".");
                const filename = path[0];
                const extension = path[1].toLowerCase();
                if (extension == "png" || extension == "jpeg" || extension == "jpg" || extension == "mp4") { 
                     const imgCallback = ( event ) => {

                        if(extension == "mp4") {
                            const texture = new THREE.VideoTexture( event.target );
                            texture.colorSpace = THREE.SRGBColorSpace;
                            this.performs.backgroundTexture = texture;
                        }
                        else {
                            this.performs.backgroundTexture = event.target;
                        }
                        this.performs.setBackground( Performs.Backgrounds.STUDIO, this.performs.backgroundTexture);
                    }
                    if( extension != "mp4") {
                        const img = new Image();            
                        img.onload = imgCallback;            
                        img.src = v;
                        this.performs.videoBackground = null;
                    }
                    else {
                        const video = document.createElement( 'video' );
                        video.id = "backgrodundVideo";
                        video.src = v;
                        this.performs.videoBackground = video;
                        imgCallback({target: video});
                    }

                }
                else { LX.popup("Only accepts PNG, JPEG and JPG formats!"); }
            }, {type: "url", nameWidth: "41%", read:true});

            const textureURL = panel.addText("Image/Video URL", "", (v, e) => {
                if(!v) {
                    return;
                }
                const path = v.split(".");
                let filename = path[path.length-2];
                filename = filename.split("/");
                filename = filename.pop();
                let extension = path[path.length-1];
                extension = extension.split("?")[0];
                
                const imgCallback = ( event ) => {

                    this.performs.backgroundTexture = event.target;        
                    this.performs.setBackground( Performs.Backgrounds.STUDIO, this.performs.backgroundTexture);            
                }

                const img = new Image();            
                img.onload = imgCallback;    
                fetch(v)
                .then(function (response) {
                    if (response.ok) {
                    response.blob().then(function (miBlob) {
                        var objectURL = URL.createObjectURL(miBlob);
                        img.src = objectURL;
                    });
                    } else {
                    console.log("Not found");
                    }
                })
                .catch(function (error) {
                    console.log("Error:" + error.message);
                });        

            }, {nameWidth: "43%", read: true});
            textureURL.domEl.classList.add('hidden');

            panel.addComboButtons(null, [
                {
                    value: "From File",
                    callback: (v, e) => {                            
                        formFile = true;
                        if(!textureURL.domEl.classList.contains('hidden')) {
                            textureURL.domEl.classList.add('hidden');          
                        }
                        logoFile.domEl.classList.remove('hidden');                                                          
                    }
                },
                {
                    value: "From URL",
                    callback: (v, e) => {
                        formFile = false;
                        if(!logoFile.domEl.classList.contains('hidden')) {
                            logoFile.domEl.classList.add('hidden');           
                        }                                               
                        textureURL.domEl.classList.remove('hidden');          
                    }
                }
            ], {selected: formFile ? "From File" : "From URL", width: "170px", minWidth: "0px"});
            panel.endLine();

            panel.addDropdown("Choose a setting", ["Fill", "Adjust", "Expand", "Extend"], this.performs.backgroundSettings, (v) => {
                this.performs.setBackgroundSettings(v);
                this.performs.backgroundSettings = v;               
            } );

            panel.addNumber("Scale", this.performs.textureScale, (v) => {
                this.performs.setBackgroundTextureScale(v);
            }, {min: 0, max: 2, step: 0.01})

            panel.addVector2("Position", this.performs.texturePosition, (v) => {
                this.performs.setBackgroundTexturePosition(v);
            }, { step: 0.01})
        })
    }

    showPhotocallPropertiesDialog() {
        const dialog = new LX.Dialog("Properties", (panel) => {
            let formFile = true;
            panel.sameLine();

            const logoFile = panel.addFile("File", (v, e) => {

                const files = panel.widgets["File"].domEl.children[1].files;
                if(!files.length) {
                    return;
                }
                const path = files[0].name.split(".");
                const filename = path[0];
                const extension = path[1].toLowerCase();
                if (extension == "png" || extension == "jpeg" || extension == "jpg") { 
                     const imgCallback = ( event ) => {

                        this.performs.logo = event.target;        
                        this.performs.setBackground( Performs.Backgrounds.PHOTOCALL, this.performs.logo);            
                    }
    
                    const img = new Image();            
                    img.onload = imgCallback;            
                    img.src = v;

                }
                else { LX.popup("Only accepts PNG, JPEG and JPG formats!"); }
            }, {type: "url", nameWidth: "41%", read:true});

            let logoURL = panel.addText("Logo URL", "", (v, e) => {
                if(!v) {
                    return;
                }
                const path = v.split(".");
                let filename = path[path.length-2];
                filename = filename.split("/");
                filename = filename.pop();
                let extension = path[path.length-1];
                extension = extension.split("?")[0];
                
                const imgCallback = ( event ) => {

                    this.performs.logo = event.target;        
                    this.performs.setBackground( Performs.Backgrounds.PHOTOCALL, this.performs.logo);            
                }

                const img = new Image();            
                img.onload = imgCallback;    
                fetch(v)
                .then(function (response) {
                    if (response.ok) {
                    response.blob().then(function (miBlob) {
                        var objectURL = URL.createObjectURL(miBlob);
                        img.src = objectURL;
                    });
                    } else {
                    console.log("Not found");
                    }
                })
                .catch(function (error) {
                    console.log("Error:" + error.message);
                });        

            }, {nameWidth: "43%", read: true});
            logoURL.domEl.classList.add('hidden');

            panel.addComboButtons(null, [
                {
                    value: "From File",
                    callback: (v, e) => {                            
                        formFile = true;
                        if(!logoURL.domEl.classList.contains('hidden')) {
                            logoURL.domEl.classList.add('hidden');          
                        }
                        logoFile.domEl.classList.remove('hidden');                                                          
                    }
                },
                {
                    value: "From URL",
                    callback: (v, e) => {
                        formFile = false;
                        if(!logoFile.domEl.classList.contains('hidden')) {
                            logoFile.domEl.classList.add('hidden');           
                        }                                               
                        logoURL.domEl.classList.remove('hidden');          
                    }
                }
            ], {selected: formFile ? "From File" : "From URL", width: "170px", minWidth: "0px"});
            panel.endLine();

            panel.addNumber("Offset", this.performs.repeatOffset, (v) => {
                this.performs.setPhotocallOffset(v);
            }, {min: 0, max: 1, step: 0.01})
        })
    }

    createAvatarsPanel() {
        const p = this.panel;
        
        if(p.getBranch("Avatars")) {
            this.branchesOpened["Avatars"] = !p.getBranch("Avatars").content.parentElement.classList.contains("closed");
        }
        p.clear();
        p.branch('Avatars');

        p.addButton( "Upload yours", "Upload Avatar", (v) => {
            this.uploadAvatar((value, config) => {
                    
                if ( !this.performs.loadedCharacters[value] ) {
                    $('#loading').fadeIn(); //hide();
                    let modelFilePath = this.avatarOptions[value][0];                    
                    let configFilePath = this.avatarOptions[value][1];
                    let modelRotation = (new THREE.Quaternion()).setFromAxisAngle( new THREE.Vector3(1,0,0), this.avatarOptions[value][2] ); 
                    this.performs.loadAvatar(modelFilePath, config || configFilePath, modelRotation, value, ()=>{ 
                        this.performs.changeAvatar(value);
                        this.createAvatarsPanel();
                        if(this.performs.currentCharacter.config) {
                            this.performs.changeMode(Performs.Modes.SCRIPT);
                            
                            const resetBtn = this.mainArea.sections[0].panels[2].root.querySelector("button[title='Reset pose']");
                            if(resetBtn) {
                                resetBtn.classList.remove("hidden");
                            }
                        }
                        $('#loading').fadeOut();
                    }, (err) => {
                        $('#loading').fadeOut();
                        LX.popup("There was an error loading the avatar", "Avatar not loaded", {width: "30%"});
                    } );
                    return;
                } 

                // use controller if it has been already loaded in the past
                this.performs.changeAvatar(value);
                this.createAvatarsPanel();
            });
        } ,{ nameWidth: "100px", icon: "fa-solid fa-cloud-arrow-up" } );        
      
        p.addSeparator();


        if ( this.performs.avatarShirt ){
            let topsColor = this.performs.getClothesColour();

            p.addColor("Clothes", '#' + topsColor, (value, event) => {
                this.performs.setClothesColour(value);; // css works in sRGB
            });
        }

        // p.sameLine();
        let avatars = [];
        for(let avatar in this.avatarOptions) {
            // p.sameLine();
            const btn = p.addButton(null, avatar, (value)=> {
                this.performs.scriptApp.mood = "Neutral";
                if(this.performs.scriptApp.ECAcontroller) {
                    this.performs.scriptApp.ECAcontroller.reset();
                }

                // load desired model
                if ( !this.performs.loadedCharacters[value] ) {
                    $('#loading').fadeIn(); //hide();
                    let modelFilePath = this.avatarOptions[value][0]; 
                    let configFilePath = this.avatarOptions[value][1]; 
                    let modelRotation = (new THREE.Quaternion()).setFromAxisAngle( new THREE.Vector3(1,0,0), this.avatarOptions[value][2] ); 
                    this.performs.loadAvatar(modelFilePath, configFilePath, modelRotation, value, ()=>{ 
                        this.performs.changeAvatar(value);
                        this.createAvatarsPanel(); 
                        
                        $('#loading').fadeOut();
                    }, (err) => {
                        $('#loading').fadeOut();
                        LX.popup("There was an error loading the avatar", "Avatar not loaded", {width: "30%"});
                    } );
                    return;
                } 
    
                // use controller if it has been already loaded in the past
                this.performs.changeAvatar(value);
                this.createAvatarsPanel();

            }, {img: this.avatarOptions[avatar][3] ?? GUI.THUMBNAIL, className: "centered"});

            btn.children[0].classList.add("roundedbtn");
            if(avatar == this.performs.currentCharacter.model.name) {
                btn.children[0].classList.add("selected");

                let ebtn = p.addButton( null, "Edit Avatar", (v) => {
                    this.createEditAvatarDialog(v);
                } ,{ icon: "fa-solid fa-user-pen", className: "centered" } );
                ebtn.children[0].style.width = "40px";
            }
            avatars.push({ value: avatar, src: this.avatarOptions[avatar][3] ?? GUI.THUMBNAIL});
                // p.endLine();
        }
    }

    createEditAvatarDialog() {
        let name = this.performs.currentCharacter.model.name;
        this.editAvatar(name, {
            callback: (newName, rotation, config) => {
                if(name != newName) {
                    this.avatarOptions[newName] = [ this.avatarOptions[name][0], this.avatarOptions[name][1], this.avatarOptions[name][2], this.avatarOptions[name][3]]
                    delete this.avatarOptions[name];
                    name = newName;
                    this.performs.currentCharacter.model.name = name;
                    this.refresh();
                }
                this.avatarOptions[name][2] = rotation;
                
                const modelRotation = (new THREE.Quaternion()).setFromAxisAngle( new THREE.Vector3(1,0,0), rotation ); 
                this.performs.currentCharacter.model.quaternion.premultiply( modelRotation );
                if(this.performs.currentCharacter.config && this.performs.currentCharacter.config == config) {
                    return;
                }
                this.performs.currentCharacter.config = config;
                if(config) {
                    this.avatarOptions[name][1] = config._filename;
                    this.performs.scriptApp.onLoadAvatar(this.performs.currentCharacter.model, this.performs.currentCharacter.config, this.performs.currentCharacter.skeleton);
                    this.performs.currentCharacter.skeleton.pose();
                    this.performs.scriptApp.ECAcontroller.reset();                        
                    this.performs.changeMode(Performs.Modes.SCRIPT);
                    if(this.settingsActive) {
                        this.createSettingsPanel();             
                    }
                    const resetBtn = this.mainArea.sections[0].panels[2].root.querySelector("button[title='Reset pose']");
                    if(resetBtn) {
                        resetBtn.classList.remove("hidden");
                    }
                }

            }, 
            name, modelFilePath: this.avatarOptions[name][0], modelConfigPath: this.avatarOptions[name][1]
        });
    }
    createCameraPanel() {
        const p = this.panel;
        if(p.getBranch("Recording")) {
            this.branchesOpened["Recording"] = !p.getBranch("Recording").content.parentElement.classList.contains("closed");
        }
        
        p.clear();
        p.branch( "Recording", { icon: "fa-solid fa-video", closed: !this.branchesOpened["Recording"]} );

        let cameras = [];
        for (let i = 0; i < this.performs.cameras.length; i++) {
            const camera = {
                value: (i + 1).toString(),
                callback: (v,e) => {
                    this.performs.controls[this.performs.camera].enabled = false; // disable controls from previous camera
                    this.performs.camera = v - 1; // update active camera
                    this.performs.controls[this.performs.camera].enabled = true; // enable controls from current (new) camera
                }
            }

            cameras.push(camera);                  
        }

        p.sameLine();
        p.addComboButtons("Camera", cameras, {selected: (this.performs.camera + 1).toString(), width: "auto", nameWidth:"260px"});    
        p.addButton(null, "Reset", (V) => {
            this.performs.controls[this.performs.camera].reset();

        }, { width: "30px", icon: "fa-solid fa-rotate-left"} ) 
        p.addComboButtons(null, [
            {
                value: "Restricted View",
                icon: "fa-solid fa-camera",
                callback: (v, e) => {
                    this.performs.toggleCameraMode(); 
                    this.createCameraPanel();
                }
            },
            {
                value: "Free View",
                icon: "fa-solid fa-up-down-left-right",
                callback: (v, e) => {
                    this.performs.toggleCameraMode(); 
                    this.createCameraPanel();
                }
            }
        ], {selected: this.performs.cameraMode ? "Free View" : "Restricted View"});
        p.endLine("left");

        p.addSeparator();
        p.addCheckbox("Enable capture", this.captureEnabled, (v) => {
            this.captureEnabled = v;
            this.createCameraPanel();
            const btn = this.mainArea.sections[0].panels[1].root.querySelector("button[title='Record video']");
            if(btn) {
                if(this.captureEnabled) {
                    btn.classList.remove("hidden");
                }
                else {
                    btn.classList.add("hidden");
                }
            }
        })
        
        if(this.captureEnabled) {

            // p.addButton("Capture", this.performs.animationRecorder.isRecording ? "Stop recording" : "Start recording", (value, event) => {
            //     // Replay animation - dont replay if stopping the capture
            //     if(!this.performs.animationRecorder.isRecording) {
            //         if(this.settingsActive || this.cameraActive || this.lightsActive) {
            //             this.mainArea._moveSplit(-100);
            //         }
            //         this.mainArea.extend();
            //         this.settingsActive = this.cameraActive = this.lightsActive = this.avatarsActive = this.backgroundsActive = false;
            //     }
            //     if(this.performs.mode == Performs.Modes.SCRIPT) {
            //         this.performs.scriptApp.ECAcontroller.reset(true);
            //         this.performs.animationRecorder.manageCapture();
            //         this.createCameraPanel();
            //     }
            //     else { 
            //         this.showRecordingDialog(() => {
            //             this.performs.animationRecorder.manageMultipleCapture(this.performs.keyframeApp);
            //             this.createCameraPanel();
            //         });
            //     }
            // }, {icon: "fa-solid fa-circle", buttonClass: "floating-button" + (this.performs.animationRecorder.isRecording ? "-playing" : "")});

            p.addText(null, "Select cameras to be recorded:", null, {disabled: true});
            p.sameLine();
            p.addCheckbox("1", this.performs.cameras[0].record, (value, event) => {
                this.performs.cameras[0].record = value;
            });
            p.addCheckbox("2", this.performs.cameras[1].record, (value, event) => {
                this.performs.cameras[1].record = value;
            });
            p.addCheckbox("3", this.performs.cameras[2].record, (value, event) => {
                this.performs.cameras[2].record = value;
            });
            p.endLine();

            p.addTitle("Automatic exportation")
            p.addCheckbox("Export as ZIP", this.performs.animationRecorder.exportZip, (v) => {
                this.performs.animationRecorder.exportZip = v;
                this.createCameraPanel();            
            })
        }
    }

    createLightsPanel() {
        const p = this.panel;
        
        p.clear();
        p.branch( "Lights", { icon: "fa-solid fa-lightbulb"} );

        p.addColor("Color", "#" + this.performs.dirLight.color.getHexString(), (value, event) => {
            this.performs.dirLight.color.set(value);
        });
        
        const position = [this.performs.dirLight.position.x , this.performs.dirLight.position.y, this.performs.dirLight.position.z];
        p.addVector3("Position", position, (v) => {
            this.performs.dirLight.position.set(v[0], v[1], v[2]);
        }, {min: -10, max: 10})
    }

    createIcons(area) {
        this.settingsActive = this.backgroundsActive = this.avatarsActive = this.cameraActive = this.lightsActive = false;
        const buttons = [
            {
                name: "Hide controls",
                selectable: false,
                icon: this.controlsActive ? "fa fa-eye-slash": 'fa fa-eye',
                class: "larger",
                callback: (b) => {
                    this.controlsActive = !this.controlsActive;   
                    if(this.controlsActive) {
                        const icon = document.getElementsByClassName('fa fa-eye')[0];
                        icon.classList.remove('fa-eye');
                        icon.classList.add('fa-eye-slash');
                    }
                    else {
                        const icon = document.getElementsByClassName('fa fa-eye-slash')[0];
                        icon.classList.remove('fa-eye-slash');
                        icon.classList.add('fa-eye');
                    }
                    let el = document.getElementById('overlay-controls');
                    for(let i = 1; i < el.children.length; i++) {
                        if(!this.controlsActive) {
                            el.children[i].classList.add("hide");
                        }
                        else {
                            el.children[i].classList.remove("hide");
                        }
                    }

                    el = document.getElementById('overlay-playbuttons');
                    for(let i = 0; i < el.children.length; i++) {
                        if(!this.controlsActive) {
                            el.children[i].classList.add("hide");
                        }
                        else {
                            el.children[i].classList.remove("hide");
                        }
                    }

                    el = document.getElementById('overlay-buttons');
                    for(let i = 0; i < el.children.length; i++) {
                        if(!this.controlsActive) {
                            el.children[i].classList.add("hide");
                        }
                        else {
                            el.children[i].classList.remove("hide");
                        }
                    }
                }
            },
            {
                name: "Settings",
                selectable: false,
                icon: "fa fa-gear",
                class: "larger",
                callback: (b) => {
                    if(this.settingsActive) {
                        this.mainArea._moveSplit(-100);
                        this.mainArea.extend();
                        this.settingsActive = false;
                        return;
                    }
                    else if(this.mainArea.split_extended) {
                        this.mainArea.reduce();
                    }
                    if(!this.cameraActive && !this.lightsActive) {
                        this.mainArea._moveSplit(100);
                    }
                    this.settingsActive = true;
                    this.cameraActive = this.backgroundsActive = this.avatarsActive = this.lightsActive = false;
                    this.createSettingsPanel();                    
                }
            },
            {
                name: "Avatars",
                selectable: false,
                icon: "fa fa-user-pen",
                class: "larger",
                callback: () => {
                    if(this.avatarsActive) {
                        this.mainArea.extend();
                        this.avatarsActive = false;
                        return;
                    }
                    else if(this.mainArea.split_extended) {
                        this.mainArea.reduce();
                    }
                    if(this.settingsActive || this.cameraActive || this.lightsActive) {
                        this.mainArea._moveSplit(-100);
                    }
                    this.avatarsActive = true;
                    this.cameraActive = this.settingsActive = this.backgroundsActive = this.lightsActive = false;
                    this.createAvatarsPanel();
                }
            },
            {
                name: "Backgrounds",
                selectable: false,
                icon: "fa fa-images",
                class: "larger",
                callback: (b) => {
                    if(this.backgroundsActive) {
                        this.mainArea.extend();
                        this.backgroundsActive = false;
                        return;
                    }
                    else if(this.mainArea.split_extended) {
                        this.mainArea.reduce();
                    }
                    if(this.settingsActive || this.cameraActive || this.lightsActive) {
                        this.mainArea._moveSplit(-100);
                    }
                    this.backgroundsActive = true;
                    this.cameraActive = this.settingsActive = this.avatarsActive = this.lightsActive = false;
                    this.createBackgroundsPanel();                    
                }
            },            
            {
                name: "Camera",
                selectable: false,
                icon: "fa fa-video",
                class: "larger",
                callback: (b) => {
                    if(this.cameraActive) {
                        this.mainArea._moveSplit(-100);
                        this.mainArea.extend();
                        this.cameraActive = false;
                        return;
                    }
                    else if(this.mainArea.split_extended) {
                        this.mainArea.reduce();
                    }
                    if(!this.settingsActive && !this.lightsActive) {
                        this.mainArea._moveSplit(100);
                    }
                    this.cameraActive = true;
                    this.settingsActive = this.backgroundsActive = this.avatarsActive = this.lightsActive = false;
                    this.createCameraPanel();                    
                }
            },
            {
                name: "Lights",
                selectable: false,
                icon: "fa fa-lightbulb",
                class: "larger",
                callback: (b) => {
                    if(this.lightsActive) {
                        this.mainArea._moveSplit(-100);
                        this.mainArea.extend();
                        this.lightsActive = false;
                        return;
                    }
                    else if(this.mainArea.split_extended) {
                        this.mainArea.reduce();
                    }
                    if(!this.settingsActive && !this.cameraActive) {
                        this.mainArea._moveSplit(100);
                    }
                    this.lightsActive = true;
                    this.settingsActive = this.backgroundsActive = this.avatarsActive = this.cameraActive = false;
                    this.createLightsPanel();                    
                }
            },
            {
                name: "Info",
                selectable: false,
                icon: "fa fa-question",
                class: "larger",
                callback: (b) => {
                    this.showGuide();     
                }
            },
        ]
        area.addOverlayButtons(buttons, {float: "vr", id: "overlay-controls"});
        this.createPlayButtons()
        // const buttonsContainer = document.createElement('div');
        // buttonsContainer.id ="buttons-container";
        // buttonsContainer.className = "flex-vertical left-container";
        // area.root.appendChild(buttonsContainer);

        // let backgrounds = document.createElement("i");
        // backgrounds.className = "fa fa-images button";
        // let title = document.createElement("span");
        // title.innerText ="Show backgrounds";
        // backgrounds.appendChild(title);
        
        // backgrounds.addEventListener("click", (v) => {
        //     if(!this.backgroundsDialog.visible) {
        //         v.target.classList.add("active")
        //         // this.backgroundsDialog.fadeIn(200);
        //         // this.backgroundsDialog.root.classList.remove("hidden");
        //         this.backgroundsDialog.display();
        //         this.backgroundsDialog.root.classList.remove("fade-out");
        //         this.backgroundsDialog.root.classList.add("fade-in");
        //     }
        //     else {
        //         v.target.classList.remove("active");
        //         // this.backgroundsDialog.root.classList.add("hidden");
        //         this.backgroundsDialog.root.classList.remove("fade-in");
        //         this.backgroundsDialog.root.classList.add("fade-out");
        //         setTimeout(() => {this.backgroundsDialog.hide()}, 480);
        //     }
          
        // })

        // buttonsContainer.appendChild(backgrounds);

        // let avatars = document.createElement("i");
        // avatars.className = "fa fa-person button";
        // title = document.createElement("span");
        // title.innerText ="Show avatars";
        // title.style.top = "40px";
        // avatars.appendChild(title);
        
        // avatars.addEventListener("click", (v) => {
        //     if(!this.avatarsDialog.visible) {
        //         v.target.classList.add("active")               
        //         this.avatarsDialog.display();
        //         this.avatarsDialog.root.classList.remove("fade-out");
        //         this.avatarsDialog.root.classList.add("fade-in");
        //         this.showBSavatars = true;
        //     }
        //     else {
        //         v.target.classList.remove("active");
        //         // this.backgroundsDialog.root.classList.add("hidden");
        //         this.avatarsDialog.root.classList.remove("fade-in");
        //         this.avatarsDialog.root.classList.add("fade-out");
        //         this.showBSavatars = false;
        //         setTimeout(() => {this.avatarsDialog.hide()}, 470);
        //     }
        // })

        // buttonsContainer.appendChild(avatars);
    }

    createPlayButtons() {
        const area = this.mainArea.sections[0];
        // area.panels[1].clear();
        let buttons = [
            {
                name: "Reset pose",
                icon: "fa fa-person",
                class: "relative left",
                callback: (value, event) => {
                    // Replay animation - dont replay if stopping the capture
                    if(this.performs.mode == Performs.Modes.SCRIPT) {
                        this.performs.scriptApp.mood = "Neutral";
                        this.performs.scriptApp.ECAcontroller.reset();
                        this.createSettingsPanel();
                    }
                }
            }
        ];
        let playButtons = [ 
            {
                name: "Record video",
                icon: "fa fa-circle",
                class: "relative",
                callback: (value, event) => {
                    // Replay animation - dont replay if stopping the capture
                    if(!this.performs.animationRecorder.isRecording) {
                        if(this.settingsActive || this.cameraActive || this.lightsActive) {
                            this.mainArea._moveSplit(-100);
                        }
                        this.mainArea.extend();
                        this.settingsActive = this.cameraActive = this.lightsActive = this.avatarsActive = this.backgroundsActive = false;
                    }
                    const recordBtn = this.mainArea.sections[0].panels[1].root.querySelector("button[title='Record video']");

                    if(this.performs.mode == Performs.Modes.SCRIPT) {
                        this.performs.scriptApp.ECAcontroller.reset(true);
                        setTimeout(() => {
                            this.performs.animationRecorder.manageCapture();
                            this.createCameraPanel();
                            if(recordBtn) {
                                if(this.performs.animationRecorder.isRecording) {
                                    recordBtn.classList.remove("floating-button");
                                    recordBtn.classList.add("floating-button-playing");
                                }
                                else {
                                    recordBtn.classList.remove("floating-button-playing");
                                    recordBtn.classList.add("floating-button");
                                }
                            }
                        }, 100)
                    }
                    else { 
                        this.showRecordingDialog(() => {
                            this.performs.animationRecorder.manageMultipleCapture(this.performs.keyframeApp);
                            this.createCameraPanel();
                        });
                    }
                    if(recordBtn) {
                        if(this.performs.animationRecorder.isRecording) {
                            recordBtn.classList.remove("floating-button");
                            recordBtn.classList.add("floating-button-playing");
                        }
                        else {
                            recordBtn.classList.remove("floating-button-playing");
                            recordBtn.classList.add("floating-button");
                        }
                    }
                    
                }
            },
            {
                name: "Play",
                icon: "fa fa-play",
                class: "large",
                callback: () => {
                    if(this.performs.mode == Performs.Modes.SCRIPT) {
                        this.performs.scriptApp.replay();
                    }
                    else if(this.performs.mode == Performs.Modes.KEYFRAME) {
                        if(Object.keys(this.performs.keyframeApp.loadedAnimations).length) {
                            this.performs.keyframeApp.changePlayState(true);
                            this.changePlayButtons(true);
                        }
                        else {
                            LX.popup("No animations to play!", null, {size:["200px", "auto"]})
                        }
                    }

                    if(this.performs.videoBackground && this.performs.background == Performs.Backgrounds.STUDIO) {
                        this.performs.videoBackground.currentTime = 0;
                        this.performs.videoBackground.play();
                    }
                }
            },
            {
                name: "Stop",
                icon: "fa fa-stop",
                class: "large",
                callback: () => {
                    if(this.performs.mode == Performs.Modes.SCRIPT) {
                        this.performs.scriptApp.ECAcontroller.reset(true);
                    }
                    else if(this.performs.mode == Performs.Modes.KEYFRAME) {
                        this.performs.keyframeApp.changePlayState(false);
                    }
                    if(this.performs.videoBackground) {
                        this.performs.videoBackground.pause();
                        this.performs.videoBackground.currentTime = 0;
                    }
                    this.changePlayButtons(false);
                }
            },            
        ];
        area.addOverlayButtons(playButtons, {float: "vbr", id: "overlay-playbuttons"});
        area.addOverlayButtons(buttons, {float: "hbr", id: "overlay-buttons"});

        const btn = this.mainArea.sections[0].panels[1].root.querySelector("button[title='Stop']");
        if(btn) {
            btn.classList.add("hidden");
        }

        const recordBtn = this.mainArea.sections[0].panels[1].root.querySelector("button[title='Record video']");
        if(recordBtn) {
            recordBtn.classList.add("floating-button");
            recordBtn.classList.add("hidden");
        }

        const resetBtn = this.mainArea.sections[0].panels[2].root.querySelector("button[title='Reset pose']");
        if(resetBtn) {
            resetBtn.classList.add("floating-button");
        }
        if(this.performs.mode != Performs.Modes.SCRIPT) {
            resetBtn.classList.add("hidden");
        }
    }

    changePlayButtons(isPlaying) {
        if(isPlaying) {
            const btn = this.mainArea.sections[0].panels[1].root.querySelector("button[title='Stop']");
            btn.classList.remove("hidden");
            const btn2 = this.mainArea.sections[0].panels[1].root.querySelector("button[title='Play']");
            btn2.classList.add("hidden");
        }
        else {
            const btn = this.mainArea.sections[0].panels[1].root.querySelector("button[title='Play']");
            btn.classList.remove("hidden");
            const btn2 = this.mainArea.sections[0].panels[1].root.querySelector("button[title='Stop']");
            btn2.classList.add("hidden");
        }
    }

    onChangeMode(mode) {
        if(mode == Performs.Modes.SCRIPT) {
            let msg = { type: "behaviours", data: [ { type: "faceEmotion", emotion: this.performs.scriptApp.mood.toUpperCase(), amount: this.performs.scriptApp.moodIntensity, start: 0.0, shift: true } ] };
            
            const resetBtn = this.mainArea.sections[0].panels[2].root.querySelector("button[title='Reset pose']");
            if(resetBtn) {
                resetBtn.classList.remove("hidden");
            }
            this.changePlayButtons(false);
            this.performs.scriptApp.ECAcontroller.processMsg(JSON.stringify(msg));
        }
        else if(mode == Performs.Modes.KEYFRAME) {
            const resetBtn = this.mainArea.sections[0].panels[2].root.querySelector("button[title='Reset pose']");
            if(resetBtn) {
                resetBtn.classList.add("hidden");
            }           
            this.changePlayButtons( this.performs.keyframeApp.playing);
        }
        else {
            const resetBtn = this.mainArea.sections[0].panels[2].root.querySelector("button[title='Reset pose']");
            if(resetBtn) {
                resetBtn.classList.add("hidden");
            }
            this.changePlayButtons(false);
        }
    }

    createBMLPanel(panel, refresh) {
        
        this.bmlGui = panel;

        if (!this.performs.currentCharacter.config) {
            this.bmlGui.addText(null, "To use this mode, the current character's configuration file is needed.", null, {disabled: true});
            this.bmlGui.addButton(null, "Edit avatar", () => { 
                this.createEditAvatarDialog();                
            }, {icon: "fa fa-edit"})  
            return;
        }
                
        this.bmlGui.addNumber("Speed", this.performs.scriptApp.speed, (value, event) => {
            // this.performs.speed = Math.pow( Math.E, (value - 1) );
            this.performs.scriptApp.speed = value;
        }, { min: 0.1, max: 2, step: 0.01});

        this.bmlGui.sameLine();
        this.bmlGui.addButton( null, "Reset pose", (value, event) =>{
            this.performs.scriptApp.mood = "Neutral";
            this.performs.scriptApp.ECAcontroller.reset();
            refresh();
        }, {icon: "fa-solid fa-person", width: "40px", class:"floating-button"});

        this.bmlGui.addButton( null, "Replay", (value, event) =>{
            this.performs.scriptApp.replay();         
            this.changePlayButtons(false);    
        }, {icon: "fa-solid fa-play"});

        this.bmlGui.endLine();

        this.bmlGui.addSeparator();
        this.bmlInputData.openButton = this.bmlGui.addButton( null, "BML Input", (value, event) =>{

            if ( this.bmlInputData.dialog ){ this.bmlInputData.dialog.close(); }

            this.bmlInputData.dialog = new LX.PocketDialog( "BML Instruction", p => {
                this.bmlInputData.dialog = p;

                let htmlStr = "Write in the text area below the bml instructions to move the avatar from the web application. A sample of BML instructions can be tested through the helper tabs in the right panel.";
                p.addTextArea(null, htmlStr, null, {disabled: true, fitHeight: false});
    
                p.addButton(null, "Click here to see BML instructions and attributes", () => {
                    window.open("https://github.com/upf-gti/performs/blob/main/docs/InstructionsBML.md");
                });
    
                htmlStr = "Note: In 'speech', all text between '%' is treated as actual words. An automatic translation from words (dutch) to phonemes (arpabet) is performed.";
                htmlStr += "\n\nNote: Each instruction is inside '{}'. Each instruction is separated by a coma ',' except que last one.";
                p.addTextArea(null, htmlStr, null, {disabled: true, height: "72px"});
    
                htmlStr = 'An example: { "type":"speech", "start": 0, "text": "%hallo%.", "sentT": 1, "sentInt": 0.5 }, { "type": "gesture", "start": 0, "attackPeak": 0.5, "relax": 1, "end": 2, "locationBodyArm": "shoulder", "lrSym": true, "hand": "both", "distance": 0.1 }';
                p.addTextArea(null, htmlStr, null, {disabled: true, fitHeight: false});
    
                const area = new LX.Area({ height: "59%" });
                p.attach( area.root );
    
                let editor = new LX.CodeEditor(area, {
                    highlight: 'JSON',
                    skip_info: true,
                    allow_add_scripts: false, 
                    name : "BML"
                });
                editor.setText( this.bmlInputData.prevInstanceText );
                this.bmlInputData.codeObj = editor;

                p.addButton(null, "Send", () => {
                    let msg = {
                        type: "behaviours",
                        data: this._stringToBML( this.bmlInputData.codeObj.getText() )
                    };
                    
                    if ( !msg.data.length ){ return; }

                    this.performs.scriptApp.processMessageRawBlocks( [{type: "bml", data: msg}] );
                });

                p.addButton(null, "Edit on Animics", () => {

                    const sendData = () => {
                        if(!this.animics.app.global) 
                        {
                            setTimeout(sendData, 1000)
                        }
                        else {
                            if(!this.animics.app.global.app) {

                                this.animics.app.global.createApp({mode:"bml"});
                                this.animics.app.global.app.editor.realizer = window;
                                this.animics.app.global.app.editor.performsApp = this.performs;
                            }

                            let msg = {
                                type: "behaviours",
                                data: this._stringToBML( this.bmlInputData.codeObj.getText() )
                            };
                            
                            //Send to ANIMICS
                            if(this.animics.app.global.app.editor.activeTimeline)
                                this.animics.app.global.app.editor.clearAllTracks(false);
                            this.animics.app.global.app.editor.gui.loadBMLClip({behaviours: msg.data});
                            
                        }
                    }
                    if(!this.animics || this.animics.closed) {
                        this.animics = window.open(Performs.ANIMICS_URL);
                        
                        this.animics.onload = (e, d) => {
                            this.animics.app = e.currentTarget;
                            sendData();
                        }
                        this.animics.addEventListener("beforeunload", () => {
                            this.animics = null;
                        });
                    }
                    else {
                        sendData();
                    }
                })
    
            }, { size: ["35%", "70%"], float: "left", draggable: false, closable: true, onclose: (root)=>{
                this.bmlInputData.prevInstanceText = this.bmlInputData.codeObj.getText();
                this.bmlInputData.dialog = null;
                this.bmlInputData.codeObj = null;
                root.remove();
            }});
    
        });

        this.sigmlInputData.openButton = this.bmlGui.addButton( null, "SiGML Input", (value, event) =>{

            if ( this.sigmlInputData.dialog ){ 
                this.sigmlInputData.prevInstanceText = this.sigmlInputData.codeObj.getText();
                this.sigmlInputData.dialog.close(); 
            }

            this.sigmlInputData.dialog = new LX.PocketDialog( "SiGML Instruction", p => {
                let htmlStr = "Write in the text area below the SiGML instructions (as in JaSigning) to move the avatar from the web application. Work in progress";
                p.addTextArea(null, htmlStr, null, {disabled: true, fitHeight: true});       
    
                const area = new LX.Area({ height: "85%" });
                p.attach( area.root );
    
                let editor = new LX.CodeEditor(area, {
                    highlight: 'XML',
                    skip_info: true,
                    allow_add_scripts: false, 
                    name : "XML"
                });
                editor.setText( this.sigmlInputData.prevInstanceText );
                this.sigmlInputData.codeObj = editor;
    
                p.addButton(null, "Send", () => {
                    let text = this.sigmlInputData.codeObj.getText().replaceAll("\n", "").replaceAll("\r", "");
                    this.performs.scriptApp.processMessageRawBlocks( [ {type:"sigml", data: text } ] );
                });
    
            }, { size: ["35%", "70%"], float: "left", draggable: false, closable: true});
        

        });

        let languages = Object.keys(this.performs.scriptApp.languageDictionaries);
        let glossesDictionary = {};
        this.language = languages[0];

        for(let i = 0; i < languages.length; i++) {
            let lang = languages[i];
            glossesDictionary[lang] = [];
            for(let glossa in this.performs.scriptApp.languageDictionaries[lang].glosses) {
                glossesDictionary[lang].push(glossa.replaceAll(".sigml", ""));
            }
        }
        this.glossInputData.openButton = this.bmlGui.addButton( null, "Glosses Input", (value, event) =>{

            if ( this.glossInputData.dialog ){ this.glossInputData.dialog.close(); }

            this.glossInputData.dialog = new LX.PocketDialog( "Glosses Input", p => {
                p.refresh = () => {
                    p.clear();
                    let htmlStr = "Select or write in the text area below the glosses (NGT) to move the avatar from the web application. Work in progress";
                    p.addTextArea(null, htmlStr, null, {disabled: true, fitHeight: false});  
                    
                    const area = new LX.Area({ height: "85%" });
                    p.attach( area.root );
                    
                    p.addDropdown("Language", languages, this.performs.scriptApp.selectedLanguage, (value, event) => {
                        this.performs.scriptApp.selectedLanguage = value;
                        p.refresh();
                    } );

                    p.addDropdown("Select glosses", glossesDictionary[ this.language ], "", (value, event) => {
                        this.glossInputData.glosses += " " + value;
                        this.glossInputData.textArea.set( this.glossInputData.glosses );
                    }, {filter: true});
                    
                    this.glossInputData.textArea = p.addTextArea("Write glosses", this.glossInputData.glosses, (value, event) => {
                        this.glossInputData.glosses = value;
                    }, {placeholder: "Hallo Leuk"});

                    p.addButton(null, "Send", () => {
        
                        let glosses = this.glossInputData.glosses.replaceAll( "\n", " ").split( " " );
                        for ( let i = 0; i < glosses.length; ++i ){
                            if ( typeof( glosses[i] ) != "string" || glosses[i].length < 1 ){ 
                                glosses.splice( i, 1 ); 
                                --i; 
                                continue; 
                            }
                            glosses[i] = { type: "glossName", data: glosses[i].toUpperCase() };
                        }
                        if(!glosses.length) alert("Please, write or select at least one gloss");
                        this.performs.scriptApp.processMessageRawBlocks(glosses);    
                    });
                }
                p.refresh();
            }, { float: "left", draggable: false, closable: true } );        
        });    

        this.bmlGui.addSeparator();
        this.bmlGui.sameLine();
        this.bmlGui.addNumber("Random Signs", this.randomSignAmount, (v,e)=>{this.randomSignAmount = v;}, { min:0, max:100, slider: false, icon:"fa-solid fa-dice", nameWidth: "200px" } );
        this.bmlGui.addButton( null, "Play random signs", (v,e)=>{ 
            if (!this.randomSignAmount ){ return; }
            let k = Object.keys( this.performs.scriptApp.languageDictionaries[this.performs.scriptApp.selectedLanguage]["glosses"] );
            
            let m = [];
            for( let i = 0; i < this.randomSignAmount; ++i ){
                m.push( { type: "glossName", data: k[ Math.floor( Math.random() * (k.length-1) ) ] } );
            }
            console.log( JSON.parse(JSON.stringify(m)));
            this.performs.scriptApp.processMessageRawBlocks( m );
        }, { width: "40px", icon: "fa-solid fa-share"} );
        this.bmlGui.endLine();

        this.bmlGui.addSeparator();
        this.bmlGui.addDropdown("Mood", [ "Neutral", "Anger", "Happiness", "Sadness", "Surprise", "Fear", "Disgust", "Contempt" ], this.performs.scriptApp.mood, (value, event) => {
            let msg = { type: "behaviours", data: [ { type: "faceEmotion", emotion: value.toUpperCase(), amount: this.performs.scriptApp.moodIntensity, start: 0.0, shift: true } ] };
            this.performs.scriptApp.mood = value;
            this.performs.scriptApp.ECAcontroller.processMsg(JSON.stringify(msg));
        });

        this.bmlGui.addNumber("Mood intensity", this.performs.scriptApp.moodIntensity, (v) => {
            let msg = { type: "behaviours", data: [ { type: "faceEmotion", emotion: this.performs.scriptApp.mood.toUpperCase(), amount: v, start: 0.0, shift: true } ] };
            this.performs.scriptApp.ECAcontroller.processMsg(JSON.stringify(msg));
            this.performs.scriptApp.moodIntensity = v;
        }, {min: 0.1, max: 1.0, step: 0.01})

        this.bmlGui.addCheckbox("Apply idle animation", this.performs.scriptApp.applyIdle, (v) => {
            this.performs.scriptApp.applyIdle = v;            
            if(refresh) {
                refresh();
            }
        }, {nameWidth: "115px"});
        if(this.performs.scriptApp.applyIdle) {
   
            this.bmlGui.addDropdown("Animations", Object.keys(this.performs.scriptApp.loadedIdleAnimations), this.performs.scriptApp.currentIdle, (v) => {
                this.performs.scriptApp.bindAnimationToCharacter(v, this.performs.currentCharacter.model.name);
            })
            this.bmlGui.addNumber("Intensity", this.performs.scriptApp.intensity, (v) => {
                this.performs.scriptApp.setIntensity(v);
            }, {min: 0.1, max: 1.0, step: 0.01})
        }
        this.bmlGui.merge(); // random signs
             
    }

    createKeyframePanel(panel, refresh) {
      
        this.keyframeGui = panel;
  
        this.keyframeGui.addNumber("Speed", this.performs.keyframeApp.speed, (value, event) => {
            // this.performs.speed = Math.pow( Math.E, (value - 1) );
            this.performs.keyframeApp.speed = value;
        }, { min: -2, max: 2, step: 0.01});

        this.keyframeGui.sameLine();
        const animations = Object.keys(this.performs.keyframeApp.loadedAnimations);
        this.keyframeGui.addDropdown("Animation", animations, this.performs.keyframeApp.currentAnimation, (v) => {
            this.performs.keyframeApp.onChangeAnimation(v);
        }, {nameWidth:"70px"});

        const fileinput = this.keyframeGui.addFile("Animation File", (v, e) => {
            let files = panel.widgets["Animation File"].domEl.children[1].files;
            if(!files.length) {
                return;
            }
            this.performs.keyframeApp.loadFiles(files, (animations)=> {
                
                if(animations.length) {
                    this.performs.changeMode(Performs.Modes.KEYFRAME);
                    if(refresh) {
                        refresh();
                    }
                }
                else {
                    LX.popup("This file doesn't contain any animation or a valid source avatar!");
                }
            })
        }, {type: "url", multiple: "multiple"});

        fileinput.domEl.classList.add('hidden');
        fileinput.domEl.children[1].setAttribute("multiple", "multiple");

        this.keyframeGui.addButton(null, "Upload animation", (v,e) => {
            fileinput.domEl.children[1].click();
           
        }, { icon: "fa fa-upload", width: "40px", className:"no-padding"});

        this.keyframeGui.addButton(null, "<i class='fa fa-solid " + (this.performs.keyframeApp.playing ? "fa-stop'>": "fa-play'>") + "</i>", (v,e) => {
            this.performs.keyframeApp.changePlayState();
            this.changePlayButtons(this.performs.keyframeApp.playing );
            if(refresh) {
                refresh();
            }
        }, { width: "40px", className:"no-padding"});
        this.keyframeGui.endLine(); 

        if( animations.length > 1 ) {
            this.keyframeGui.addCheckbox("Blend animations", this.performs.keyframeApp.useCrossFade, (v) => {
                this.performs.keyframeApp.useCrossFade = v;
                if(refresh) {
                    refresh();
                }
            },{nameWidth: "auto"})
    
            if(this.performs.keyframeApp.useCrossFade) {
                this.keyframeGui.addNumber("Blend time", this.performs.keyframeApp.blendTime, (v) => {
                    this.performs.keyframeApp.blendTime = v;
                }, {min: 0.0, step: 0.01});
            }
        }

        this.keyframeGui.branch("Retargeting")
           
        this.keyframeGui.addCheckbox("Source embedded transforms", this.performs.keyframeApp.srcEmbedWorldTransforms, (v) => {
            this.performs.keyframeApp.srcEmbedWorldTransforms = v;
            this.performs.keyframeApp.onChangeAnimation(this.performs.keyframeApp.currentAnimation, true);
            if(refresh) {
                refresh();
            }
        },{nameWidth: "auto"})
            
        this.keyframeGui.addCheckbox("Target embedded transforms", this.performs.keyframeApp.trgEmbedWorldTransforms, (v) => {
            this.performs.keyframeApp.trgEmbedWorldTransforms = v;
            this.performs.keyframeApp.onChangeAnimation(this.performs.keyframeApp.currentAnimation, true);
            if(refresh) {
                refresh();
            }
        }, {nameWidth: "auto"})
        
        const poseModes = ["DEFAULT", "CURRENT", "TPOSE"];
        this.keyframeGui.addDropdown("Source reference pose", poseModes, poseModes[this.performs.keyframeApp.srcPoseMode], (v) => {
    
            this.performs.keyframeApp.srcPoseMode = poseModes.indexOf(v);
            this.performs.keyframeApp.onChangeAnimation(this.performs.keyframeApp.currentAnimation, true);
            if(refresh) {
                refresh();
            }
        }, {nameWidth: "200px"});

        this.keyframeGui.addDropdown("Character reference pose", poseModes, poseModes[this.performs.keyframeApp.trgPoseMode], (v) => {
            
            this.performs.keyframeApp.trgPoseMode = poseModes.indexOf(v);
            this.performs.keyframeApp.onChangeAnimation(this.performs.keyframeApp.currentAnimation, true);
            if(refresh) {
                refresh();
            }
        }, {nameWidth: "200px"});
    }

    showRecordingDialog(callback) {
        const dialog = new LX.Dialog("Record all animations", p => {

            let assetData = [];
            let animations = this.performs.keyframeApp.loadedAnimations;
            for (let animationName in animations) {
                let animation = animations[animationName];
                animation.record = animation.record === undefined ? true : animation.record;
                let data = {
                    id: animationName,
                    type: "animation",
                    selected: animation.record
                };
                assetData.push(data);
            }
            
            let assetView = new LX.AssetView({ 
                skip_browser: true,
                skip_preview: true,
                layout: LX.AssetView.LAYOUT_LIST,   
                context_menu: false             
            });
            assetView.load( assetData, event => { 
                const item = event.item;
                let animation = animations[item.id];
                animation.record = item.selected;
            }); 

            let panel = new LX.Panel({height: "calc(100% - 40px)"});
            let selectAllCheckbox = panel.addCheckbox("Select All", true, (v, e) => {
                for (let asset in assetData) {
                    assetData[asset].selected = v;
                    animations[assetData[asset].id].record = v;
                }
                assetView._refreshContent();
            });

            selectAllCheckbox.onSetValue(false, false);                       
            
            panel.attach(assetView);
            
            p.attach(panel);
            p.sameLine(2);
            p.addButton("", "Record", () => {
                if (callback) callback();
                dialog.close();
            }, {buttonClass: "accept"});
            p.addButton(null, "Cancel", () => { dialog.close(); })
        }, {size: ["40%", "60%"], resizable: true, draggable: true, scroll: false });

    }
    
    createImportDialog(type, callback) {
        let isAvatar = false;
        const dialog = new LX.Dialog(type + " File Detected!", (panel) => {
            panel.sameLine();
            panel.addButton(null, "Use as Avatar", (v) => { isAvatar = true; dialog.close(); callback(isAvatar); });
            panel.addButton(null, "Use Animations only", (v) => { isAvatar = false; dialog.close(); callback(isAvatar);})
            panel.endLine();
        })
    }

    uploadAvatar(callback = null) {
        let name, model, config;
        let rotation = 0;
        
        let afromFile = true;
        let cfromFile = true;
        this.avatarDialog = new LX.Dialog("Upload Avatar", panel => {

            panel.refresh = () => {
                panel.clear();
                
                let nameWidget = panel.addText("Name Your Avatar", name, (v, e) => {
                    if (this.avatarOptions[v]) LX.popup("This avatar name is taken. Please, change it.", null, { size: ["300px", "auto"], position: ["45%", "20%"]});
                    name = v;
                });

                panel.sameLine();
                let avatarFile = panel.addFile("Avatar File", (v, e) => {
                    let files = panel.widgets["Avatar File"].domEl.children[1].files;
                    if(!files.length) {
                        return;
                    }
                    const path = files[0].name.split(".");
                    const filename = path[0];
                    const extension = path[1];
                    if (extension == "glb" || extension == "gltf") { 
                        model = v;
                        if(!name) {
                            name = filename;
                            nameWidget.set(name)
                        }
                    }
                    else { LX.popup("Only accepts GLB and GLTF formats!"); }
                }, {type: "url", nameWidth: "41%"});

                if(!afromFile) {
                    avatarFile.domEl.classList.add('hidden');
                }

                let avatarURL = panel.addText("Avatar URL", model, (v, e) => {
                    if(v == model) {
                        return;
                    }
                    if(!v) {
                        model = v;
                        return;
                    }

                    const path = v.split(".");
                    let filename = path[path.length-2];
                    filename = filename.split("/");
                    filename = filename.pop();
                    let extension = path[path.length-1];
                    extension = extension.split("?")[0];
                    if (extension == "glb" || extension == "gltf") { 
                        
                        model = v;                             
                        if(!name) {
                            name = filename;
                            nameWidget.set(name)
                        }
                        if(model.includes('models.readyplayer.me')) {
                           
                            const promptD = LX.prompt("It looks like you’re importing an avatar from a Ready Player Me. Would you like to use the default configuration for this character?\nPlease note that the contact settings may vary. We recommend customizing the settings based on the default to better suit your avatar.", 
                                                    "Ready Player Me detected!", (value, event)=> {
                                cfromFile = false;
                                panel.refresh();
                                panel.setValue("Config URL", Performs.AVATARS_URL+"ReadyEva/ReadyEva_v2.json");
                                
                            },{input: false, fitHeight: true})                            
                        }
                    }
                    else { LX.popup("Only accepts GLB and GLTF formats!"); }
                }, {nameWidth: "43%"});
                if(afromFile) {
                    avatarURL.domEl.classList.add('hidden');
                }

                panel.addComboButtons(null, [
                    {
                        value: "From File",
                        callback: (v, e) => {                            
                            afromFile = true;
                            if(!avatarURL.domEl.classList.contains('hidden')) {
                                avatarURL.domEl.classList.add('hidden');          
                            }
                            avatarFile.domEl.classList.remove('hidden');                                                          
                            panel.refresh();
                        }
                    },
                    {
                        value: "From URL",
                        callback: (v, e) => {
                            afromFile = false;
                            if(!avatarFile.domEl.classList.contains('hidden')) {
                                avatarFile.domEl.classList.add('hidden');           
                            }                                               
                            avatarURL.domEl.classList.remove('hidden');          
                        }
                    }
                ], {selected: afromFile ? "From File" : "From URL", width: "170px", minWidth: "0px"});                
                panel.endLine();
            
                panel.sameLine();
                let configFile = panel.addFile("Config File", (v, e) => {
                
                    if(!v) {
                        return;
                    }
                    const filename = panel.widgets["Config File"].domEl.children[1].files[0].name;
                    let extension = filename.split(".");
                    extension = extension.pop();
                    if (extension == "json") { 
                        config = JSON.parse(v); 
                        config._filename = filename; 
                        editConfigBtn.classList.remove('hidden');
                    }
                    else { LX.popup("Config file must be a JSON!"); }
                }, {type: "text", nameWidth: "41%"});
                
                let configURL = panel.addText("Config URL", config ? config._filename : "", async (v, e) => {
                    if(!v) {
                        config = v;
                        return;
                    }
                    const path = v.split(".");
                    let filename = path[path.length-2];
                    filename = filename.split("/");
                    filename = filename.pop();
                    let extension = path[path.length-1];
                    extension = extension.split("?")[0].toLowerCase();
                    if (extension == "json") { 
                        if (extension == "json") { 
                            try {
                                const response = await fetch(v);
                                if (!response.ok) {
                                    throw new Error(`Response status: ${response.status}`);
                                }
                                config = await response.json();                        
                                config._filename = v; 
                                editConfigBtn.classList.remove('hidden');
                            }
                            catch (error) {
                                LX.popup(error.message, "File error!");
                            }
                        }
                    }
                    else { LX.popup("Config file must be a JSON!"); }
                }, {nameWidth: "43%"});

                if(cfromFile) {
                    configURL.domEl.classList.add('hidden');
                }else {
                    configFile.domEl.classList.add('hidden');
                }
                
                const editConfigBtn = panel.addButton(null, "Edit config file", () => {
                    this.performs.openAtelier(name, model, config, true, rotation);

                }, {icon: "fa fa-user-gear", width: "40px"});
                
                if(!config) {
                    editConfigBtn.classList.add('hidden');
                }

                panel.addComboButtons(null, [
                    {
                        value: "From File",
                        callback: (v, e) => {                            
                            cfromFile = true;
                            // panel.refresh();
                            if(!configURL.domEl.classList.contains('hidden')) {
                                configURL.domEl.classList.add('hidden');          
                            }
                            configFile.domEl.classList.remove('hidden');                                                          
                        }
                    },
                    {
                        value: "From URL",
                        callback: (v, e) => {
                            cfromFile = false;
                            // panel.refresh();
                            if(!configFile.domEl.classList.contains('hidden')) {
                                configFile.domEl.classList.add('hidden');           
                            }                                               
                            configURL.domEl.classList.remove('hidden');  
                        }
                    }
                ], {selected: cfromFile ? "From File" : "From URL", width: "170px", minWidth: "0px"});

                panel.endLine();

            panel.addNumber("Apply Rotation", 0, (v) => {
                rotation = v * Math.PI / 180;
            }, { min: -180, max: 180, step: 1 } );
            
            panel.sameLine(2);
            panel.addButton(null, "Create Config File", () => {
                this.performs.openAtelier(name, model, config, true, rotation);
            })
            panel.addButton(null, "Upload", () => {
                if (name && model) {
                    if (this.avatarOptions[name]) { LX.popup("This avatar name is taken. Please, change it.", null, { position: ["45%", "20%"]}); return; }
                    let thumbnail = GUI.THUMBNAIL;
                    if( model.includes('models.readyplayer.me') ) {
                        model+= '?pose=T&morphTargets=ARKit&lod=1';
                        thumbnail =  "https://models.readyplayer.me/" + name + ".png?background=68,68,68";
                    }
                    if (config) {
                        this.avatarOptions[name] = [model, config, rotation, thumbnail];               
                        panel.clear();
                        this.avatarDialog.root.remove();
                        this.avatarOptions[name][1] = config._filename;
                        if (callback) callback(name, config);
                    }
                    else {
                        LX.prompt("Uploading without config file will disable BML animations for this avatar. Do you want to proceed?", "Warning!", (result) => {
                            this.avatarOptions[name] = [model, null, rotation, thumbnail];
                            
                            panel.clear();
                            this.avatarDialog.root.remove();
                            if (callback) callback(name);
                        }, {input: false, on_cancel: () => {}});
                        
                    }
                }
                else {
                    LX.popup("Complete all fields!", null, { position: ["45%", "20%"]});
                }
            });

            panel.root.addEventListener("drop", (v, e) => {

                let files = v.dataTransfer.files;
                this.onDropAvatarFiles(files);
            })
            
        }
        panel.refresh();

        }, { size: ["40%"], closable: true, onclose: (root) => {  root.remove(); }});

        return name;
    }

    editAvatar(name, options = {}) {
        const data = this.performs.currentCharacter;
        const callback = options.callback;
        let config = data.config;
        let rotation = 0;
        
        let fromFile = !config ?? false;
        this.avatarDialog = new LX.Dialog("Edit Avatar", panel => {
          
            panel.refresh = () => {
                panel.clear();                
                let nameWidget = panel.addText("Name Your Avatar", name, (v, e) => {
                    if (this.avatarOptions[v]) LX.popup("This avatar name is taken. Please, change it.", null, { position: ["45%", "20%"]});
                    name = v;
                });

                panel.sameLine();

            let configFile = panel.addFile("Config File", (v, e) => {
                if(!v) {
                    return;
                }
                const filename = panel.widgets["Config File"].domEl.children[1].files[0].name;
                let extension = filename.split(".");
                extension = extension.pop();
                if (extension == "json") { 
                    config = JSON.parse(v); 
                    config._filename = filename; 
                }
                else { LX.popup("Config file must be a JSON!"); }
            }, {type: "text"});

            let configURL = panel.addText("Config URL", config ? config._filename : "", async (v, e) => {
                    
                if(!v) {
                    return;
                }
                const path = v.split(".");
                let filename = path[path.length-2];
                filename = filename.split("/");
                filename = filename.pop();
                let extension = path[path.length-1];
                extension = extension.split("?")[0].toLowerCase();
                    if (extension == "json") { 
                        if (extension == "json") { 
                            try {
                                const response = await fetch(v);
                                if (!response.ok) {
                                    throw new Error(`Response status: ${response.status}`);
                                }
                                config = await response.json();                        
                                config._filename = v; 
                            }
                            catch (error) {
                                LX.popup(error.message, "File error!");
                            }
                        }
                    }
                else { LX.popup("Config file must be a JSON!"); }
            }, {nameWidth: "43%"});

            if(fromFile) {
                configURL.domEl.classList.add('hidden');
            }else {
                configFile.domEl.classList.add('hidden');
            }

            if(config) {
                panel.addButton(null, "Edit config file", () => {
                    this.performs.openAtelier(name, this.avatarOptions[name][0], config, false, rotation);                  
                }, {icon: "fa fa-user-gear", width: "40px"});
            }
            panel.addComboButtons(null, [
                {
                    value: "From File",
                    callback: (v, e) => {                            
                        fromFile = true;
                        // panel.refresh();
                        if(!configURL.domEl.classList.contains('hidden')) {
                            configURL.domEl.classList.add('hidden');          
                        }
                        configFile.domEl.classList.remove('hidden');                                                                                  
                    }
                },
                {
                    value: "From URL",
                    callback: (v, e) => {
                        fromFile = false;
                        // panel.refresh();
                        if(!configFile.domEl.classList.contains('hidden')) {
                            configFile.domEl.classList.add('hidden');           
                        }                                               
                        configURL.domEl.classList.remove('hidden');  
                    }
                }
            ], {selected: fromFile ? "From File" : "From URL", width: "170px", minWidth: "0px"});
            panel.endLine();

            panel.addNumber("Apply Rotation", 0, (v) => {
                rotation = v * Math.PI / 180;
            }, { min: -180, max: 180, step: 1 } );
            
            panel.sameLine(2);
            panel.addButton(null, (config ? "Edit": "Create") + " Config File", () => {
                this.performs.openAtelier(name, this.avatarOptions[name][0], config, false, rotation);                                       
            })
            panel.addButton(null, "Update", () => {
                if (name) {
                
                    if (config) {
                        // this.avatarOptions[name][1] = config._filename;
                        // this.avatarOptions[name][2] = rotation;
                        
                        panel.clear();
                        this.avatarDialog.root.remove();
                        if (callback) callback(name, rotation, config);
                    }
                    else {
                        LX.prompt("Uploading without config file will disable BML animations for this avatar. Do you want to proceed?", "Warning!", (result) => {
                            // this.avatarOptions[name][2] = rotation;
                            panel.clear();
                            this.avatarDialog.root.remove();
                            if (callback) callback(name, rotation);
                        }, {input: false, on_cancel: () => {}});
                        
                    }
                }
                else {
                    LX.popup("Complete all fields!", null, { position: ["45%", "20%"]});
                }
            });

            panel.root.addEventListener("drop", (v, e) => {

                let files = v.dataTransfer.files;
                this.onDropAvatarFiles(files);
            })
            
        }
        panel.refresh();

        }, { size: ["40%"], closable: true, onclose: (root) => {  root.remove(); }});

        return name;
    }

    onDropFiles(e) {        
        e.preventDefault();
        e.stopPropagation();
        
        let animations = [];
        let config = null;
        let gltfs = [];
        let bml = null;

        // Supported formats
        const formats = ['json', 'bvh', 'bvhe', 'glb', 'gltf', 'fbx', 'bml', 'sigml'];
        
        // Parse file formats
        let files = e.dataTransfer.files;
        for(let i = 0; i < files.length; i++) {
   
            const file = files[i];
            const extension = file.name.substr(file.name.lastIndexOf(".") + 1).toLowerCase();
            if(formats.indexOf(extension) < 0) {
                alert(file.name +": Format not supported.\n\nFormats accepted:\n\t 'bml', 'sigml', 'bvh', 'bvhe', 'glb, 'gltf', 'json', 'fbx' (animations only)\n\t");
                $("#loading").fadeOut();
                return;
            }

            if(extension == 'gltf' || extension == 'glb') {
                gltfs.push(file);
            }
            else if(extension == 'json') {
                config = file;
            }
            else if(extension == 'bml' ||extension == 'sigml') {
                bml = file;
            }
            else {
                animations.push(file);
            }
        }

        if(gltfs.length) {
            this.createImportDialog('.glb', (isAvatar) => {
                if(isAvatar) {
                    this.uploadAvatar((value, config) => {
                
                        if ( !this.performs.loadedCharacters[value] ) {
                            $('#loading').fadeIn(); //hide();
                            let modelFilePath = this.avatarOptions[value][0]; 
                            let configFilePath = this.avatarOptions[value][1]; 
                            let modelRotation = (new THREE.Quaternion()).setFromAxisAngle( new THREE.Vector3(1,0,0), this.avatarOptions[value][2] ); 
                            this.performs.loadAvatar(modelFilePath, config || configFilePath, modelRotation, value, ()=>{ 
                                this.performs.changeAvatar(value);
                                this.createAvatarsPanel();
                                if(this.performs.currentCharacter.config) {
                                    this.performs.changeMode(Performs.Modes.SCRIPT);
                                    
                                    const resetBtn = this.mainArea.sections[0].panels[2].root.querySelector("button[title='Reset pose']");
                                    if(resetBtn) {
                                        resetBtn.classList.remove("hidden");
                                    }
                                }
                                $('#loading').fadeOut();
                            }, (err) => {
                                $('#loading').fadeOut();
                                LX.popup("There was an error loading the avatar", "Avatar not loaded", {width: "30%"});
                            } );
                            return;
                        } 
        
                        // use controller if it has been already loaded in the past
                        this.performs.changeAvatar(value);
                        this.createAvatarsPanel();
                    });
                    
                    // Create a data transfer object
                    let dataTransfer = new DataTransfer();
                    // Add file to the file list of the object
                    dataTransfer.items.add(gltfs[0]);
                    // Save the file list to a new variable
                    const fileList = dataTransfer.files;
                    this.avatarDialog.panel.widgets["Avatar File"].domEl.children[1].files = fileList;
                    this.avatarDialog.panel.widgets["Avatar File"].domEl.children[1].dispatchEvent(new Event('change'), { bubbles: true });
                    
                    if (config) { 
                        // Create a data transfer object
                        dataTransfer = new DataTransfer();
                        // Add file to the file list of the object
                        dataTransfer.items.add(config);
                        // Save the file list to a new variable
                        const fileList = dataTransfer.files;
                        this.avatarDialog.panel.widgets["Config File"].domEl.children[1].files = fileList;
                        this.avatarDialog.panel.widgets["Config File"].domEl.children[1].dispatchEvent(new Event('change'), { bubbles: true });    
                    }
                }
                else {
                    $("#loading").fadeIn();
                    this.performs.keyframeApp.loadFiles(gltfs, (files) => {
                        $("#loading").fadeOut();
                        if(files.length) {
                            this.performs.changeMode(Performs.Modes.KEYFRAME);
                            this.createSettingsPanel();
                        }
                        else {
                            LX.popup("This file doesn't contain any animation or a valid source avatar!");
                        }
                    });    
                }
            });            
        }
        else if(config) {
            let name = this.performs.currentCharacter.model.name;
            const reader = new FileReader();
            reader.readAsText( config );
            reader.onload = (event) => {
                const data = JSON.parse(event.currentTarget.result);
                if(data.boneMap) {
                    this.avatarOptions[name][1] = config._filename;
                    this.performs.currentCharacter.config = data;
                    this.performs.scriptApp.onLoadAvatar(this.performs.currentCharacter.model, this.performs.currentCharacter.config, this.performs.currentCharacter.skeleton);
                    this.performs.currentCharacter.skeleton.pose();
                    this.performs.scriptApp.ECAcontroller.reset();                        
                    this.performs.changeMode(Performs.Modes.SCRIPT);
                    if(this.settingsActive) {
                        this.createSettingsPanel();             
                    }
                }
                else {
                    this.performs.setConfiguration(data, () => {
                        if(this.settingsActive) {
                            this.createSettingsPanel();             
                        }
                    });
                }
            }                
        }

        if(bml) {
            if(config || this.performs.currentCharacter.config) {
                const extension = bml.name.substr(bml.name.lastIndexOf(".") + 1).toLowerCase();
                const reader = new FileReader();
                reader.readAsText( bml );
                reader.onload = (event) => {
                    const data = event.currentTarget.result;
                    this.performs.scriptApp.onMessage([{type: extension, data: data}], (result) => {
                        if(extension == 'sigml') {
                            this.setSIGMLInputText( data );
                        }
                        if(extension == 'bml' || extension == 'sigml') {
                            this.setBMLInputText( 
                                JSON.stringify(result.msg.data, function(key, val) {
                                    return val.toFixed ? Number(val.toFixed(3)) : val;
                                }) 
                            );
                        }
                        
                    });
                }
            }
            else {
                alert("To use the Script mode, the current character's configuration file is needed.")
            }
        }
        if(animations.length) {
            $("#loading").fadeIn();
            this.performs.keyframeApp.loadFiles(animations, (files) => {
                $("#loading").fadeOut();
                if(files.length) {
                    this.performs.changeMode(Performs.Modes.KEYFRAME);
                    this.createSettingsPanel();
                }
                else {
                    LX.popup("This file doesn't contain any animation or a valid source avatar!");
                }
            });      
        }
    }

    onDropAvatarFiles(files) {
        if(!files.length) {
            return;
        }
        for(let i = 0; i < files.length; i++) {

            const path = files[i].name.split(".");
            const filename = path[0];
            const extension = path[1];
            if (extension == "glb" || extension == "gltf") { 
                // Create a data transfer object
                const dataTransfer = new DataTransfer();
                // Add file to the file list of the object
                dataTransfer.items.add(files[i]);
                // Save the file list to a new variable
                const fileList = dataTransfer.files;

                this.avatarDialog.panel.widgets["Avatar File"].domEl.children[1].files = fileList;
                this.avatarDialog.panel.widgets["Avatar File"].domEl.children[1].dispatchEvent(new Event('change'), { bubbles: true });                
            }
            else if (extension == "json") { 
                // Create a data transfer object
                const dataTransfer = new DataTransfer();
                // Add file to the file list of the object
                dataTransfer.items.add(files[i]);
                // Save the file list to a new variable
                const fileList = dataTransfer.files;
                this.avatarDialog.panel.widgets["Config File"].domEl.children[1].files = fileList;
                this.avatarDialog.panel.widgets["Config File"].domEl.children[1].dispatchEvent(new Event('change'), { bubbles: true });
            }
        }
    }

    setBMLInputText( text ){
        this.bmlInputData.prevInstanceText = text;
        if ( this.bmlInputData.codeObj ){ this.bmlInputData.codeObj.setText( text ); }
    }

    setSIGMLInputText( text ){
        this.sigmlInputData.prevInstanceText = text;
        if ( this.sigmlInputData.codeObj ){ this.sigmlInputData.codeObj.setText( text ); }
    }

    _stringToBML( str ){
        // let text = this.bmlInputData.codeObj.getText().replaceAll("\n", "").replaceAll("\r", "");
        let result = [];
        let text = str.replaceAll("\n", "").replaceAll("\r", "");
        let parseSuccess = false;
        // JSON
        try {
            result = JSON.parse( text );
            parseSuccess = true;
        } catch (error ) { parseSuccess = false; }
        if ( !parseSuccess ){
            try{ 
                result = JSON.parse( "[" + text + "]" );
            }
            catch( error ){
                alert( "Invalid bml message. Check for errors such as proper quoting (\") of words or commas after each instruction (except the last one) and attribute." );
                return [];
            }       
        }

        if ( !Array.isArray( result ) ){
                if ( Array.isArray( result.behaviours ) ){ result = result.behaviours; }
                else{ result = [ result ]; }
        } 

        // for mouthing, find those words that need to be translated into phonemes (ARPA)
        for( let i = 0; i < result.length; ++i ){
            if ( result[i].type == "speech" && typeof( result[i].text ) == "string" ){
                let strSplit = result[i].text.split( "%" ); // words in NGT are between "%"
                let resultSpeechtext = "";
                for( let j = 0; j < strSplit.length; ){
                    resultSpeechtext += strSplit[j]; // everything before are phonemes
                    j++;
                    if ( j < ( strSplit.length - 1 ) ){ // word to translate
                        resultSpeechtext += this.performs.scriptApp.wordsToArpa( strSplit[j], "NGT" );
                    }
                    j++;
                }
                result[i].text = resultSpeechtext + ".";
            }
        }

        return result;
    }

    showCaptureModal(capture) {

        if(!capture) {
            return;
        }
        $("#loading p").text( "Capturing animation: " + capture);
		$("#loading").removeClass("hidden");
		$("#loading").css({ background: "rgba(17,17,17," + 0.5 + ")" })
		$("#loading").fadeIn();
       
    }

    hideCaptureModal() {
        $("#loading").addClass("hidden");
    }

    showGuide() {
        const modal = document.getElementById("guide-modal");
        modal.classList.remove('hidden');
        const modals = document.querySelectorAll('.guide-modal .container');
        
        const innerChange = (id) => {
            modals.forEach(modalContent => {
                modalContent.classList.remove('show');
                modalContent.classList.add('hidden');
                if (modalContent.id === id) {
                    modalContent.classList.add('show');
                    modalContent.classList.remove('hidden');
                }
            });            
        }
        innerChange("modal0");
        for(let i = 0; i < modals.length; i++) {
            const modalContent = modals[i];
            const buttons = modalContent.getElementsByTagName('button');
            for(let j = 0; j < buttons.length; j++) {
                const btn = buttons[j];
                if(btn.innerText == "Back") {
                    btn.addEventListener("click", () => {
                        innerChange("modal" + (i-1).toString())
                    })
                }
                else if(btn.innerText == "Next") {
                    btn.addEventListener("click", () => {
                        innerChange("modal" + (i+1).toString())
                    })
                }
                else {
                    btn.addEventListener("click", () => {
                        modal.classList.add('hidden');
                    });
                }
            }
            const span = modalContent.getElementsByTagName('span')[0];
            span.addEventListener("click", () => {
                modal.classList.add('hidden');
            });
        }

    }

    showExportDialog(callback) {

        // Avatar URL
        const currentCharacterInfo = this.avatarOptions[this.performs.currentCharacter.model.name];
        let avatar = currentCharacterInfo[0];
        avatar = avatar.split('?')[0];
        
        // Background color
        let color = this.performs.getBackPlaneColour();
        if(typeof(color) == 'string') {
            color = color.replace("#", "0x");
        }

        // Background type 
        const backgrounds = Object.keys(Performs.Backgrounds);
        
        // Photocall image
        let img = this.performs.logo;
        if(typeof(img) != 'string') {
            img = img.src;
        }

        const toExport = {
            avatar      : {state: localStorage.getItem("avatar") != undefined ? JSON.parse(localStorage.getItem("avatar")) : avatar.includes('https'), text: "Character file URL", value: avatar},
            cloth       : {state: localStorage.getItem("cloth") != undefined ? JSON.parse(localStorage.getItem("cloth")) : false, text: "Top cloth color value", value: "0x" + this.performs.getClothesColour()},
            color       : {state: localStorage.getItem("color") != undefined ? JSON.parse(localStorage.getItem("color")) : true, text: "Background color", value: color},
            background  : {state: localStorage.getItem("background") != undefined ? JSON.parse(localStorage.getItem("background")) : true, text: "Background design", value: backgrounds[this.performs.background]},
            img         : {state: localStorage.getItem("img") != undefined ? JSON.parse(localStorage.getItem("img")) : false, text: "Logo/image file URL for photocall", value: img},
            offset      : {state: localStorage.getItem("offset") != undefined ? JSON.parse(localStorage.getItem("offset")) : false, text: "Logo space repetition", value: this.performs.repeatOffset},
            light       : {state: localStorage.getItem("light") != undefined ? JSON.parse(localStorage.getItem("light")) : false, text: "Light color", value: "0x" + this.performs.dirLight.color.getHexString()},
            lightpos    : {state: localStorage.getItem("lightpos") != undefined ? JSON.parse(localStorage.getItem("lightpos")) : false, text: "Light position", value: this.performs.dirLight.position.x + ',' + this.performs.dirLight.position.y + ',' + this.performs.dirLight.position.z},
            restrictView: {state: localStorage.getItem("restrictView") != undefined ? JSON.parse(localStorage.getItem("restrictView")) : false, text: "Restrict camera controls", value: !this.performs.cameraMode ?? false},
            controls    : {state: localStorage.getItem("controls") != undefined ? JSON.parse(localStorage.getItem("controls")) : false, text: "Show GUI controls", value: this.performs.showControls},
            autoplay    : {state: localStorage.getItem("autplay") != undefined ? JSON.parse(localStorage.getItem("autoplay")) : false, text: "Play animation automatically after load it", value: this.performs.autoplay},
        }

        const toExportScript = {
            config      : {state: localStorage.getItem("config") != undefined ? JSON.parse(localStorage.getItem("config")) : (currentCharacterInfo[1] ?? false), text: "Configuration file URL", value: currentCharacterInfo[1]},
            applyIdle   : {state: localStorage.getItem("applyIdle") != undefined ? JSON.parse(localStorage.getItem("applyIdle")) : (currentCharacterInfo[1] ?? false), text: "Apply idle animation", value: this.performs.scriptApp.applyIdle},
        }

        let hasAnimations = this.performs.keyframeApp.currentAnimation ?? false;
        const toExportKeyframe = {
            srcEmbeddedTransforms      : {state: localStorage.getItem("srcEmbeddedTransforms") != undefined ? JSON.parse(localStorage.getItem("srcEmbeddedTransforms")) : hasAnimations, text: "Source embedded transformations", value: this.performs.keyframeApp.srcEmbedWorldTransforms},
            trgEmbeddedTransforms      : {state: localStorage.getItem("trgEmbeddedTransforms") != undefined ? JSON.parse(localStorage.getItem("trgEmbeddedTransforms")) : hasAnimations, text: "Target embedded transformations", value: this.performs.keyframeApp.trgEmbedWorldTransforms},
            srcReferencePose           : {state: localStorage.getItem("srcReferencePose") != undefined ? JSON.parse(localStorage.getItem("srcReferencePose")) : hasAnimations, text: "Source reference pose", value: this.performs.keyframeApp.srcPoseMode},
            trgReferencePose           : {state: localStorage.getItem("trgReferencePose") != undefined ? JSON.parse(localStorage.getItem("trgReferencePose")) : hasAnimations, text: "Target reference pose", value: this.performs.keyframeApp.trgPoseMode},
            crossfade                  : {state: localStorage.getItem("crossfade") != undefined ? JSON.parse(localStorage.getItem("crossfade")) : hasAnimations, text: "Concatenate and blend animations", value: this.performs.keyframeApp.useCrossFade},
            blendTime                  : {state: localStorage.getItem("blendTime") != undefined ? JSON.parse(localStorage.getItem("blendTime")) : hasAnimations, text: "Time interval between animations", value: this.performs.keyframeApp.blendTime},
        }

        const toExportTransform = {
            position: {state: localStorage.getItem("position") != undefined ? JSON.parse(localStorage.getItem("position")) : false, text: "Character position", value: this.performs.currentCharacter.model.position.x + ',' + this.performs.currentCharacter.model.position.y + ',' + this.performs.currentCharacter.model.position.z},
            rotation: {state: localStorage.getItem("rotation") != undefined ? JSON.parse(localStorage.getItem("rotation")) : false, text: "Character rotation", value: this.performs.currentCharacter.model.quaternion.x + ',' + this.performs.currentCharacter.model.quaternion.y + ',' + this.performs.currentCharacter.model.quaternion.z + ',' + this.performs.currentCharacter.model.quaternion.w},
            scale:    {state: localStorage.getItem("scale") != undefined ? JSON.parse(localStorage.getItem("scale")) : false, text: "Character scale", value: this.performs.currentCharacter.model.scale.x}
        }

        const dialog = new LX.Dialog("Export configuration", p => {
            
            p.sameLine();
            p.addButton("Select the configuration settings you want to export.", 'More info...', (v) => {
                window.open('https://github.com/upf-gti/performs/blob/main/docs/IntegrationGuide.md', '_blank');
            }, {nameWidth: "80%"})
            p.endLine();
            let url = new URL(window.location.origin + window.location.pathname);

            let pp = new LX.Panel({height:'auto'});
            pp.refresh = () => {
                pp.clear();
                pp.sameLine();
                pp.addTextArea("Iframe", url.toJSON(), null, {nameWidth: "80px", fitHeight: true, disabled:true, className: "iframe-text"});                
                pp.addButton(null, 'Copy', (value, event) => {
    
                    navigator.clipboard.writeText(url);
                    const bubble = document.getElementById('bubble');
                    
                    // Get the bounding rect of button                    
                    const rect = event.target.getBoundingClientRect();
                    // Set the bubble position
                    bubble.style.left = `${rect.left - 20}px`//`${x - 25}px`;
                    bubble.style.top = `${rect.top - 35}px`//`${y - bubble.offsetHeight - 35}px`; // Position above the mouse click
                    bubble.classList.add('show');
                    
                    setTimeout(function() {
                        bubble.classList.remove('show');
                    }, 2000); // Bubble will show for 2 seconds
                }, {icon:'fa fa-clipboard', width:"40px"})
                pp.endLine();
            }
            
            let tabsPanel = new LX.Area({height: 'auto'});
            let tabs = tabsPanel.addTabs();

            let panel = new LX.Panel({height:'auto'});
            let spanel = new LX.Panel({height:'auto'});
            let kpanel = new LX.Panel({height:'auto'});
            let tpanel = new LX.Panel({height:'auto'});
            
            // Customizaiton options
            let tabPanel = new LX.Panel({height:'auto'});            
            tabPanel.addCheckbox("Select All", false, (v, e) => {
                for(let key in toExport) {                    
                    toExport[key].state = v;
                    localStorage.setItem(key, v);               
                }
                panel.refresh();
            });
            tabPanel.addSeparator();
            
            panel.refresh = () => {
                panel.clear();               
                for(let key in toExport) {
                    url.searchParams.delete(key);
                    panel.sameLine();
                    panel.addCheckbox(key, toExport[key].state, (v, e) => {
                        localStorage.setItem(key, v);
                        toExport[key].state = v;
                        panel.refresh();
                    })
                    panel.addText(null, toExport[key].text, null, {disabled: true});
                    panel.endLine();
                }
                if(toExport.avatar.state) {
                    url.searchParams.append('avatar', toExport.avatar.value);
                }               
                if(toExport.cloth.state) {
                    url.searchParams.append('cloth', toExport.cloth.value);
                }
                if(toExport.color.state) {                    
                    url.searchParams.append('color', toExport.color.value);
                }
                if(toExport.background.state) {                    
                    url.searchParams.append('background', toExport.background.value);
                }
                if(toExport.img.state) {                    
                    url.searchParams.append('img', toExport.img.value);
                }
                if(toExport.offset.state) {
                    url.searchParams.append('offset', toExport.offset.value);
                }
                if(toExport.light.state) {
                    url.searchParams.append('light', toExport.light.value);
                }
                if(toExport.lightpos.state) {
                    url.searchParams.append('lightpos', toExport.lightpos.value);
                }
                if(toExport.restrictView.state) {
                    url.searchParams.append('restrictView', toExport.restrictView.value);
                }
                if(toExport.controls.state) {
                    url.searchParams.append('controls', toExport.controls.value);
                }
                if(toExport.autoplay.state) {
                    url.searchParams.append('autoplay', toExport.autoplay.value);
                }
                
                panel.addSeparator();                
                pp.refresh();
            };
            panel.refresh();
            tabPanel.root.appendChild(panel.root);
            tabs.add("Customization", tabPanel.root, () => panel.refresh());

            // Scrip mode idle options
            tabPanel = new LX.Panel({height:'auto'});     
            tabPanel.addCheckbox("Select All", toExportScript.config.state, (v, e) => {
                for(let key in toExportScript) {                    
                    toExportScript[key].state = v;
                    localStorage.setItem(key, v);               
                }
                spanel.refresh();
            });
            tabPanel.addSeparator();

            spanel.refresh = () => {
                spanel.clear();
                for(let key in toExportScript) {
                    url.searchParams.delete(key);
                    spanel.sameLine();
                    spanel.addCheckbox(key, toExportScript[key].state, (v, e) => {
                        toExportScript[key].state = v;
                        localStorage.setItem(key, v);
                        spanel.refresh();
                    })
                    spanel.addText(null, toExportScript[key].text, null, {disabled: true});
                    spanel.endLine();
                }

                if(toExportScript.config.state && currentCharacterInfo[1]) {
                    url.searchParams.append('config', toExportScript.config.value);
                }
                if(toExportScript.applyIdle.state) {
                    url.searchParams.append('applyIdle', toExportScript.applyIdle.value);
                }
                pp.refresh();
            }
            spanel.refresh();
            tabPanel.root.appendChild(spanel.root);
            tabs.add("Script mode", tabPanel.root, () => spanel.refresh());

            // Keyframe mode options
            tabPanel = new LX.Panel({height:'auto'});     
            tabPanel.addCheckbox("Select All", hasAnimations, (v, e) => {
                for(let key in toExportKeyframe) {                    
                    toExportKeyframe[key].state = v;
                    localStorage.setItem(key, v);
                }
                kpanel.refresh();
            });
            tabPanel.addSeparator();

            kpanel.refresh = () => {
                kpanel.clear();
                for(let key in toExportKeyframe) {
                    url.searchParams.delete(key);

                    kpanel.sameLine();
                    kpanel.addCheckbox(key, toExportKeyframe[key].state, (v, e) => {
                        toExportKeyframe[key].state = v;
                        localStorage.setItem(key, v);
                        kpanel.refresh();
                    })
                    kpanel.addText(null, toExportKeyframe[key].text, null, {disabled: true, nameWidth:"100px"});
                    kpanel.endLine();
                }

                if(toExportKeyframe.srcEmbeddedTransforms.state) {
                    url.searchParams.append('srcEmbeddedTransforms', toExportKeyframe.srcEmbeddedTransforms.value);
                }
                if(toExportKeyframe.trgEmbeddedTransforms.state) {
                    url.searchParams.append('trgEmbeddedTransforms', toExportKeyframe.trgEmbeddedTransforms.value);
                }
                if(toExportKeyframe.srcReferencePose.state) {
                    url.searchParams.append('srcReferencePose', toExportKeyframe.srcReferencePose.value);
                }
                if(toExportKeyframe.trgReferencePose.state) {
                    url.searchParams.append('trgReferencePose', toExportKeyframe.trgReferencePose.value);
                }
                if(toExportKeyframe.crossfade.state) {
                    url.searchParams.append('crossfade', toExportKeyframe.crossfade.value);
                }
                if(toExportKeyframe.blendTime.state) {
                    url.searchParams.append('blendTime', toExportKeyframe.blendTime.value);
                }
                pp.refresh();
            }
            kpanel.refresh();
            tabPanel.root.appendChild(kpanel.root);
            tabs.add("Keyframe mode", tabPanel.root, () => kpanel.refresh());

            // Transforms mode options
            tabPanel = new LX.Panel({height:'auto'});     
            tabPanel.addCheckbox("Select All", false, (v, e) => {
                for(let key in toExportTransform) {                    
                    toExportTransform[key].state = v;
                    localStorage.setItem(key, v);
                }
                tpanel.refresh();
            });
            tabPanel.addSeparator();

            tpanel.refresh = () => {
                tpanel.clear();
                for(let key in toExportTransform) {
                    url.searchParams.delete(key);

                    tpanel.sameLine();
                    tpanel.addCheckbox(key, toExportTransform[key].state, (v, e) => {
                        toExportTransform[key].state = v;
                        localStorage.setItem(key, v);
                        tpanel.refresh();
                    })
                    tpanel.addText(null, toExportTransform[key].text, null, {disabled: true, nameWidth:"100px"});
                    tpanel.endLine();
                }

                if(toExportTransform.position.state) {
                    url.searchParams.append('position', toExportTransform.position.value);
                }
                if(toExportTransform.rotation.state) {
                    url.searchParams.append('rotation', toExportTransform.rotation.value);
                }
                if(toExportTransform.scale.state) {
                    url.searchParams.append('scale', toExportTransform.scale.value);
                }                
                pp.refresh();
            }
            tpanel.refresh();
            tabPanel.root.appendChild(tpanel.root);
            tabs.add("Transforms", tabPanel.root, () => tpanel.refresh());
              
            p.root.appendChild(tabsPanel.root);
            pp.refresh();
            p.root.appendChild(pp.root);        

            p.addButton(null, "Download configuration as file (.json)", () => {

                let json = {};
                for(let key in toExport) {
                    if(toExport[key].state) {
                        json[key] = toExport[key].value;
                    }
                }
                for(let key in toExportTransform) {
                    if(toExportTransform[key].state) {
                        json[key] = toExportTransform[key].value;
                    }
                }
                for(let key in toExportScript) {
                    if(toExportScript[key].state) {
                        json[key] = toExportScript[key].value;
                    }
                }
                for(let key in toExportKeyframe) {
                    if(toExportKeyframe[key].state) {
                        json[key] = toExportKeyframe[key].value;
                    }
                }
                const data = JSON.stringify(json);
                let a = document.createElement('a'); 
                // Then trigger the download link
                a.href = "data:text/json;charset=utf-8," + encodeURIComponent(data);
                a.download = "performsSettings.json";
                a.click();
              
                if (callback) {
                    callback();
                }
                dialog.close();
            }, {buttonClass: "accept", width: "auto"});

        }, {size: ["40%", "auto"], resizable: true, draggable: true, scroll: true });

    }
}

export { GUI };

LX.setThemeColor("global-selected", "#6200EA");
LX.setThemeColor("global-selected-light", "#bb86fc");
LX.setThemeColor("global-selected-dark", "#a100ff");
