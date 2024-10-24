import * as THREE from "three"
import { LX } from 'lexgui';
import 'lexgui/components/codeeditor.js';
import { App } from './App.js'

class AppGUI {

    static THUMBNAIL = "data/imgs/monster.png";
    constructor( app ){
        this.app = app;
        this.randomSignAmount = 0;
        // available model models paths - [model, config, rotation]
        this.avatarOptions = {
            "EvaLow": ['https://webglstudio.org/3Dcharacters/Eva_Low/Eva_Low.glb', 'https://webglstudio.org/3Dcharacters/Eva_Low/Eva_Low.json', 0, 'https://webglstudio.org/3Dcharacters/Eva_Low/Eva_Low.png'],
            "Witch": ['https://webglstudio.org/3Dcharacters/Eva_Witch/Eva_Witch.glb', 'https://webglstudio.org/3Dcharacters/Eva_Witch/Eva_Witch.json', 0, 'https://webglstudio.org/3Dcharacters/Eva_Witch/Eva_Witch.png'],
            "Kevin": ['https://webglstudio.org/3Dcharacters/Kevin/Kevin.glb', 'https://webglstudio.org/3Dcharacters/Kevin/Kevin.json', 0, 'https://webglstudio.org/3Dcharacters/Kevin/Kevin.png'],
            "Ada": ['https://webglstudio.org/3Dcharacters/Ada/Ada.glb', 'https://webglstudio.org/3Dcharacters/Ada/Ada.json',0, 'https://webglstudio.org/3Dcharacters/Ada/Ada.png']
        }

        // take canvas from dom, detach from dom, attach to lexgui 
        this.app.renderer.domElement.remove(); // removes from dom
        this.mainArea = LX.init();
        this.mainArea.root.ondrop = (e) => {
			e.preventDefault();
			e.stopPropagation();
            $("#loading").fadeIn();
			this.app.loadFiles(e.dataTransfer.files, (files) => {
                $("#loading").fadeOut();
                if(files.length) {
                    // this.gui.refresh(); 
                    this.createSettingsPanel();
                }
                else {
                    LX.popup("This file doesn't contain any animation or a valid source avatar!");
                }
            });      
        };
        this.mainArea.onresize = (bounding) => app.onCanvasResize(bounding.width, bounding.height);
        this.bmlInputData = { openButton: null, dialog: null, codeObj: null, prevInstanceText: "" };
        this.sigmlInputData = { openButton: null, dialog: null, codeObj: null, prevInstanceText:"" };
        this.glossInputData = { openButton: null, dialog: null, textArea: null,  glosses: "" };

        this.gui = null;
        
        const [canvasArea, panelArea] = this.mainArea.split({type:"horizontal", sizes: ["88%", "12%"], minimizable: true});
        canvasArea.attach( this.app.renderer.domElement );
        canvasArea.onresize = (bounding) => this.resize(bounding.width, bounding.height);
        canvasArea.root.appendChild(app.renderer.domElement);

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
            this.app.bmlApp.msg = text ? JSON.parse( text ) : null;
            text = window.sessionStorage.getItem( "bmlInput" ); 
            this.bmlInputData.prevInstanceText = text ? text : "";
            text = window.sessionStorage.getItem( "sigmlInput" ); 
            this.sigmlInputData.prevInstanceText = text ? text : "";
            text = window.sessionStorage.getItem( "glossInput" ); 
            this.glossInputData.glosses = text ? text : "";
            
            window.addEventListener("beforeunload", (event) => {
                // event.returnValue = "\\o/";
                window.sessionStorage.setItem( "msg", JSON.stringify(this.app.bmlApp.msg) );
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
                    if(this.app.mode == App.Modes.KEYFRAME) {
                        if(Object.keys(this.app.keyframeApp.loadedAnimations).length) {
                            this.app.keyframeApp.changePlayState();
                            if(this.settingsActive) {
                                this.createSettingsPanel();             
                            }
                            this.changePlayButtons(this.app.keyframeApp.playing);
                        }
                        else {
                            LX.popup("No animations to play!", null, {size:["200px", "auto"]})
                        }
                    }
                    else if (this.app.mode == App.Modes.SCRIPT) {
                        this.app.bmlApp.replay();
                        if(this.settingsActive) {
                            this.createSettingsPanel();             
                        }
                        //this.changePlayButtons(this.playing);                        
                    }
                }
            });
        }

        this.playing = false;
        this.captureEnabled = false;

        this.createIcons(canvasArea);
        // this.createPanel();
        // this.gui.root.classList.add('hidden');

    }

    resize(width, height) {
        
        const aspect = width / height;
        for(let i = 0; i < this.app.cameras.length; i++) {
            this.app.cameras[i].aspect = aspect;
            this.app.cameras[i].updateProjectionMatrix();
        }
        this.app.renderer.setSize(width, height);
    }

    refresh(){
        // this.gui.refresh();
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
            if (this.app.currentCharacter.config) {
                this.app.changeMode(App.Modes.SCRIPT);
                if(this.app.bmlApp.currentIdle) {
                    this.app.bmlApp.bindAnimationToCharacter(this.app.bmlApp.currentIdle, this.app.currentCharacter.model.name);
                }
            }
            else {
                this.app.changeMode(-1);   
            }
            this.createSettingsPanel();
            const resetBtn = this.mainArea.sections[0].panels[2].root.querySelector("button[title='Reset pose']");
            if(resetBtn) {
                resetBtn.classList.remove("hidden");
            }

        }, {icon: "fa fa-code"} );

        if(this.app.mode == App.Modes.SCRIPT || this.app.mode == -1) {
            btn.children[0].classList.add("selected");
        }
        btn = p.addButton(null, "Keyframing animation",  (v, e) => {
            this.app.changeMode(App.Modes.KEYFRAME);
            this.createSettingsPanel(); 
            
            const resetBtn = this.mainArea.sections[0].panels[2].root.querySelector("button[title='Reset pose']");
            if(resetBtn) {
                resetBtn.classList.add("hidden");
            }
        }, {icon: "fa fa-film"} );
        
        if(this.app.mode == App.Modes.KEYFRAME) {
            btn.children[0].classList.add("selected");
        }

        p.endLine();
        p.sameLine();
        p.addText(null, "Script animation", null, {disabled: true});
        p.addText(null, "Clip animation", null, {disabled: true});
        p.endLine();

        p.addSeparator();

        if(!force) {
            if(this.app.mode == App.Modes.SCRIPT || this.app.mode == -1) {
                this.createBMLPanel(p, this.createSettingsPanel.bind(this));
            }
            else {
                this.createKeyframePanel(p, this.createSettingsPanel.bind(this));
            }
        }

        p.branch( "Transformations", { icon: "fa-solid fa-up-down-left-right", closed: !this.branchesOpened["Transformations"]} );

        const model = this.app.currentCharacter.model;
        p.addVector3("Position", [model.position.x, model.position.y, model.position.z], (value, event) => {
            model.position.set(value[0], value[1], value[2]);
        }, {step:0.01});
        p.addVector3("Rotation", [THREE.MathUtils.radToDeg(model.rotation.x), THREE.MathUtils.radToDeg(model.rotation.y), THREE.MathUtils.radToDeg(model.rotation.z)], (value, event) => {
            model.rotation.set(THREE.MathUtils.degToRad(value[0]), THREE.MathUtils.degToRad(value[1]), THREE.MathUtils.degToRad(value[2]));
        }, {step:0.01});
        p.addNumber("Scale", model.scale.x, (value, event) => {
            model.scale.set(value, value, value);
        }, {step:0.01});      
    }

    createBackgroundsPanel() {

        const p = this.panel;
        if(p.getBranch("Backgrounds")) {
            this.branchesOpened["Backgrounds"] = !p.getBranch("Backgrounds").content.parentElement.classList.contains("closed");
        }
        p.clear();
        p.branch("Backgrounds");
        let color = new THREE.Color(this.app.sceneColor);

        p.addColor("Color", "#" + color.getHexString(), (value, event) => {
            this.app.setBackPlaneColour(value);
        });
        
        // Open space
        let btn = p.addButton(null, "Open space", (value)=> {
            this.app.setBackground( App.Backgrounds.OPEN);
            this.createBackgroundsPanel();
        }, {img: "./data/imgs/open-space.png", className: "centered"});
        btn.children[0].classList.add("roundedbtn");
        if(this.app.background == App.Backgrounds.OPEN) {
            btn.children[0].classList.add('selected');
        }

        // Studio background
        btn = p.addButton(null, "Studio", (value)=> {
            this.app.setBackground( App.Backgrounds.STUDIO);
            this.createBackgroundsPanel();
        }, {img: "./data/imgs/studio-space.png", className: "centered"});
        btn.children[0].classList.add("roundedbtn");
        if(this.app.background == App.Backgrounds.STUDIO) {
            btn.children[0].classList.add('selected');
        }
        // Photocall background
        btn = p.addButton(null, "Photocall", (value)=> {
            this.app.setBackground( App.Backgrounds.PHOTOCALL);
            this.createBackgroundsPanel();
        }, {img: "./data/imgs/photocall-space.png", className: "centered"});
        btn.children[0].classList.add("roundedbtn");
        
        if(this.app.background == App.Backgrounds.PHOTOCALL) {
            btn.children[0].classList.add('selected');
            const ebtn = p.addButton(null, "Edit logo", (e) => {
                let dialog = new LX.Dialog("Upload logo", (panel) => {
                    let formFile = true;
                    panel.sameLine();
                    let logoFile = panel.addFile("File", (v, e) => {
                        let files = panel.widgets["File"].domEl.children[1].files;
                        if(!files.length) {
                            return;
                        }
                        const path = files[0].name.split(".");
                        const filename = path[0];
                        const extension = path[1];
                        if (extension == "png" || extension == "jpeg" || extension == "jpg") { 
                             const imgCallback = ( event ) => {

                                this.app.logo = event.target;        
                                this.app.setBackground( App.Backgrounds.PHOTOCALL, this.app.logo);            
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
                        if (extension == "png" || extension == "jpeg" || extension == "jpg") {
                            const imgCallback = ( event ) => {

                                this.app.logo = event.target;        
                                this.app.setBackground( App.Backgrounds.PHOTOCALL, this.app.logo);            
                            }
            
                            const img = new Image();            
                            img.onload = imgCallback;            
                            img.src = v;

                        }
                        else { LX.popup("Only accepts PNG, JPEG and JPG formats!"); }
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

                    panel.addNumber("Offset", this.app.repeatOffset, (v) => {
                        this.app.changePhotocallOffset(v);
                    }, {min: 0, max: 1, step: 0.01})
                })
            }, {icon: "fa fa-pen-to-square", className: "centered"});
            ebtn.children[0].style.width = "40px"
        }
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
                    
                if ( !this.app.loadedCharacters[value] ) {
                    $('#loading').fadeIn(); //hide();
                    let modelFilePath = this.avatarOptions[value][0]; 
                    let configFilePath = this.avatarOptions[value][1]; 
                    let modelRotation = (new THREE.Quaternion()).setFromAxisAngle( new THREE.Vector3(1,0,0), this.avatarOptions[value][2] ); 
                    this.app.loadAvatar(modelFilePath, config || configFilePath, modelRotation, value, ()=>{ 
                        this.app.changeAvatar(value);
                        this.createAvatarsPanel();
                        if(this.app.currentCharacter.config) {
                            this.app.changeMode(App.Modes.SCRIPT);
                            
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
                this.app.changeAvatar(value);
                this.createAvatarsPanel();
            });
        } ,{ nameWidth: "100px", icon: "fa-solid fa-cloud-arrow-up" } );        
      
        p.addSeparator();

        let modelShirt = null;
        this.app.currentCharacter.model.traverse((object) => {
            if(object.isSkinnedMesh && object.name.includes("Top")) {
                modelShirt = object;
            }
        })
        
        let color = new THREE.Color(this.app.sceneColor);

        if ( modelShirt ){
            color.copy(modelShirt.material.color);
            let topsColor = "#" + color.getHexString();

            p.addColor("Clothes", topsColor, (value, event) => {
                modelShirt.material.color.set(value); // css works in sRGB
            });
        }

        // p.sameLine();
        let avatars = [];
        for(let avatar in this.avatarOptions) {
            // p.sameLine();
            const btn = p.addButton(null, avatar, (value)=> {
                this.app.bmlApp.mood = "Neutral";
                let msg = { type: "behaviours", data: [ { type: "faceEmotion", emotion: this.app.bmlApp.mood.toUpperCase(), amount: this.app.bmlApp.moodIntensity, start: 0.0, shift: true } ] };
                this.app.bmlApp.ECAcontroller.processMsg(JSON.stringify(msg));

                // load desired model
                if ( !this.app.loadedCharacters[value] ) {
                    $('#loading').fadeIn(); //hide();
                    let modelFilePath = this.avatarOptions[value][0]; 
                    let configFilePath = this.avatarOptions[value][1]; 
                    let modelRotation = (new THREE.Quaternion()).setFromAxisAngle( new THREE.Vector3(1,0,0), this.avatarOptions[value][2] ); 
                    this.app.loadAvatar(modelFilePath, configFilePath, modelRotation, value, ()=>{ 
                        this.app.changeAvatar(value);
                        this.createAvatarsPanel(); 
                        
                        $('#loading').fadeOut();
                    }, (err) => {
                        $('#loading').fadeOut();
                        LX.popup("There was an error loading the avatar", "Avatar not loaded", {width: "30%"});
                    } );
                    return;
                } 
    
                // use controller if it has been already loaded in the past
                this.app.changeAvatar(value);
                this.createAvatarsPanel();

            }, {img: this.avatarOptions[avatar][3] ?? AppGUI.THUMBNAIL, className: "centered"});

            btn.children[0].classList.add("roundedbtn");
            if(avatar == this.app.currentCharacter.model.name) {
                btn.children[0].classList.add("selected");

                let ebtn = p.addButton( null, "Edit Avatar", (v) => {
                    this.createEditAvatarDialog(v);
                } ,{ icon: "fa-solid fa-user-pen", className: "centered" } );
                ebtn.children[0].style.width = "40px";
            }
            avatars.push({ value: avatar, src: this.avatarOptions[avatar][3] ?? AppGUI.THUMBNAIL});
                // p.endLine();
        }
    }

    createEditAvatarDialog() {
        let name = this.app.currentCharacter.model.name;
        this.editAvatar(name, {
            callback: (newName, rotation, config) => {
                if(name != newName) {
                    this.avatarOptions[newName] = [ this.avatarOptions[name][0], this.avatarOptions[name][1], this.avatarOptions[name][2], this.avatarOptions[name][3]]
                    delete this.avatarOptions[name];
                    name = newName;
                    this.app.currentCharacter.model.name = name;
                    this.refresh();
                }
                this.avatarOptions[name][2] = rotation;
                
                const modelRotation = (new THREE.Quaternion()).setFromAxisAngle( new THREE.Vector3(1,0,0), rotation ); 
                this.app.currentCharacter.model.quaternion.premultiply( modelRotation );
                if(this.app.currentCharacter.config && this.app.currentCharacter.config == config) {
                    return;
                }
                this.app.currentCharacter.config = config;
                if(config) {
                    this.avatarOptions[name][1] = config._filename;
                    this.app.bmlApp.onLoadAvatar(this.app.currentCharacter.model, this.app.currentCharacter.config, this.app.currentCharacter.skeleton);
                    this.app.currentCharacter.skeleton.pose();
                    this.app.bmlApp.ECAcontroller.reset();                        
                    this.app.changeMode(App.Modes.SCRIPT);
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
        for (let i = 0; i < this.app.cameras.length; i++) {
            const camera = {
                value: (i + 1).toString(),
                callback: (v,e) => {
                    this.app.controls[this.app.camera].enabled = false; // disable controls from previous camera
                    this.app.camera = v - 1; // update active camera
                    this.app.controls[this.app.camera].enabled = true; // enable controls from current (new) camera
                }
            }

            cameras.push(camera);                  
        }

        p.sameLine();
        p.addComboButtons("Camera", cameras, {selected: (this.app.camera + 1).toString(), width: "auto", nameWidth:"260px"});    
        p.addButton(null, "Reset", (V) => {
            this.app.controls[this.app.camera].reset();

        }, { width: "30px", icon: "fa-solid fa-rotate-left"} ) 
        p.addComboButtons(null, [
            {
                value: "Restricted View",
                icon: "fa-solid fa-camera",
                callback: (v, e) => {
                    this.app.toggleCameraMode(); 
                    this.createCameraPanel();
                }
            },
            {
                value: "Free View",
                icon: "fa-solid fa-up-down-left-right",
                callback: (v, e) => {
                    this.app.toggleCameraMode(); 
                    this.createCameraPanel();
                }
            }
        ], {selected: this.app.cameraMode ? "Free View" : "Restricted View"});
        p.endLine("left");

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
            p.addButton("Capture", this.app.animationRecorder.isRecording ? "Stop recording" : "Start recording", (value, event) => {
                // Replay animation - dont replay if stopping the capture
                if(this.app.mode == App.Modes.SCRIPT) {
                    this.app.bmlApp.ECAcontroller.reset(true);
                    this.app.animationRecorder.manageCapture();
                    this.createCameraPanel();
                }
                else { 
                    this.showRecordingDialog(() => {
                        this.app.animationRecorder.manageMultipleCapture(this.app.keyframeApp);
                        this.createCameraPanel();
                    });
                }
            }, {icon: "fa-solid fa-circle", buttonClass: "floating-button" + (this.app.animationRecorder.isRecording ? "-playing" : "")});

            p.addText(null, "Select cameras to be recorded:", null, {disabled: true});
            p.sameLine();
            p.addCheckbox("1", this.app.cameras[0].record, (value, event) => {
                this.app.cameras[0].record = value;
            });
            p.addCheckbox("2", this.app.cameras[1].record, (value, event) => {
                this.app.cameras[1].record = value;
            });
            p.addCheckbox("3", this.app.cameras[2].record, (value, event) => {
                this.app.cameras[2].record = value;
            });
            p.endLine();
        }
    }

    createLightsPanel() {
        const p = this.panel;
        
        p.clear();
        p.branch( "Lights", { icon: "fa-solid fa-lightbulb"} );

        p.addColor("Color", "#" + this.app.dirLight.color.getHexString(), (value, event) => {
            this.app.dirLight.color.set(value);
        });
        
        const position = [this.app.dirLight.position.x , this.app.dirLight.position.y, this.app.dirLight.position.z];
        p.addVector3("Position", position, (v) => {
            this.app.dirLight.position.set(v[0], v[1], v[2]);
        }, {min: -10, max: 10})
    }

    createIcons(area) {
        this.settingsActive = this.backgroundsActive = this.avatarsActive = this.cameraActive = this.lightsActive = false;
        const buttons = [
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
            }
        ]
        area.addOverlayButtons(buttons, {float: "vr"});
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
                    if(this.app.mode == App.Modes.SCRIPT) {
                        this.app.bmlApp.mood = "Neutral";
                        this.app.bmlApp.ECAcontroller.reset();
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
                    if(this.app.mode == App.Modes.SCRIPT) {
                        this.app.bmlApp.ECAcontroller.reset(true);
                        this.app.animationRecorder.manageCapture();
                        this.createCameraPanel();
                    }
                    else { 
                        this.showRecordingDialog(() => {
                            this.app.animationRecorder.manageMultipleCapture(this.app.keyframeApp);
                            this.createCameraPanel();
                        });
                    }
                    const recordBtn = this.mainArea.sections[0].panels[1].root.querySelector("button[title='Record video']");
                    if(recordBtn) {
                        if(this.app.animationRecorder.isRecording) {
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
                    if(this.app.mode == App.Modes.SCRIPT) {
                        this.app.bmlApp.replay();
                    }
                    else if(this.app.mode == App.Modes.KEYFRAME) {
                        if(Object.keys(this.app.keyframeApp.loadedAnimations).length) {
                            this.app.keyframeApp.changePlayState(true);
                            this.changePlayButtons(true);
                        }
                        else {
                            LX.popup("No animations to play!", null, {size:["200px", "auto"]})
                        }
                    }
                }
            },
            {
                name: "Stop",
                icon: "fa fa-stop",
                class: "large",
                callback: () => {
                    if(this.app.mode == App.Modes.SCRIPT) {
                        this.app.bmlApp.ECAcontroller.reset(true);
                    }
                    else if(this.app.mode == App.Modes.KEYFRAME) {
                        this.app.keyframeApp.changePlayState(false);
                    }
                    this.changePlayButtons(false);
                }
            },            
        ];
        area.addOverlayButtons(playButtons, {float: "vbr"});
        area.addOverlayButtons(buttons, {float: "hbr"});

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
        if(this.app.mode != App.Modes.SCRIPT) {
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
        if(mode == App.Modes.SCRIPT) {
            let msg = { type: "behaviours", data: [ { type: "faceEmotion", emotion: this.app.bmlApp.mood.toUpperCase(), amount: this.app.bmlApp.moodIntensity, start: 0.0, shift: true } ] };
            
            const resetBtn = this.mainArea.sections[0].panels[2].root.querySelector("button[title='Reset pose']");
            if(resetBtn) {
                resetBtn.classList.remove("hidden");
            }
            this.changePlayButtons(false);
            this.app.bmlApp.ECAcontroller.processMsg(JSON.stringify(msg));
        }
        else if(mode == App.Modes.KEYFRAME) {
            const resetBtn = this.mainArea.sections[0].panels[2].root.querySelector("button[title='Reset pose']");
            if(resetBtn) {
                resetBtn.classList.add("hidden");
            }           
            this.changePlayButtons( this.app.keyframeApp.playing);
        }
        else {
            const resetBtn = this.mainArea.sections[0].panels[2].root.querySelector("button[title='Reset pose']");
            if(resetBtn) {
                resetBtn.classList.add("hidden");
            }
            this.changePlayButtons(false);
        }
    }

    createPanel(){

        let pocketDialog = new LX.PocketDialog( "Controls", p => {
            this.gui = p;

            this.gui.refresh = () =>{
                if(p.branches.length)                 {
                    this.branchesOpened["Customization"] = !p.getBranch("Customization").content.parentElement.classList.contains("closed");
                    this.branchesOpened["Transformations"] = !p.getBranch("Transformations").content.parentElement.classList.contains("closed");
                    this.branchesOpened["Recording"] = !p.getBranch("Recording").content.parentElement.classList.contains("closed");
                    this.branchesOpened["Animation"] = !p.getBranch("Animation").content.parentElement.classList.contains("closed");
                }
                                
                this.gui.clear();
                // // --------- Customization ---------
                p.branch( "Customization", { icon: "fa-solid fa-palette", closed: !this.branchesOpened["Customization"]} );
                // get color set on the actual objects and set them as default values to the colorpicker
                let color = new THREE.Color(this.app.sceneColor);

                p.addColor("Color Chroma", "#" + color.getHexString(), (value, event) => {
                    this.app.setBackPlaneColour(value);
                });
                
                p.addDropdown("Background", ["Open", "Studio", "Photocall"], "Open", (v) => {
                    switch(v) {
                        case "Open":
                            this.app.backPlane.visible = false;
                            this.app.ground.visible = true;
                            break;
                        case "Studio":
                            this.app.backPlane.visible = true;
                            this.app.backPlane.material.map = null;                            
                            this.app.backPlane.material.needsUpdate = true;
                            this.app.ground.visible = false;
                            break;
                        case "Photocall":
                            this.app.backPlane.visible = true;
                            this.app.ground.visible = false;
                            const texture = new THREE.TextureLoader().load( this.app.logo, (image) =>{            
                                image.repeat.set(20, 20);
                            });
                            
                            texture.format = THREE.RGBAFormat;
                            texture.wrapT = THREE.RepeatWrapping;
                            texture.wrapS = THREE.RepeatWrapping;
                            this.app.backPlane.material.map =  texture;
                            this.app.backPlane.material.needsUpdate = true;
                            break;
                    }
                });
                let modelShirt = this.app.currentCharacter.model.getObjectByName("Tops");
                if ( modelShirt ){
                    color.copy(this.app.currentCharacter.model.getObjectByName("Tops").material.color);
                    let topsColor = "#" + color.getHexString();
        
                    p.addColor("Color Clothes", topsColor, (value, event) => {
                        this.app.scene.getObjectByName("Tops").material.color.set(value); // css works in sRGB
                    });
                }

                p.sameLine();
                let avatars = [];
                for(let avatar in this.avatarOptions) {
                    avatars.push({ value: avatar, src: this.avatarOptions[avatar][3] ?? AppGUI.THUMBNAIL});
                }
                p.addDropdown("Avatar", avatars, this.app.currentCharacter.model.name, (value, event) => {
                    if(this.app.mode == App.Modes.SCRIPT) {
                        this.app.bmlApp.mood = "Neutral";
                        this.app.bmlApp.ECAcontroller.reset();
                        this.app.bmlApp.ECAcontroller.update(0,0);
                    }
                    
                    // load desired model
                    if ( !this.app.loadedCharacters[value] ) {
                        $('#loading').fadeIn(); //hide();
                        let modelFilePath = this.avatarOptions[value][0]; 
                        let configFilePath = this.avatarOptions[value][1]; 
                        let modelRotation = (new THREE.Quaternion()).setFromAxisAngle( new THREE.Vector3(1,0,0), this.avatarOptions[value][2] ); 
                        this.app.loadAvatar(modelFilePath, configFilePath, modelRotation, value, ()=>{ 
                            this.app.changeAvatar(value);
                            $('#loading').fadeOut();
                        }, (err) => {
                            $('#loading').fadeOut();
                            LX.popup("There was an error loading the avatar", "Avatar not loaded", {width: "30%"});
                        }  );
                        return;
                    } 

                    // use controller if it has been already loaded in the past
                    this.app.changeAvatar(value);
                    });

                p.addButton( null, "Edit Avatar", (v) => {
                    this.createEditAvatarDialog();
                } ,{ width: "40px", icon: "fa-solid fa-user-pen" } );
                p.addButton( null, "Upload Avatar", (v) => {
                    this.uploadAvatar((value) => {
                            
                        if ( !this.app.loadedCharacters[value] ) {
                            $('#loading').fadeIn(); //hide();
                            let modelFilePath = this.avatarOptions[value][0]; 
                            let configFilePath = this.avatarOptions[value][1]; 
                            let modelRotation = (new THREE.Quaternion()).setFromAxisAngle( new THREE.Vector3(1,0,0), this.avatarOptions[value][2] ); 
                            this.app.loadAvatar(modelFilePath, configFilePath, modelRotation, value, ()=>{ 
                                this.app.changeAvatar(value);
                                $('#loading').fadeOut();
                            }, (err) => {
                                $('#loading').fadeOut();
                                LX.popup("There was an error loading the avatar", "Avatar not loaded", {width: "30%"});
                            } );
                            return;
                        } 

                        // use controller if it has been already loaded in the past
                        this.app.changeAvatar(value);

                    });
                } ,{ width: "40px", icon: "fa-solid fa-cloud-arrow-up" } );
                
                p.endLine();

                p.branch( "Transformations", { icon: "fa-solid fa-up-down-left-right", closed: !this.branchesOpened["Transformations"]} );

                const model = this.app.currentCharacter.model;
                p.addVector3("Position", [model.position.x, model.position.y, model.position.z], (value, event) => {
                    model.position.set(value[0], value[1], value[2]);
                }, {step:0.01});
                p.addVector3("Rotation", [THREE.MathUtils.radToDeg(model.rotation.x), THREE.MathUtils.radToDeg(model.rotation.y), THREE.MathUtils.radToDeg(model.rotation.z)], (value, event) => {
                    model.rotation.set(THREE.MathUtils.degToRad(value[0]), THREE.MathUtils.degToRad(value[1]), THREE.MathUtils.degToRad(value[2]));
                }, {step:0.01});
                p.addNumber("Scale", model.scale.x, (value, event) => {
                    model.scale.set(value, value, value);
                }, {step:0.01});        

                p.branch( "Recording", { icon: "fa-solid fa-video", closed: !this.branchesOpened["Recording"]} );

                let cameras = [];
                for (let i = 0; i < this.app.cameras.length; i++) {
                    const camera = {
                        value: (i + 1).toString(),
                        callback: (v,e) => {
                            this.app.controls[this.app.camera].enabled = false; // disable controls from previous camera
                            this.app.camera = v - 1; // update active camera
                            this.app.controls[this.app.camera].enabled = true; // enable controls from current (new) camera
                        }
                    }

                    cameras.push(camera);                  
                }

                p.sameLine();
                p.addComboButtons("Camera", cameras, {selected: (this.app.camera + 1).toString(), width: "55%"});    
                p.addButton(null, "Reset", (V) => {
                    this.app.controls[this.app.camera].reset();

                }, { width: "30px", icon: "fa-solid fa-rotate-left"} ) 
                p.addComboButtons(null, [
                    {
                        value: "Restricted View",
                        icon: "fa-solid fa-camera",
                        callback: (v, e) => {
                            this.app.toggleCameraMode(); 
                            this.refresh();
                        }
                    },
                    {
                        value: "Free View",
                        icon: "fa-solid fa-up-down-left-right",
                        callback: (v, e) => {
                            this.app.toggleCameraMode(); 
                            this.refresh();
                        }
                    }
                ], {selected: this.app.cameraMode ? "Free View" : "Restricted View"});
                p.endLine("left");

                p.addButton("Capture", this.app.animationRecorder.isRecording ? "Stop recording" : "Start recording", (value, event) => {
                    // Replay animation - dont replay if stopping the capture
                    if(this.app.mode == App.Modes.SCRIPT) {
                        this.app.bmlApp.ECAcontroller.reset(true);
                        this.app.animationRecorder.manageCapture();
                        this.refresh();
                    }
                    else if (this.app.mode == App.Modes.KEYFRAME) { 
                        this.showRecordingDialog(() => {
                            this.app.animationRecorder.manageMultipleCapture(this.app.keyframeApp);
                            this.refresh();
                        });
                    }


                }, {icon: "fa-solid fa-circle", buttonClass: "floating-button" + (this.app.animationRecorder.isRecording ? "-playing" : "")});
                p.merge(); // random signs

                p.branch("Animation", {icon: "fa-solid fa-hands-asl-interpreting", closed: !this.branchesOpened["Animation"]});
                const combo = p.addComboButtons("Animation from", [
                    {
                        value: "BML",
                        callback: (v, e) => {
                            if (this.app.currentCharacter.config) {
                                this.app.changeMode(App.Modes.SCRIPT);
                                this.refresh();
                            }
                            else {
                                console.log(combo)
                                const el = combo.domEl.getElementsByClassName('lexcombobuttons')[0];
                                el.children[0].classList.remove('selected');
                                el.children[1].classList.add('selected');
                                //this.app.changeMode(App.Modes.KEYFRAME);                                
                            }
                        }
                    },
                    {
                        value: "File",
                        callback: (v, e) => {
                            this.app.changeMode(App.Modes.KEYFRAME);
                            this.refresh();
                        }
                    }
                ], {selected: this.app.mode == App.Modes.SCRIPT ? "BML" : "File"});
                
                
                // p.addNumber("Signing Speed", this.app.speed, (value, event) => {
                //     // this.app.speed = Math.pow( Math.E, (value - 1) );
                //     this.app.speed = value;
                // }, { min: 0, max: 2, step: 0.01});
                

                if(this.app.mode == App.Modes.SCRIPT) {
                    this.createBMLPanel(p);
                }
                else {
                    this.createKeyframePanel(p);
                }
                p.merge();
            }

            this.gui.refresh();           

        }, { size: ["20%", null], float: "left", draggable: false });
        
        
        if ( window.innerWidth < window.innerHeight || pocketDialog.title.offsetWidth > (0.21*window.innerWidth) ){
            pocketDialog.title.click();
        }
        pocketDialog.destroy()

    }

    createBMLPanel(panel, refresh) {
        
        this.bmlGui = panel;

        if (!this.app.currentCharacter.config) {
            this.bmlGui.addText(null, "To use this mode, the current character's configuration file is needed.", null, {disabled: true});
            this.bmlGui.addButton(null, "Edit avatar", () => { 
                this.createEditAvatarDialog();                
            }, {icon: "fa fa-edit"})  
            return;
        }
                
        this.bmlGui.addNumber("Speed", this.app.bmlApp.speed, (value, event) => {
            // this.app.speed = Math.pow( Math.E, (value - 1) );
            this.app.bmlApp.speed = value;
        }, { min: 0.1, max: 2, step: 0.01});

        this.bmlGui.sameLine();
        this.bmlGui.addButton( null, "Reset pose", (value, event) =>{
            this.app.bmlApp.mood = "Neutral";
            this.app.bmlApp.ECAcontroller.reset();
            refresh();
        }, {icon: "fa-solid fa-person", width: "40px", class:"floating-button"});

        this.bmlGui.addButton( null, "Replay", (value, event) =>{
            this.app.bmlApp.replay();         
            this.changePlayButtons(false);    
        }, {icon: "fa-solid fa-play"});

        this.bmlGui.endLine();

        this.bmlGui.addSeparator();
        this.bmlInputData.openButton = this.bmlGui.addButton( null, "BML Input", (value, event) =>{

            if ( this.bmlInputData.dialog ){ this.bmlInputData.dialog.close(); }

            this.bmlInputData.dialog = new LX.PocketDialog( "BML Instruction", p => {
                this.bmlInputData.dialog = p;

                let htmlStr = "Write in the text area below the bml instructions to move the avatar from the web application. A sample of BML instructions can be tested through the helper tabs in the right panel.";
                p.addTextArea(null, htmlStr, null, {disabled: true, fitHeight: true});
    
                p.addButton(null, "Click here to see BML instructions and attributes", () => {
                    window.open("https://github.com/upf-gti/performs/blob/main/docs/InstructionsBML.md");
                });
    
                htmlStr = "Note: In 'speech', all text between '%' is treated as actual words. An automatic translation from words (dutch) to phonemes (arpabet) is performed.";
                htmlStr += "\n\nNote: Each instruction is inside '{}'. Each instruction is separated by a coma ',' except que last one.";
                p.addTextArea(null, htmlStr, null, {disabled: true, fitHeight: true});
    
                htmlStr = 'An example: { "type":"speech", "start": 0, "text": "%hallo%.", "sentT": 1, "sentInt": 0.5 }, { "type": "gesture", "start": 0, "attackPeak": 0.5, "relax": 1, "end": 2, "locationBodyArm": "shoulder", "lrSym": true, "hand": "both", "distance": 0.1 }';
                p.addTextArea(null, htmlStr, null, {disabled: true, fitHeight: true});
    
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

                    this.app.bmlApp.processMessageRawBlocks( [{type: "bml", data: msg}] );
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
                                this.animics.app.global.app.editor.performsApp = this.app;
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
                        this.animics = window.open("https://webglstudio.org/projects/signon/animics");
                        
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
                    this.app.bmlApp.processMessageRawBlocks( [ {type:"sigml", data: text } ] );
                });
    
            }, { size: ["35%", "70%"], float: "left", draggable: false, closable: true});
        

        });

        let languages = Object.keys(this.app.bmlApp.languageDictionaries);
        let glossesDictionary = {};
        this.language = languages[0];

        for(let i = 0; i < languages.length; i++) {
            let lang = languages[i];
            glossesDictionary[lang] = [];
            for(let glossa in this.app.bmlApp.languageDictionaries[lang].glosses) {
                glossesDictionary[lang].push(glossa.replaceAll(".sigml", ""));
            }
        }
        this.glossInputData.openButton = this.bmlGui.addButton( null, "Glosses Input", (value, event) =>{

            if ( this.glossInputData.dialog ){ this.glossInputData.dialog.close(); }

            this.glossInputData.dialog = new LX.PocketDialog( "Glosses Input", p => {
                p.refresh = () => {
                    p.clear();
                    let htmlStr = "Select or write in the text area below the glosses (NGT) to move the avatar from the web application. Work in progress";
                    p.addTextArea(null, htmlStr, null, {disabled: true, fitHeight: true});  
                    
                    const area = new LX.Area({ height: "85%" });
                    p.attach( area.root );
                    
                    p.addDropdown("Language", languages, this.app.bmlApp.selectedLanguage, (value, event) => {
                        this.app.bmlApp.selectedLanguage = value;
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
                        this.app.bmlApp.processMessageRawBlocks(glosses);    
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
            let k = Object.keys( this.app.bmlApp.languageDictionaries[this.app.bmlApp.selectedLanguage]["glosses"] );
            
            let m = [];
            for( let i = 0; i < this.randomSignAmount; ++i ){
                m.push( { type: "glossName", data: k[ Math.floor( Math.random() * (k.length-1) ) ] } );
            }
            console.log( JSON.parse(JSON.stringify(m)));
            this.app.bmlApp.processMessageRawBlocks( m );
        }, { width: "40px", icon: "fa-solid fa-share"} );
        this.bmlGui.endLine();

        this.bmlGui.addSeparator();
        this.bmlGui.addDropdown("Mood", [ "Neutral", "Anger", "Happiness", "Sadness", "Surprise", "Fear", "Disgust", "Contempt" ], this.app.bmlApp.mood, (value, event) => {
            let msg = { type: "behaviours", data: [ { type: "faceEmotion", emotion: value.toUpperCase(), amount: this.app.bmlApp.moodIntensity, start: 0.0, shift: true } ] };
            this.app.bmlApp.mood = value;
            this.app.bmlApp.ECAcontroller.processMsg(JSON.stringify(msg));
        });

        this.bmlGui.addNumber("Mood intensity", this.app.bmlApp.moodIntensity, (v) => {
            let msg = { type: "behaviours", data: [ { type: "faceEmotion", emotion: this.app.bmlApp.mood.toUpperCase(), amount: v, start: 0.0, shift: true } ] };
            this.app.bmlApp.ECAcontroller.processMsg(JSON.stringify(msg));
            this.app.bmlApp.moodIntensity = v;
        }, {min: 0.1, max: 1.0, step: 0.01})

        this.bmlGui.addCheckbox("Apply idle animation", this.app.bmlApp.applyIdle, (v) => {
            this.app.bmlApp.applyIdle = v;            
            if(refresh) {
                refresh();
            }
        }, {nameWidth: "115px"});
        if(this.app.bmlApp.applyIdle) {
   
            this.bmlGui.addDropdown("Animations", Object.keys(this.app.bmlApp.loadedIdleAnimations), this.app.bmlApp.currentIdle, (v) => {
                this.app.bmlApp.bindAnimationToCharacter(v, this.app.currentCharacter.model.name);
            })
            this.bmlGui.addNumber("Intensity", this.app.bmlApp.intensity, (v) => {
                this.app.bmlApp.setIntensity(v);
            }, {min: 0.1, max: 1.0, step: 0.01})
        }
        this.bmlGui.merge(); // random signs
             
    }

    createKeyframePanel(panel, refresh) {
      
        this.keyframeGui = panel;
  
        this.keyframeGui.addNumber("Speed", this.app.keyframeApp.speed, (value, event) => {
            // this.app.speed = Math.pow( Math.E, (value - 1) );
            this.app.keyframeApp.speed = value;
        }, { min: -2, max: 2, step: 0.01});

        this.keyframeGui.sameLine();
        this.keyframeGui.addDropdown("Animation", Object.keys(this.app.keyframeApp.loadedAnimations), this.app.keyframeApp.currentAnimation, (v) => {
            this.app.keyframeApp.onChangeAnimation(v);
        }, {nameWidth:"70px"});

        const fileinput = this.keyframeGui.addFile("Animation File", (v, e) => {
            let files = panel.widgets["Animation File"].domEl.children[1].files;
            if(!files.length) {
                return;
            }
            this.app.loadFiles(files, ()=> {
                if(refresh) {
                    refresh();
                }
            })
        }, {type: "url", multiple: "multiple"});

        fileinput.domEl.classList.add('hidden');
        fileinput.domEl.children[1].setAttribute("multiple", "multiple");

        this.keyframeGui.addButton(null, "Upload animation", (v,e) => {
            fileinput.domEl.children[1].click();
        }, { icon: "fa fa-upload", width: "40px", className:"no-padding"});

        this.keyframeGui.addButton(null, "<i class='fa fa-solid " + (this.app.keyframeApp.playing ? "fa-stop'>": "fa-play'>") + "</i>", (v,e) => {
            this.app.keyframeApp.changePlayState();
            this.changePlayButtons(this.app.keyframeApp.playing );
            if(refresh) {
                refresh();
            }
        }, { width: "40px", className:"no-padding"});
        this.keyframeGui.endLine(); 

        this.keyframeGui.branch("Retargeting")
           
        this.keyframeGui.addCheckbox("Source embedded transforms", this.app.keyframeApp.srcEmbedWorldTransforms, (v) => {
            this.app.keyframeApp.srcEmbedWorldTransforms = v;
            this.app.keyframeApp.onChangeAnimation(this.app.keyframeApp.currentAnimation);
        },{nameWidth: "auto"})
            
        this.keyframeGui.addCheckbox("Target embedded transforms", this.app.keyframeApp.trgEmbedWorldTransforms, (v) => {
            this.app.keyframeApp.trgEmbedWorldTransforms = v;
            this.app.keyframeApp.onChangeAnimation(this.app.keyframeApp.currentAnimation);
        }, {nameWidth: "auto"})
        
        const poseModes = ["DEFAULT", "CURRENT", "TPOSE"];
        this.keyframeGui.addDropdown("Source reference pose", poseModes, poseModes[this.app.keyframeApp.srcPoseMode], (v) => {
    
            this.app.keyframeApp.srcPoseMode = poseModes.indexOf(v);
            this.app.keyframeApp.onChangeAnimation(this.app.keyframeApp.currentAnimation);
        }, {nameWidth: "200px"});

        this.keyframeGui.addDropdown("Character reference pose", poseModes, poseModes[this.app.keyframeApp.trgPoseMode], (v) => {
            
            this.app.keyframeApp.trgPoseMode = poseModes.indexOf(v);
            this.app.keyframeApp.onChangeAnimation(this.app.keyframeApp.currentAnimation);
        }, {nameWidth: "200px"});
    }

    showRecordingDialog(callback) {
        const dialog = new LX.Dialog("Record all animations", p => {

            let assetData = [];
            let animations = this.app.keyframeApp.loadedAnimations;
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
                                panel.setValue("Config URL", "https://webglstudio.org/3Dcharacters/ReadyEva/ReadyEva.json");
                                
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
                    this.app.openAtelier(name, model, config, true, rotation);

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
                this.app.openAtelier(name, model, config, true, rotation);
            })
            panel.addButton(null, "Upload", () => {
                if (name && model) {
                    if (this.avatarOptions[name]) { LX.popup("This avatar name is taken. Please, change it.", null, { position: ["45%", "20%"]}); return; }
                    let thumbnail = AppGUI.THUMBNAIL;
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
                        avatarFile.domEl.children[1].files = fileList;
                        avatarFile.domEl.children[1].dispatchEvent(new Event('change'), { bubbles: true });
                        model = v;
                        if(!name) {
                            name = filename;
                            nameWidget.set(name)
                        }
                    }
                    else if (extension == "json") { 
                        // Create a data transfer object
                        const dataTransfer = new DataTransfer();
                        // Add file to the file list of the object
                        dataTransfer.items.add(files[i]);
                        // Save the file list to a new variable
                        const fileList = dataTransfer.files;
                        configFile.domEl.children[1].files = fileList;
                        configFile.domEl.children[1].dispatchEvent(new Event('change'), { bubbles: true });

                        //config = JSON.parse(files[i]); 
                    }
                }
            })
            
        }
        panel.refresh();

        }, { size: ["40%"], closable: true, onclose: (root) => {  root.remove(); }});

        return name;
    }

    editAvatar(name, options = {}) {
        const data = this.app.currentCharacter;
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
                                config._filename = filename; 
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
                    this.app.openAtelier(name, this.avatarOptions[name][0], config, false, rotation);                  
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
                this.app.openAtelier(name, this.avatarOptions[name][0], config, false, rotation);                                       
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
                        avatarFile.domEl.children[1].files = fileList;
                        avatarFile.domEl.children[1].dispatchEvent(new Event('change'), { bubbles: true });
                        model = v;
                        if(!name) {
                            name = filename;
                            nameWidget.set(name)
                        }
                    }
                    else if (extension == "json") { 
                        // Create a data transfer object
                        const dataTransfer = new DataTransfer();
                        // Add file to the file list of the object
                        dataTransfer.items.add(files[i]);
                        // Save the file list to a new variable
                        const fileList = dataTransfer.files;
                        configFile.domEl.children[1].files = fileList;
                        configFile.domEl.children[1].dispatchEvent(new Event('change'), { bubbles: true });

                        //config = JSON.parse(files[i]); 
                    }
                }
            })
            
        }
        panel.refresh();

        }, { size: ["40%"], closable: true, onclose: (root) => {  root.remove(); }});

        return name;
    }

    setBMLInputText( text ){
        this.bmlInputData.prevInstanceText = text;
        if ( this.bmlInputData.codeObj ){ this.bmlInputData.codeObj.setText( text ); }
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
                        resultSpeechtext += this.app.bmlApp.wordsToArpa( strSplit[j], "NGT" );
                    }
                    j++;
                }
                result[i].text = resultSpeechtext + ".";
            }
        }

        return result;
    }

    showCaptureModal(capture) {
        if(!this.mainArea.split_extended) {
            this.mainArea.extend();
        }
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
}

export { AppGUI };