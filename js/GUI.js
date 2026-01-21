import * as THREE from "three"
import { PERFORMS } from "./Core.js";
import { LX } from 'lexgui';
import 'lexgui/extensions/codeeditor.js';

LX.mainArea = await LX.init();

LX.registerIcon("CircleRecording", 
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free v7.0.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path d="M64 320C64 178.6 178.6 64 320 64C461.4 64 576 178.6 576 320C576 461.4 461.4 576 320 576C178.6 576 64 461.4 64 320z"/></svg>'
);

LX.setThemeColor("global-selected", "#6200EA");
LX.setThemeColor("global-selected-light", "#bb86fc");
LX.setThemeColor("global-selected-dark", "#a100ff");

class GUI {

    static THUMBNAIL = "data/imgs/monster.png";

    static ACTIVEPANEL_NONE = 0;
    static ACTIVEPANEL_SETTINGS = 1;
    static ACTIVEPANEL_CAMERA = 2;
    static ACTIVEPANEL_BACKGROUND = 3;
    static ACTIVEPANEL_AVATARS = 4;
    static ACTIVEPANEL_LIGHTS = 5;

    constructor( performs ){
        this.performs = performs;
        this.randomSignAmount = 0;
        // available model models paths - [model, config, rotation, thumbnail]
        this.avatarOptions = {
            "EvaLow": [PERFORMS.AVATARS_URL+'Eva_Low/Eva_Low.glb', PERFORMS.AVATARS_URL+'Eva_Low/Eva_Low.json', 0, PERFORMS.AVATARS_URL+'Eva_Low/Eva_Low.png'],
            "Witch": [PERFORMS.AVATARS_URL+'Eva_Witch/Eva_Witch.glb', PERFORMS.AVATARS_URL+'Eva_Witch/Eva_Witch.json', 0, PERFORMS.AVATARS_URL+'Eva_Witch/Eva_Witch.png'],
            "Kevin": [PERFORMS.AVATARS_URL+'Kevin/Kevin.glb', PERFORMS.AVATARS_URL+'Kevin/Kevin.json', 0, PERFORMS.AVATARS_URL+'Kevin/Kevin.png'],
            "Ada": [PERFORMS.AVATARS_URL+'Ada/Ada.glb', PERFORMS.AVATARS_URL+'Ada/Ada.json', 0, PERFORMS.AVATARS_URL+'Ada/Ada.png'],
            "Ready Eva": [PERFORMS.AVATARS_URL+'ReadyEva/ReadyEva.glb', PERFORMS.AVATARS_URL+'ReadyEva/ReadyEva.json', 0, 'https://models.readyplayer.me/66e30a18eca8fb70dcadde68.png?background=68,68,68'],
            // "Eva": ['https://models.readyplayer.me/66e30a18eca8fb70dcadde68.glb', PERFORMS.AVATARS_URL+'ReadyEva/ReadyEva_v3.json',0, 'https://models.readyplayer.me/66e30a18eca8fb70dcadde68.png?background=68,68,68']
        }

        // take canvas from dom, detach from dom, attach to lexgui 
        this.performs.renderer.domElement.remove(); // removes from dom
        this.mainArea = LX.mainArea;
        this.mainArea.root.ondrop = this.onDropFiles.bind(this);

        this.bmlInputData = { openButton: null, dialog: null, codeObj: null, prevInstanceText: "" };
        this.sigmlInputData = { openButton: null, dialog: null, codeObj: null, prevInstanceText:"" };
        this.glossInputData = { openButton: null, dialog: null, textArea: null,  glosses: "" };

        const [canvasArea, panelArea] = this.mainArea.split({type:"horizontal", sizes: ["88%", "12%"], minimizable: true});
        canvasArea.attach( this.performs.renderer.domElement );
        canvasArea.onresize = (bounding) => this.resize(bounding.width, bounding.height);
        canvasArea.root.appendChild(this.performs.renderer.domElement);

        this.panel = panelArea.addPanel({height: "100%"});
        panelArea.addOverlayButtons([{
            icon: "X",
            class: "relative",
            callback: () => {
                this.setActivePanel( GUI.ACTIVEPANEL_NONE );
            }
        }], {float: "rt"});

        this.branchesOpened = {"Customization" : true, "Transformations": true, "Recording": true, "Animation": true, "Export": true};
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
                    if(this.performs.mode == PERFORMS.Modes.KEYFRAME) {
                        if(Object.keys(this.performs.keyframeApp.loadedAnimations).length) {
                            this.performs.changePlayState();
                            this.changePlayButtons(this.performs.keyframeApp.playing);
                        }
                        else {
                            LX.popup("No animations to play!", null, {size:["200px", "auto"]})
                        }
                    }
                    else if (this.performs.mode == PERFORMS.Modes.SCRIPT) {
                        if(event.target.tagName == 'TEXTAREA' || event.target.classList.contains("lexcodeeditor")) {
                            return;
                        }
                        this.performs.scriptApp.replay();
                    }                    
                }
                else if(event.key == 'Escape') {
                    if(this.activePanelType) {
                        this.setActivePanel(GUI.ACTIVEPANEL_NONE);
                    }else{
                        this.setActivePanel(this.prevActivePanelType);
                    }
                }
            });
        }

        this.playing = false;
        this.captureEnabled = false;
        this.controlsActive = true;
        
        this.activePanelType = GUI.ACTIVEPANEL_NONE;
        this.prevActivePanelType = GUI.ACTIVEPANEL_NONE;
        this.setActivePanel( GUI.ACTIVEPANEL_NONE );

        this.overlayButtonsPlay = null;
        this.overlayButtonsReset = null;
        this.overlayButtonsMenu = null;

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
        this.setActivePanel( this.activePanelType );
    }

    setActivePanel( type ){
        switch( this.activePanelType ){
          case GUI.ACTIVEPANEL_SETTINGS: this.overlayButtonsMenu.buttons["Settings"].root.children[0].classList.remove("selected"); break;
          case GUI.ACTIVEPANEL_CAMERA: this.overlayButtonsMenu.buttons["Camera"].root.children[0].classList.remove("selected"); break;
          case GUI.ACTIVEPANEL_BACKGROUND: this.overlayButtonsMenu.buttons["Backgrounds"].root.children[0].classList.remove("selected"); break;
          case GUI.ACTIVEPANEL_AVATARS: this.overlayButtonsMenu.buttons["Avatars"].root.children[0].classList.remove("selected"); break;
          case GUI.ACTIVEPANEL_LIGHTS: this.overlayButtonsMenu.buttons["Lights"].root.children[0].classList.remove("selected"); break;
        }
        switch( type ){
          case GUI.ACTIVEPANEL_SETTINGS: this.createSettingsPanel(); break;
          case GUI.ACTIVEPANEL_CAMERA: this.createCameraPanel(); break;
          case GUI.ACTIVEPANEL_BACKGROUND: this.createBackgroundsPanel(); break;
          case GUI.ACTIVEPANEL_AVATARS: this.createAvatarsPanel(); break;
          case GUI.ACTIVEPANEL_LIGHTS: this.createLightsPanel(); break;
          default: type = GUI.ACTIVEPANEL_NONE; break;
        }

        if (type){
            if( this.activePanelType == GUI.ACTIVEPANEL_NONE ){ // only move split if it was closed before
              this.mainArea._moveSplit(0.3 * window.innerWidth);
            }          
            this.panel.parent.show();
        }else{
            this.mainArea._moveSplit(-window.innerWidth);
            this.panel.parent.hide();
        }
      
        if ( type != this.activePanelType ){
            this.prevActivePanelType = this.activePanelType;
        }
        this.activePanelType = type;
    }

    createSettingsPanel(force = false) {
        const p = this.panel;
        
        if(p.getBranch("Animation")) {
            this.branchesOpened["Animation"] = !p.getBranch("Animation").content.parentElement.classList.contains("closed");
        }
        
        p.clear();
        p.branch("Animation", {icon: "ASL", closed: !this.branchesOpened["Animation"]});
        
        p.addText(null,"Animation mode options", null, {disabled: true, inputClass:"nobg"});
        p.sameLine();

        let btn = p.addButton(null, "Script animation", (v, e) => {
            if (this.performs.currentCharacter.config) {
                this.performs.changeMode(PERFORMS.Modes.SCRIPT);
                if(this.performs.scriptApp.currentIdle) {
                    this.performs.scriptApp.bindAnimationToCharacter(this.performs.scriptApp.currentIdle, this.performs.currentCharacter.model.name);
                }
            }
            else {
                this.performs.changeMode(-1);   
            }
            this.createSettingsPanel();
            this.overlayButtonsReset.buttons["Reset pose"].root.classList.remove("hidden");
        }, {
            icon: "Code2", 
            width: "50%",
            selectable: true, 
            selected: this.performs.mode == PERFORMS.Modes.SCRIPT || this.performs.mode == -1
        } );

        btn = p.addButton(null, "Keyframing animation",  (v, e) => {
            this.performs.changeMode(PERFORMS.Modes.KEYFRAME);
            this.createSettingsPanel(); 
            this.overlayButtonsReset.buttons["Reset pose"].root.classList.add("hidden");
        }, {
            icon: "Film",
            width: "50%",
            selectable: true,
            selected: this.performs.mode == PERFORMS.Modes.KEYFRAME
        } );
        
        p.endLine();
        p.sameLine();
     
        p.addText(null, "Script animation", null, {disabled: true, width: "50%", inputClass:"nobg justItm_c"});
        p.addText(null, "Clip animation", null, {disabled: true, width: "50%", inputClass:"nobg justItm_c"});

        p.endLine();

        p.addSeparator();

        if(!force) {
            if(this.performs.mode == PERFORMS.Modes.SCRIPT || this.performs.mode == -1) {
                this.createBMLPanel(p, this.createSettingsPanel.bind(this));
            }
            else {
                this.createKeyframePanel(p, this.createSettingsPanel.bind(this));
            }
        }

        p.branch( "Transformations", { icon: "Move", closed: !this.branchesOpened["Transformations"]} );

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
        p.branch( "Export", { icon: "FileOutput", closed: !this.branchesOpened["Export"]} );
        
        if( this.performs.mode == PERFORMS.Modes.KEYFRAME ) {            
            p.addButton(null, "Export avatar", (v) => {
                this.showExportAvatarDialog();
            })
        }
        p.addButton(null, "Export configuration", (v) => {
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
        const openBtn = p.addButton("openBtn", "Open space", (value)=> {
            this.performs.setBackground( PERFORMS.Backgrounds.OPEN);
            this.createBackgroundsPanel();
        }, {img: "./data/imgs/open-space.png", className: "centered", buttonClass: "roundedbtn", hideName: true}).root;
        if( this.performs.background == PERFORMS.Backgrounds.OPEN ) {
            openBtn.children[0].classList.add('selected');
        }
        
        
        // Studio background
        const studioP = new LX.Panel();
       
        const studioBtn = p.addButton("studioBtn", "Studio", (value)=> {
            this.performs.setBackground( PERFORMS.Backgrounds.STUDIO);
            this.createBackgroundsPanel();
        }, {img: "./data/imgs/studio-space.png", className: "centered flex flex-col items-center", buttonClass: "roundedbtn", hideName: true }).root;
        if( this.performs.background == PERFORMS.Backgrounds.STUDIO ) {
            studioBtn.children[0].classList.add('selected');
            const ebtn = studioP.addButton(null, "Edit properties", (e) => {
                this.showStudioPropertiesDialog( );
            }, {icon: "PenBox", className: "centered", width: "40px", height: "40px"}).root;
            studioBtn.append(ebtn);
        }
        
        // Photocall background
        const photocallP = new LX.Panel();
      
        const photocallBtn = p.addButton("photocallBtn", "Photocall", (value)=> {
            this.performs.setBackground( PERFORMS.Backgrounds.PHOTOCALL);
            this.createBackgroundsPanel();
        }, {img: "./data/imgs/photocall-space.png", className: "centered flex flex-col items-center", buttonClass: "roundedbtn", hideName: true}).root;
        if( this.performs.background == PERFORMS.Backgrounds.PHOTOCALL ) {
            photocallBtn.children[0].classList.add('selected');
            const ebtn = photocallP.addButton(null, "Edit properties", (e) => {
                this.showPhotocallPropertiesDialog( );                
            }, {icon: "PenBox", className: "centered", width: "40px"}).root;
            photocallBtn.append(ebtn);
        }
    }

    showStudioPropertiesDialog() {
        const dialog = new LX.Dialog("Properties", (panel) => {
            let formFile = true;

            panel.addComboButtons(null, [
                {
                    value: "From File",
                    callback: (v, e) => {                            
                        formFile = true;
                        panel.components["Image/Video URL"].root.classList.add('hidden');
                        panel.components["File"].root.classList.remove('hidden');
                    }
                },
                {
                    value: "From URL",
                    callback: (v, e) => {
                        formFile = false;
                        panel.components["File"].root.classList.add('hidden');
                        panel.components["Image/Video URL"].root.classList.remove('hidden');
                    }
                }
            ], {selected: formFile ? "From File" : "From URL", width: "100%"});
            
            const logoFile = panel.addFile("File", (v, e) => {
                
                const files = panel.components["File"].root.children[1].files;
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
                        this.performs.setBackground( PERFORMS.Backgrounds.STUDIO, this.performs.backgroundTexture);
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
            }, {type: "url", read:true});

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
                    this.performs.setBackground( PERFORMS.Backgrounds.STUDIO, this.performs.backgroundTexture);            
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

            }, {className: "hidden", read: true});

            panel.addSelect("Choose a setting", ["Fill", "Adjust", "Expand", "Extend"], this.performs.backgroundSettings, (v) => {
                this.performs.setBackgroundSettings(v);
                this.performs.backgroundSettings = v;               
            } );

            panel.addNumber("Scale", this.performs.textureScale, (v) => {
                this.performs.setBackgroundTextureScale(v);
            }, {min: 0, max: 2, step: 0.01})

            panel.addVector2("Position", this.performs.texturePosition, (v) => {
                this.performs.setBackgroundTexturePosition(v);
            }, { step: 0.01})
        }, {className: "resizeable"});
    }

    showPhotocallPropertiesDialog() {
        const dialog = new LX.Dialog("Properties", (panel) => {
            
            let formFile = true;
            panel.addComboButtons(null, [
                {
                    value: "From File",
                    callback: (v, e) => {                            
                        formFile = true;
                        panel.components["Logo URL"].root.classList.add('hidden');
                        panel.components["File"].root.classList.remove('hidden');
                    }
                },
                {
                    value: "From URL",
                    callback: (v, e) => {
                        formFile = false;
                        panel.components["File"].root.classList.add('hidden');
                        panel.components["Logo URL"].root.classList.remove('hidden');
                    }
                }
            ], {selected: formFile ? "From File" : "From URL", width: "100%"});

            const logoFile = panel.addFile("File", (v, e) => {
                const files = panel.components["File"].root.children[1].files;
                if(!files.length) {
                    return;
                }
                const path = files[0].name.split(".");
                const filename = path[0];
                const extension = path[1].toLowerCase();
                if (extension == "png" || extension == "jpeg" || extension == "jpg") { 
                     const imgCallback = ( event ) => {

                        this.performs.logo = event.target;        
                        this.performs.setBackground( PERFORMS.Backgrounds.PHOTOCALL, this.performs.logo);            
                    }
    
                    const img = new Image();            
                    img.onload = imgCallback;            
                    img.src = v;

                }
                else { LX.popup("Only accepts PNG, JPEG and JPG formats!"); }
            }, {type: "url", read:true});

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
                    this.performs.setBackground( PERFORMS.Backgrounds.PHOTOCALL, this.performs.logo);            
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

            }, {read: true, className: "hidden"});

            panel.addNumber("Offset", this.performs.repeatOffset, (v) => {
                this.performs.setPhotocallOffset(v);
            }, {min: 0, max: 1, step: 0.01});

            panel.addVector2("Repeatition", this.performs.repeatCount, (v) => {
                this.performs.repeatCount = v;
            }, {min: 0, max: 20})
        }, {className: "resizeable"});
    }

    createAvatarsPanel() {
        const p = this.panel;
        
        if(p.getBranch("Avatars")) {
            this.branchesOpened["Avatars"] = !p.getBranch("Avatars").content.parentElement.classList.contains("closed");
        }

        p.clear();
        p.branch('Avatars');

        p.addButton( "Upload yours", "Upload Avatar", (v) => {
            // uploadAvatar opens avatar upload ui and, when done, calls the callback
            this.uploadAvatar((avatarName, config) => { 
                this.selectAvatar(avatarName);
            });
        } ,{ nameWidth: "100px", icon: "UploadCloud", width: "140px"} );        
      
        p.addSeparator();

        if ( this.performs.avatarShirt ){
            let topsColor = this.performs.getClothesColour();
            p.addColor("Clothes", '#' + topsColor, (value, event) => {
                this.performs.setClothesColour(value);; // css works in sRGB
            });
        }

        for(let avatar in this.avatarOptions) {
            const btn = p.addButton(null, avatar, (avatarName)=> {
                this.performs.scriptApp.mood = "Neutral";
                if(this.performs.scriptApp.ECAcontroller) {
                    this.performs.scriptApp.ECAcontroller.reset();
                }
                this.selectAvatar(avatarName);
            }, {
                img: this.avatarOptions[avatar][3] ?? GUI.THUMBNAIL,
                className: "centered flex flex-col items-center",
                buttonClass: "roundedbtn",
                title: avatar
            }).root;
            
            if(avatar == this.performs.currentCharacter.model.name) {
                btn.children[0].classList.add("selected");
                const panel = new LX.Panel();

                let ebtn = panel.addButton( null, "Edit Avatar", (v) => {
                    this.createEditAvatarDialog(v);
                } ,{ icon: "UserRoundPen", width: "40px"} ).root;
                btn.append(ebtn);
            }
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
                    this.performs.changeMode(PERFORMS.Modes.SCRIPT);
                    if(this.activePanelType == GUI.ACTIVEPANEL_SETTINGS) {
                        this.createSettingsPanel();             
                    }
                    this.overlayButtonsReset.buttons["Reset pose"].root.classList.remove("hidden");
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
        p.branch( "Recording", { icon: "Video", closed: !this.branchesOpened["Recording"]} );

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

        p.addComboButtons("View Type", [
            {
                value: "Restricted View",
                icon: "Camera",
                callback: (v, e) => {
                    this.performs.changeCameraMode(false); 
                    this.createCameraPanel();
                }
            },
            {
                value: "Free View",
                icon: "Move",
                callback: (v, e) => {
                    this.performs.changeCameraMode(true); 
                    this.createCameraPanel();
                }
            }
        ], {selected: this.performs.cameraMode ? "Free View" : "Restricted View"});

        p.addSeparator();
        
        p.sameLine();
        p.addComboButtons("Camera", cameras, {selected: (this.performs.camera + 1).toString(), width: "80%"});    
        p.addButton(null, "Reset", (V) => {
            this.performs.controls[this.performs.camera].reset();

        }, { icon: "RotateCcw"} );
        p.endLine("left");

        p.addCheckbox("Enable capture", this.captureEnabled, (v) => {
            this.captureEnabled = v;

            if(this.captureEnabled) {
                this.overlayButtonsPlay.buttons["Record video"].root.classList.remove("hidden");
            }
            else {
                this.overlayButtonsPlay.buttons["Record video"].root.classList.add("hidden");
            }
        }, {
            skipReset: true,
            className: "contrast",
            label: "",
            suboptions: (sp)=>{
                sp.addText(null, "Select cameras to be recorded:", null, {disabled: true, inputClass:"nobg"});
               
                sp.sameLine();

                for( let i = 0; i < this.performs.cameras.length; ++i){
                    sp.addCheckbox((i+1).toString(), this.performs.cameras[i].record, (value, event) => {
                        this.performs.cameras[i].record = value;
                    },{className:"contrast", label: ""});
                    
                }
                sp.endLine();
    
                sp.addTitle("Automatic exportation")
                sp.addCheckbox("Export as ZIP", this.performs.animationRecorder.exportZip, (v) => {
                    this.performs.animationRecorder.exportZip = v;
                }, {
                    skipReset: true,
                    className: "contrast",
                    label: "",
                    title:"Pack all videos into a single ZIP or download each file individually"});
                    
            }            
        });
    }

    createLightsPanel() {
        const p = this.panel;
        
        p.clear();
        p.branch( "Lights", { icon: "Lightbulb"} );

        p.addColor("Color", "#" + this.performs.dirLight.color.getHexString(), (value, event) => {
            this.performs.dirLight.color.set(value);
        });
        
        const position = [this.performs.dirLight.position.x , this.performs.dirLight.position.y, this.performs.dirLight.position.z];
        p.addVector3("Position", position, (v) => {
            this.performs.dirLight.position.set(v[0], v[1], v[2]);
        }, {min: -10, max: 10})
    }

    createIcons(area) {
        const buttons = [
            {
                name: "Hide controls",
                selectable: false,
                icon: "EyeOff",
                swap: "Eye",
                class: "larger",
                state: false,
                callback: (b) => {
                    this.controlsActive = !this.controlsActive;   
                    if(!this.controlsActive) {
                        area.panels[0].root.classList.add("hide");
                    }
                    else {
                        area.panels[0].root.classList.remove("hide");
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
                icon: "Settings",
                class: "larger",
                callback: (b) => {
                    if(this.activePanelType == GUI.ACTIVEPANEL_SETTINGS) {
                        this.setActivePanel( GUI.ACTIVEPANEL_NONE );
                    }
                    else {
                        this.setActivePanel( GUI.ACTIVEPANEL_SETTINGS );
                        this.overlayButtonsMenu.buttons[b].root.children[0].classList.add("selected");
                    }
                }
            },
            {
                name: "Avatars",
                selectable: false,
                icon: "UserPen",
                class: "larger",
                callback: (b) => {
                    if(this.activePanelType == GUI.ACTIVEPANEL_AVATARS) {
                        this.setActivePanel( GUI.ACTIVEPANEL_NONE );
                    }
                    else {
                        this.setActivePanel( GUI.ACTIVEPANEL_AVATARS );
                        this.overlayButtonsMenu.buttons[b].root.children[0].classList.add("selected");
                    }
                }
            },
            {
                name: "Backgrounds",
                selectable: false,
                icon: "Images",
                class: "larger",
                callback: (b) => {
                    if(this.activePanelType == GUI.ACTIVEPANEL_BACKGROUND) {
                        this.setActivePanel( GUI.ACTIVEPANEL_NONE );
                    }
                    else {
                        this.setActivePanel( GUI.ACTIVEPANEL_BACKGROUND );
                        this.overlayButtonsMenu.buttons[b].root.children[0].classList.add("selected");
                    }
                }
            },            
            {
                name: "Camera",
                selectable: false,
                icon: "Video",
                class: "larger",
                callback: (b) => {
                    if(this.activePanelType == GUI.ACTIVEPANEL_CAMERA) {
                        this.setActivePanel( GUI.ACTIVEPANEL_NONE );
                    }
                    else {
                        this.setActivePanel( GUI.ACTIVEPANEL_CAMERA );
                        this.overlayButtonsMenu.buttons[b].root.children[0].classList.add("selected");
                    }
                }
            },
            {
                name: "Lights",
                selectable: false,
                icon: "Lightbulb",
                class: "larger",
                callback: (b) => {
                    if(this.activePanelType == GUI.ACTIVEPANEL_LIGHTS) {
                        this.setActivePanel( GUI.ACTIVEPANEL_NONE );
                    }
                    else {
                        this.setActivePanel( GUI.ACTIVEPANEL_LIGHTS );
                        this.overlayButtonsMenu.buttons[b].root.children[0].classList.add("selected");
                    }
                }
            },
            {
                name: "Info",
                selectable: false,
                icon: "CircleQuestionMark",
                class: "larger",
                callback: (b) => {
                    this.showGuide();     
                }
            },
        ];

        this.overlayButtonsMenu = area.addOverlayButtons(buttons, {className:"hiddenBackground", float: "vr", id: "overlay-controls"});
        area.panels[0].root.style.visibility = "hidden";
        this.createPlayButtons();
    }

    createPlayButtons() {
        const area = this.mainArea.sections[0];
        // area.panels[1].clear();
        let buttons = [
            {
                name: "Reset pose",
                icon: "PersonStanding",
                class: "relative left",
                callback: (value, event) => {
                    // Replay animation - dont replay if stopping the capture
                    if(this.performs.mode == PERFORMS.Modes.SCRIPT) {
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
                icon: "CircleRecording@solid",
                class: "relative",
                callback: (value, event) => {
                    // Replay animation - dont replay if stopping the capture
                    if(!this.performs.animationRecorder.isRecording) {
                        this.setActivePanel(GUI.ACTIVEPANEL_NONE);
                    }
                    const recordBtn = this.overlayButtonsPlay.buttons["Record video"].root.children[0];

                    if(this.performs.mode == PERFORMS.Modes.SCRIPT) {
                        this.performs.scriptApp.ECAcontroller.reset(true);
                        setTimeout(() => {
                            this.performs.animationRecorder.manageCapture();
                            this.createCameraPanel();
                            
                            if(this.performs.animationRecorder.isRecording) {
                                recordBtn.classList.remove("floating-button");
                                recordBtn.classList.add("floating-button-playing");
                            }
                            else {
                                recordBtn.classList.remove("floating-button-playing");
                                recordBtn.classList.add("floating-button");
                            }
                        }, 100);
                    }
                    else { 
                        this.showRecordingDialog(() => {
                            this.performs.animationRecorder.manageMultipleCapture(this.performs.keyframeApp);
                            this.createCameraPanel();
                        });
                    }

                    if(this.performs.animationRecorder.isRecording) {
                        recordBtn.classList.remove("floating-button");
                        recordBtn.classList.add("floating-button-playing");
                    }
                    else {
                        recordBtn.classList.remove("floating-button-playing");
                        recordBtn.classList.add("floating-button");
                    }                    
                }
            },
            {
                name: "Play",
                icon: "Play@solid",
                class: "large",
                callback: () => {
                    if(this.performs.mode == PERFORMS.Modes.SCRIPT) {
                        this.performs.scriptApp.replay();
                    }
                    else if(this.performs.mode == PERFORMS.Modes.KEYFRAME) {
                        if(Object.keys(this.performs.keyframeApp.loadedAnimations).length) {
                            this.performs.changePlayState(true);
                            this.changePlayButtons(true);
                        }
                        else {
                            LX.popup("No animations to play!", null, {size:["200px", "auto"]})
                        }
                    }

                    if(this.performs.videoBackground && this.performs.background == PERFORMS.Backgrounds.STUDIO) {
                        this.performs.videoBackground.currentTime = 0;
                        this.performs.videoBackground.play();
                    }
                }
            },
            {
                name: "Stop",
                icon: "Stop@solid",
                class: "large",
                callback: () => {
                    if(this.performs.mode == PERFORMS.Modes.SCRIPT) {
                        this.performs.scriptApp.ECAcontroller.reset(true);
                    }
                    else if(this.performs.mode == PERFORMS.Modes.KEYFRAME) {
                        this.performs.changePlayState(false);
                    }
                    if(this.performs.videoBackground) {
                        this.performs.videoBackground.pause();
                        this.performs.videoBackground.currentTime = 0;
                    }
                    this.changePlayButtons(false);
                }
            },            
        ];
        this.overlayButtonsPlay = area.addOverlayButtons(playButtons, {float: "vbr", id: "overlay-playbuttons"});
        this.overlayButtonsReset = area.addOverlayButtons(buttons, {float: "hbr", id: "overlay-buttons"});
        area.panels[1].root.style.visibility = "hidden";
        area.panels[2].root.style.visibility = "hidden";
        
        
        this.overlayButtonsPlay.buttons["Stop"].root.classList.add("hidden");
        
        this.overlayButtonsPlay.buttons["Record video"].root.classList.add("hidden");
        this.overlayButtonsPlay.buttons["Record video"].root.style.justifyContent = "right";
        this.overlayButtonsPlay.buttons["Record video"].root.children[0].classList.add("floating-button");
        
        this.overlayButtonsReset.buttons["Reset pose"].root.children[0].classList.add("floating-button");
        if(this.performs.mode != PERFORMS.Modes.SCRIPT) {
            this.overlayButtonsReset.buttons["Reset pose"].root.classList.add("hidden");
        }
    }

    changePlayButtons(isPlaying) {
        if(isPlaying) {
            this.overlayButtonsPlay.buttons["Stop"].root.classList.remove("hidden");
            this.overlayButtonsPlay.buttons["Play"].root.classList.add("hidden");
        }
        else {
            this.overlayButtonsPlay.buttons["Stop"].root.classList.add("hidden");
            this.overlayButtonsPlay.buttons["Play"].root.classList.remove("hidden");
        }
    }

    onChangeMode(mode) {
        if(mode == PERFORMS.Modes.SCRIPT) {
            let msg = { type: "behaviours", data: [ { type: "faceEmotion", emotion: this.performs.scriptApp.mood.toUpperCase(), amount: this.performs.scriptApp.moodIntensity, start: 0.0, shift: true } ] };
            
            this.overlayButtonsReset.buttons["Reset pose"].root.classList.remove("hidden");
            this.changePlayButtons(false);
            this.performs.scriptApp.ECAcontroller.processMsg(JSON.stringify(msg));
            
            if(this.performs.keyframeApp.trajectoriesActive) {
                this.performs.keyframeApp.trajectoriesHelper.hide();
            }
        }
        else if(mode == PERFORMS.Modes.KEYFRAME) {
            this.overlayButtonsReset.buttons["Reset pose"].root.classList.add("hidden");
            this.changePlayButtons( this.performs.keyframeApp.playing);
            if(this.performs.keyframeApp.trajectoriesActive) {
                this.performs.keyframeApp.trajectoriesHelper.show();
            }
        }
        else {
            this.overlayButtonsReset.buttons["Reset pose"].root.classList.add("hidden");
            this.changePlayButtons(false);
        }
    }

    createBMLPanel(panel, refresh) {
        
        this.bmlGui = panel;

        if (!this.performs.currentCharacter.config) {
            this.bmlGui.addText(null, "To use this mode, the current character's configuration file is needed.", null, {disabled: true, inputClass: "nobg"});
            this.bmlGui.addButton(null, "Edit avatar", () => { 
                this.createEditAvatarDialog();                
            }, {icon: "Edit"})  
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
        }, {icon: "PersonStanding", width: "30%", buttonclass:"floating-button", title: "Reset pose"});

        this.bmlGui.addButton( null, "Replay", (value, event) =>{
            this.performs.scriptApp.replay();         
            this.changePlayButtons(false);    
        }, {icon: "Play@solid", width:"70%"});

        this.bmlGui.endLine();

        this.bmlGui.addSeparator();
        this.bmlInputData.openButton = this.bmlGui.addButton( null, "BML Input", (value, event) =>{

            if ( this.bmlInputData.dialog ){ this.bmlInputData.dialog.close(); }

            this.bmlInputData.dialog = new LX.PocketDialog( "BML Instruction", p => {
                if( !this._firstPocketDialogOpen ){ // BUG: pocket dialog needs to be opened and close once. Otherwise, codeEditor behaves weirdly                    this._firstPocketDialogOpen = true;
                    this._firstPocketDialogOpen = true;
                    setTimeout( this.bmlInputData.openButton.setState.bind( this.bmlInputData.openButton, true ), 1);
                }

                let htmlStr = "Write in the text area below the bml instructions to move the avatar from the web application. A sample of BML instructions can be tested through the helper tabs in the right panel.";
                p.addTextArea(null, htmlStr, null, {disabled: true, fitHeight: true});
    
                p.addButton(null, "Click here to see BML instructions and attributes", () => {
                    window.open("https://github.com/upf-gti/performs/blob/main/docs/InstructionsBML.md");
                });
    
                htmlStr = "Note: In 'speech', all text between '%' is treated as actual words. An automatic translation from words (dutch) to phonemes (arpabet) is performed.";
                htmlStr += "\n\nNote: Each instruction is inside '{}'. Each instruction is separated by a coma ',' except que last one.";
                p.addTextArea(null, htmlStr, null, {disabled: true, fitHeight: true});
    
                htmlStr = 'An example: [{ "type":"speech", "start": 0, "text": "%hallo%.", "sentT": 1, "sentInt": 0.5 }, { "type": "gesture", "start": 0, "attackPeak": 0.5, "relax": 1, "end": 2, "locationBodyArm": "shoulder", "lrSym": true, "hand": "both", "distance": 0.1 }]';
                p.addTextArea(null, htmlStr, null, {disabled: true, fitHeight: true});
    
                const area = new LX.Area({ height: "59%" });
                p.attach( area.root );
    
                let editor = new LX.CodeEditor(area, {
                    highlight: 'JSON',
                    allowAddScripts: false,
                    name : "BML",
                    onContextMenu: (m) =>{
                        return [
                            { path: "Format", callback: ()=>{
                                    let text = this.bmlInputData.codeObj.getText();
                                    let obj = null;
                                    try{ obj = JSON.parse(text); }
                                    catch(e){ obj = null; }
                
                                    if( !obj ){
                                        try{ obj = JSON.parse("["+text+"]"); }
                                        catch(e){ obj = null; }
                                    }
                
                                    if ( !obj ){
                                        LX.popup( "Check your code for errors. Common errors include: " +
                                            "\n- Keys must be quoted: {\"intensity\" : 0.2}" +
                                            "\n- Numbers use points (.) for decimal numbers: 0.2" +
                                            "\n- Elements of an array/object are separated by commas EXCEPT the last element {\"a\": 1, \"b\":2}",
                                            "Invalid bml message",
                                            {
                                                timeout: 20000,
                                            });
                                        return;
                                    }
                                    this.bmlInputData.codeObj.setText( JSON.stringify(obj, void 0, parseInt(this.bmlInputData.codeObj.tabSpaces)) );
                                }
                            }
                        ];
                    }
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
                        this.animics = window.open(PERFORMS.ANIMICS_URL);
                        
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
    
            }, { size: ["35%", "70%"], float: "left", className:"resizeable", draggable: true, closable: true, onBeforeClose: ()=>{
                this.bmlInputData.prevInstanceText = this.bmlInputData.codeObj.getText();
                this.bmlInputData.dialog = null;
                this.bmlInputData.codeObj = null;
            }});

            this.bmlInputData.dialog.root.children[1].classList.add("showScrollBar");
    
        });

        this.sigmlInputData.openButton = this.bmlGui.addButton( null, "SiGML Input", (value, event) =>{

            if ( this.sigmlInputData.dialog ){ 
                this.sigmlInputData.prevInstanceText = this.sigmlInputData.codeObj.getText();
                this.sigmlInputData.dialog.close(); 
            }

            this.sigmlInputData.dialog = new LX.PocketDialog( "SiGML Instruction", p => {
                if( !this._firstPocketDialogOpen ){ // BUG: pocket dialog needs to be opened and close once. Otherwise, codeEditor behaves weirdly
                    this._firstPocketDialogOpen = true;
                    setTimeout( this.sigmlInputData.openButton.setState.bind( this.sigmlInputData.openButton, true ), 1);
                }

                let a = new LX.Area({height:"100%"});
                p.attach( a.root );

                let [textCodeArea, sendArea] = a.split({type:"vertical", sizes:["90%", "10%"]});

                let textCodePanel = new LX.Panel({height:"100%"});
                textCodeArea.attach( textCodePanel.root );

                let htmlStr = "Write in the text area below the SiGML instructions (as in JaSigning) to move the avatar from the web application. Work in progress";
                textCodePanel.addTextArea(null, htmlStr, null, {disabled: true, fitHeight: true});       
    
                const codeArea = new LX.Area({ height: "85%" });
                textCodePanel.attach( codeArea.root );
    
                let editor = new LX.CodeEditor(codeArea, {
                    highlight: 'XML',
                    allowAddScripts: false, 
                    name : "XML"
                });
                editor.setText( this.sigmlInputData.prevInstanceText );
                this.sigmlInputData.codeObj = editor;

                let sendPanel = new LX.Panel({height:"100%"});
                sendArea.attach( sendPanel.root );

                sendPanel.addButton(null, "Send", () => {
                    let text = this.sigmlInputData.codeObj.getText().replaceAll("\n", "").replaceAll("\r", "");
                    this.performs.scriptApp.processMessageRawBlocks( [ {type:"sigml", data: text } ] );
                });
    
            }, { size: ["35%", "70%"], float: "left", className: "resizeable", draggable: true, closable: true, onclose: (root)=>{
                this.sigmlInputData.prevInstanceText = this.sigmlInputData.codeObj.getText();
                this.sigmlInputData.dialog = null;
                this.sigmlInputData.codeObj = null;
                root.remove();
            }});
        
            this.sigmlInputData.dialog.root.children[1].classList.add("showScrollBar");

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
                    p.addTextArea(null, htmlStr, null, {disabled: true, fitHeight: true});  
                    
                    p.addSelect("Language", languages, this.performs.scriptApp.selectedLanguage, (value, event) => {
                        this.performs.scriptApp.selectedLanguage = value;
                        p.refresh();
                    } );

                    const select = p.addSelect("Select glosses", glossesDictionary[ this.language ], "", (value, event) => {
                        this.glossInputData.glosses += " " + value;
                        this.glossInputData.textArea.set( this.glossInputData.glosses );
                    }, {filter: true});
                    select.root.getElementsByClassName("lexselectoptions")[0].style.maxHeight = "400px";
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
            }, { size: ["35%"],float: "left", draggable: true, closable: true } );        
        });    

        this.bmlGui.addSeparator();
        this.bmlGui.sameLine();
        this.bmlGui.addNumber("Random Signs", this.randomSignAmount, (v,e)=>{this.randomSignAmount = v;}, { min:0, max:100, skipReset: true, nameWidth: "30%", width:"80%" } );
        this.bmlGui.addButton( null, "Play random signs", (v,e)=>{ 
            if (!this.randomSignAmount ){ return; }
            let k = Object.keys( this.performs.scriptApp.languageDictionaries[this.performs.scriptApp.selectedLanguage]["glosses"] );
            
            let m = [];
            for( let i = 0; i < this.randomSignAmount; ++i ){
                m.push( { type: "glossName", data: k[ Math.floor( Math.random() * (k.length-1) ) ] } );
            }
            console.log( JSON.parse(JSON.stringify(m)));
            this.performs.scriptApp.processMessageRawBlocks( m );
        }, { icon: "ArrowRightFromLine@solid", width:"20%", title:"Play random signs"} );
        this.bmlGui.endLine();

        this.bmlGui.addSeparator();
        this.bmlGui.addSelect("Mood", [ "Neutral", "Anger", "Happiness", "Sadness", "Surprise", "Fear", "Disgust", "Contempt" ], this.performs.scriptApp.mood, (value, event) => {
            let msg = { type: "behaviours", data: [ { type: "faceEmotion", emotion: value.toUpperCase(), amount: this.performs.scriptApp.moodIntensity, start: 0.0, shift: true } ] };
            this.performs.scriptApp.mood = value;
            this.performs.scriptApp.ECAcontroller.processMsg(JSON.stringify(msg));
        });

        this.bmlGui.addNumber("Mood intensity", this.performs.scriptApp.moodIntensity, (v) => {
            let msg = { type: "behaviours", data: [ { type: "faceEmotion", emotion: this.performs.scriptApp.mood.toUpperCase(), amount: v, start: 0.0, shift: true } ] };
            this.performs.scriptApp.ECAcontroller.processMsg(JSON.stringify(msg));
            this.performs.scriptApp.moodIntensity = v;
        }, {min: 0, max: 1.0, step: 0.01})

        this.bmlGui.addCheckbox("Apply idle animation", this.performs.scriptApp.applyIdle, (v) => {
            this.performs.scriptApp.onApplyIdle(v);
        }, {
                nameWidth: "auto",
                skipReset: true,
                label: "",
                className: "contrast",
                suboptions: (p) => {
                    p.addSelect("Animations", Object.keys(this.performs.scriptApp.loadedIdleAnimations), this.performs.scriptApp.currentIdle, (v) => {
                        this.performs.scriptApp.bindAnimationToCharacter(v, this.performs.currentCharacter.model.name);
                    });
                    p.addNumber("Intensity", this.performs.scriptApp.intensity, (v) => {
                        this.performs.scriptApp.setIntensity(v);
                    }, {min: 0.1, max: 1.0, step: 0.01});
                }
            });
        
        this.bmlGui.merge(); // random signs
             
    }

    createKeyframePanel(panel, refresh) {
      
        this.keyframeGui = panel;
  
        this.keyframeGui.addNumber("Speed", this.performs.keyframeApp.speed, (value, event) => {
            // this.performs.speed = Math.pow( Math.E, (value - 1) );
            this.performs.keyframeApp.speed = value;
        }, { min: -2, max: 2, step: 0.01});

        const animations = Object.keys(this.performs.keyframeApp.loadedAnimations);
        this.keyframeGui.addSelect("Animation", animations, this.performs.keyframeApp.currentAnimation, (v) => {
            this.performs.changeAnimation(v);
        });
        this.keyframeGui.sameLine();

        const fileinput = this.keyframeGui.addFile("Animation File", (v, e) => {
            let files = panel.components["Animation File"].root.children[1].files;
            if(!files.length) {
                return;
            }
            this.performs.keyframeApp.loadFiles(files, (animations)=> {
                
                if(animations.length) {
                    this.performs.changeMode(PERFORMS.Modes.KEYFRAME);
                    if(refresh) {
                        refresh();
                    }
                }
                else {
                    LX.popup("This file doesn't contain any animation or a valid source avatar!");
                }
            })
        }, {type: "url", multiple: "multiple"});

        fileinput.root.classList.add('hidden');
        fileinput.root.children[1].setAttribute("multiple", "multiple");

        this.keyframeGui.addButton(null, "Upload animation", (v,e) => {
            fileinput.root.children[1].click();
           
        }, { icon: "Upload", width: "30%", className:"no-padding"});

        this.keyframeGui.addButton(null, null, (v,e) => {
            this.performs.changePlayState();
            this.changePlayButtons(this.performs.keyframeApp.playing );
        }, { icon: "Play@solid", width: "70%", className:"no-padding"});
        this.keyframeGui.endLine(); 

        if( animations.length > 1 ) {
            this.keyframeGui.addCheckbox("Blend animations", this.performs.keyframeApp.useCrossFade,
                (v) => { this.performs.keyframeApp.useCrossFade = v; },
                {
                    skipReset: true,
                    label: "",
                    suboptions: (p) => {
                        p.addNumber("Blend time", this.performs.keyframeApp.blendTime, (v) => {
                            this.performs.keyframeApp.blendTime = v;
                        }, {min: 0.0, step: 0.01});
                    }
            });
        }

        this.keyframeGui.branch("Retargeting", { icon: "Tags"} );
           
        this.keyframeGui.addCheckbox("Source embedded transforms", this.performs.keyframeApp.srcEmbedWorldTransforms, (v) => {
            this.performs.keyframeApp.srcEmbedWorldTransforms = v;
            this.performs.changeAnimation(this.performs.keyframeApp.currentAnimation, true);
        },{nameWidth: "auto", skipReset: true, label: "", className: "contrast"})
            
        this.keyframeGui.addCheckbox("Target embedded transforms", this.performs.keyframeApp.trgEmbedWorldTransforms, (v) => {
            this.performs.keyframeApp.trgEmbedWorldTransforms = v;
            this.performs.changeAnimation(this.performs.keyframeApp.currentAnimation, true);
        }, {nameWidth: "auto", skipReset: true, label: "", className: "contrast"})
        
        const poseModes = ["DEFAULT", "CURRENT", "TPOSE"];
        this.keyframeGui.addSelect("Source reference pose", poseModes, poseModes[this.performs.keyframeApp.srcPoseMode], (v) => {
            this.performs.keyframeApp.srcPoseMode = poseModes.indexOf(v);
            this.performs.changeAnimation(this.performs.keyframeApp.currentAnimation, true);
        }, {nameWidth: "200px", skipReset: true});

        this.keyframeGui.addSelect("Character reference pose", poseModes, poseModes[this.performs.keyframeApp.trgPoseMode], (v) => {
            this.performs.keyframeApp.trgPoseMode = poseModes.indexOf(v);
            this.performs.changeAnimation(this.performs.keyframeApp.currentAnimation, true);
        }, {nameWidth: "200px", skipReset: true});
        
        if( this.performs.keyframeApp.trajectoriesHelper ) {

            this.keyframeGui.branch("Trajectories", { icon: "Spline"} );
            this.keyframeGui.addCheckbox("Show trajectories", this.performs.keyframeApp.trajectoriesActive, (v) => {
                const keyframeApp = this.performs.keyframeApp;
                if( v ) {
                    keyframeApp.showTrajectories();
                }
                else {
                    keyframeApp.hideTrajectories();
                }
            },{nameWidth: "auto", skipReset: true, label: "", className: "contrast"})
            
            if( this.performs.keyframeApp.currentAnimation ) {
                this.keyframeGui.addRange("Window range (s)", [this.performs.keyframeApp.trajectoriesStart, this.performs.keyframeApp.trajectoriesEnd], (v) => {
                    this.performs.keyframeApp.updateTrajectories(v[0], v[1]);
                }, {step: 0.01, min:0, max: this.performs.keyframeApp.loadedAnimations[ this.performs.keyframeApp.currentAnimation ].bodyAnimation.duration});

            }
        }
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
                    selected: animation.record,
                    checkbox: true
                };
                assetData.push(data);
            }
            
            let assetView = new LX.AssetView({ 
                skipBrowser: true,
                skipPreview: true,
                layout: LX.AssetView.LAYOUT_LIST,   
                contextMenu: false,
                allowMultipleSelection: true          
            });
            assetView.load( assetData, event => {
                if(event.type == LX.AssetViewEvent.ASSET_CHECKED) {
                    const item = event.item;
                    let animation = animations[item.id];
                    animation.record = item.selected;
                }
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
            }, {buttonClass: "accept", width: "100px"});
            p.addButton(null, "Cancel", () => { dialog.close();}, {width: "100px"})
        }, {size: ["40%", "60%"], resizable: true, draggable: true, scroll: false });

    }
    
    createImportDialog(type, callback) {
        let isAvatar = false;
        const dialog = new LX.Dialog(type + " File Detected!", (panel) => {
            panel.sameLine();
            panel.addButton(null, "Use as Avatar", (v) => { isAvatar = true; dialog.close(); callback(isAvatar); }, {width:"50%"});
            panel.addButton(null, "Use Animations only", (v) => { isAvatar = false; dialog.close(); callback(isAvatar);}, {width:"50%"});
            panel.endLine();
        })
    }

    // select from the this.avatarOptions and loaded characters
    selectAvatar(avatarName){
        if ( !this.performs.loadedCharacters[avatarName] ) {
            $('#loading').fadeIn(); //hide();
            let modelFilePath = this.avatarOptions[avatarName][0];                    
            let configFilePath = this.avatarOptions[avatarName][1];
            let modelRotation = (new THREE.Quaternion()).setFromAxisAngle( new THREE.Vector3(1,0,0), this.avatarOptions[avatarName][2] ); 
            this.performs.loadAvatar(modelFilePath, configFilePath, modelRotation, avatarName, ()=>{ 
                this.performs.changeAvatar(avatarName);
                if( this.activePanelType == GUI.ACTIVEPANEL_AVATARS){
                    this.createAvatarsPanel();
                }
                if(this.performs.currentCharacter.config && this.performs.mode != PERFORMS.Modes.SCRIPT && !this.performs.keyframeApp.currentAnimation) {
                    this.performs.changeMode(PERFORMS.Modes.SCRIPT);
                    this.overlayButtonsReset.buttons["Reset pose"].root.classList.remove("hidden");
                }
                $('#loading').fadeOut();
            }, (err) => {
                $('#loading').fadeOut();
                LX.popup("There was an error loading the avatar", "Avatar not loaded", {width: "30%"});
            } );
            return;
        } 

        // use controller if it has been already loaded in the past
        this.performs.changeAvatar(avatarName);
        if( this.activePanelType == GUI.ACTIVEPANEL_AVATARS){
            this.createAvatarsPanel();
        }
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
                    if (this.avatarOptions[v]){
                        LX.popup("This avatar name is taken. Please, change it.", null, { size: ["300px", "auto"], position: ["45%", "20%"]});
                    }
                    name = v;
                });

                panel.sameLine();
                let avatarFile = panel.addFile("Avatar File", (v, e) => {
                    let files = panel.components["Avatar File"].root.children[1].files;
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
                    avatarFile.root.classList.add('hidden');
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
                           
                            const promptD = LX.prompt("It looks like you are importing an avatar from a Ready Player Me. Would you like to use the default configuration for this character?\nPlease note that the contact settings may vary. We recommend customizing the settings based on the default to better suit your avatar.", 
                                                    "Ready Player Me detected!", (value, event)=> {
                                cfromFile = false;
                                panel.refresh();
                                panel.setValue("Config URL", PERFORMS.AVATARS_URL+"ReadyEva/ReadyEva_v3.json");
                                
                            },{input: false, fitHeight: true})                            
                        }
                    }
                    else { LX.popup("Only accepts GLB and GLTF formats!"); }
                }, {nameWidth: "43%"});
                if(afromFile) {
                    avatarURL.root.classList.add('hidden');
                }

                panel.addComboButtons(null, [
                    {
                        value: "From File",
                        callback: (v, e) => {                            
                            afromFile = true;
                            if(!avatarURL.root.classList.contains('hidden')) {
                                avatarURL.root.classList.add('hidden');          
                            }
                            avatarFile.root.classList.remove('hidden');                                                          
                            panel.refresh();
                        }
                    },
                    {
                        value: "From URL",
                        callback: (v, e) => {
                            afromFile = false;
                            if(!avatarFile.root.classList.contains('hidden')) {
                                avatarFile.root.classList.add('hidden');           
                            }                                               
                            avatarURL.root.classList.remove('hidden');          
                        }
                    }
                ], {selected: afromFile ? "From File" : "From URL"});                
                panel.endLine();
            
                panel.sameLine();
                let configFile = panel.addFile("Config File", (v, e) => {
                
                    if(!v) {
                        return;
                    }
                    const filename = panel.components["Config File"].root.children[1].files[0].name;
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
                                editConfigBtn.root.classList.remove('hidden');
                            }
                            catch (error) {
                                LX.popup(error.message, "File error!");
                            }
                        }
                    }
                    else { LX.popup("Config file must be a JSON!"); }
                }, {nameWidth: "43%"});

                if(cfromFile) {
                    configURL.root.classList.add('hidden');
                }else {
                    configFile.root.classList.add('hidden');
                }
                
                const editConfigBtn = panel.addButton(null, "Edit config file", () => {
                    this.performs.openAtelier(name, model, config, true, rotation);

                }, {icon: "Settings", width: "40px"});
                
                if(!config) {
                    editConfigBtn.root.classList.add('hidden');
                }

                panel.addComboButtons(null, [
                    {
                        value: "From File",
                        callback: (v, e) => {                            
                            cfromFile = true;
                            // panel.refresh();
                            if(!configURL.root.classList.contains('hidden')) {
                                configURL.root.classList.add('hidden');          
                            }
                            configFile.root.classList.remove('hidden');                                                          
                        }
                    },
                    {
                        value: "From URL",
                        callback: (v, e) => {
                            cfromFile = false;
                            // panel.refresh();
                            if(!configFile.root.classList.contains('hidden')) {
                                configFile.root.classList.add('hidden');           
                            }                                               
                            configURL.root.classList.remove('hidden');  
                        }
                    }
                ], {selected: cfromFile ? "From File" : "From URL"});

                panel.endLine();

            panel.addNumber("Apply Rotation", 0, (v) => {
                rotation = v * Math.PI / 180;
            }, { min: -180, max: 180, step: 1 } );
            
            panel.sameLine(2);
            panel.addButton(null, "Create Config File", () => {
                this.performs.openAtelier(name, model, config, true, rotation);
            }, {width: "50%"});
            panel.addButton(null, "Upload", () => {
                if (name && model) {
                    if (this.avatarOptions[name]) { 
                        LX.popup("This avatar name is taken. Please, change it.", null, { position: ["45%", "20%"]}); 
                        return; 
                    }
                    let thumbnail = GUI.THUMBNAIL;
                    if( model.includes('models.readyplayer.me') ) {
                        model+= '?pose=T&morphTargets=ARKit&lod=1';
                        thumbnail =  "https://models.readyplayer.me/" + name + ".png";
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
            }, {width:"50%"});

            panel.root.addEventListener("drop", (v, e) => {

                let files = v.dataTransfer.files;
                this.onDropAvatarFiles(files);
            })
            
        }
        panel.refresh();

        }, { size: ["40%"], className: "resizeable", closable: true, onclose: (root) => {  root.remove(); }});

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
                if (this.avatarOptions[v]){
                    LX.popup("This avatar name is taken. Please, change it.", null, { position: ["45%", "20%"]});
                }
                name = v;
            });

            panel.sameLine();

            let configFile = panel.addFile("Config File", (v, e) => {
                if(!v) {
                    return;
                }
                const filename = panel.components["Config File"].root.children[1].files[0].name;
                let extension = filename.split(".");
                extension = extension.pop();
                if (extension == "json") { 
                    config = JSON.parse(v); 
                    config._filename = filename; 
                }
                else { LX.popup("Config file must be a JSON!"); }
            }, {
                type: "text",
                className: fromFile ? "": "hidden"
            });

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
            }, { className: fromFile ? "hidden": "" });

            panel.addComboButtons(null, [
                {
                    value: "From File",
                    callback: (v, e) => {                            
                        fromFile = true;
                        panel.components["Config URL"].root.classList.add('hidden');          
                        panel.components["Config File"].root.classList.remove('hidden');                                                                                  
                    }
                },
                {
                    value: "From URL",
                    callback: (v, e) => {
                        fromFile = false;
                        panel.components["Config File"].root.classList.add('hidden');           
                        panel.components["Config URL"].root.classList.remove('hidden');  
                    }
                }
            ], {selected: fromFile ? "From File" : "From URL"});

            panel.endLine();

            panel.addNumber("Apply Rotation", 0, (v) => {
                rotation = v * Math.PI / 180;
            }, { min: -180, max: 180, step: 1 } );
            
            panel.sameLine(2);
            panel.addButton(null, (config ? "Edit": "Create") + " Config File", () => {
                this.performs.openAtelier(name, this.avatarOptions[name][0], config, false, rotation);                                       
            },{ width:"50%"});

            panel.addButton(null, "Update", () => {
                if (name) {
                    if (this.avatarOptions[name]){
                        LX.popup("This avatar name is taken. Please, change it.", null, { position: ["45%", "20%"]});
                        return;
                    }

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
            }, {width: "50%"});

            panel.root.addEventListener("drop", (v, e) => {

                let files = v.dataTransfer.files;
                this.onDropAvatarFiles(files);
            });
        }
        panel.refresh();

        }, { size: ["40%"], className:"resizeable", closable: true, onclose: (root) => {  root.remove(); }});

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
                    this.uploadAvatar((avatarName) => {
                        this.selectAvatar(avatarName);
                    });
                    
                    // Create a data transfer object
                    let dataTransfer = new DataTransfer();
                    // Add file to the file list of the object
                    dataTransfer.items.add(gltfs[0]);
                    // Save the file list to a new variable
                    const fileList = dataTransfer.files;
                    this.avatarDialog.panel.components["Avatar File"].root.children[1].files = fileList;
                    this.avatarDialog.panel.components["Avatar File"].root.children[1].dispatchEvent(new Event('change'), { bubbles: true });
                    
                    if (config) { 
                        // Create a data transfer object
                        dataTransfer = new DataTransfer();
                        // Add file to the file list of the object
                        dataTransfer.items.add(config);
                        // Save the file list to a new variable
                        const fileList = dataTransfer.files;
                        this.avatarDialog.panel.components["Config File"].root.children[1].files = fileList;
                        this.avatarDialog.panel.components["Config File"].root.children[1].dispatchEvent(new Event('change'), { bubbles: true });    
                    }
                }
                else {
                    $("#loading").fadeIn();
                    this.performs.keyframeApp.loadFiles(gltfs, (files) => {
                        $("#loading").fadeOut();
                        if(files.length) {
                            this.performs.changeMode(PERFORMS.Modes.KEYFRAME);
                            this.setActivePanel( GUI.ACTIVEPANEL_SETTINGS );
                            this.overlayButtonsMenu.buttons["Settings"].root.children[0].classList.add("selected");
                            //this.createSettingsPanel();
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
                    this.performs.changeMode(PERFORMS.Modes.SCRIPT);
                    if(this.activePanelType == GUI.ACTIVEPANEL_SETTINGS) {
                        this.setActivePanel( GUI.ACTIVEPANEL_SETTINGS );
                        this.overlayButtonsMenu.buttons["Settings"].root.children[0].classList.add("selected");   
                    }
                }
                else {
                    this.performs.setConfiguration(data, () => {
                        if(this.activePanelType == GUI.ACTIVEPANEL_SETTINGS) {
                            this.setActivePanel( GUI.ACTIVEPANEL_SETTINGS );
                            this.overlayButtonsMenu.buttons["Settings"].root.children[0].classList.add("selected");             
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
                    this.performs.changeMode(PERFORMS.Modes.KEYFRAME);
                    this.setActivePanel( GUI.ACTIVEPANEL_SETTINGS );
                    this.overlayButtonsMenu.buttons["Settings"].root.children[0].classList.add("selected");
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

                this.avatarDialog.panel.components["Avatar File"].root.children[1].files = fileList;
                this.avatarDialog.panel.components["Avatar File"].root.children[1].dispatchEvent(new Event('change'), { bubbles: true });                
            }
            else if (extension == "json") { 
                // Create a data transfer object
                const dataTransfer = new DataTransfer();
                // Add file to the file list of the object
                dataTransfer.items.add(files[i]);
                // Save the file list to a new variable
                const fileList = dataTransfer.files;
                this.avatarDialog.panel.components["Config File"].root.children[1].files = fileList;
                this.avatarDialog.panel.components["Config File"].root.children[1].dispatchEvent(new Event('change'), { bubbles: true });
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
                alert( "Invalid bml message" +
                    "\nCheck your code for errors. Common errors include: " +
                    "\n- Keys must be quoted: {\"intensity\" : 0.2}" +
                    "\n- Numbers use points (.) for decimal numbers: 0.2" +
                    "\n- Elements of an array/object are separated by commas EXCEPT the last element {\"a\": 1, \"b\":2}");
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
		$("#loading").css({ background: "rgba(17,17,17," + 0.5 + ")", display:"flex" })
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
                if(btn.id == "back") {
                    btn.addEventListener("click", () => {
                        innerChange("modal" + (i-1).toString())
                    })
                }
                else if(btn.id == "next") {
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
            const span = modalContent.getElementsByClassName('close-button')[0];
            span.addEventListener("click", () => {
                modal.classList.add('hidden');
            });
        }

    }

    showExportAvatarDialog(callback) {
        
        this.performs.export('GLB', this.performs.currentCharacter.model.name, (error) =>{
            LX.popup("Error: " + error, null, {size:["800px", "auto"], timeout: 6000})
        });
    }

    showExportDialog() {

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
        const backgrounds = Object.keys(PERFORMS.Backgrounds);
        
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
            trajectories               : {state: localStorage.getItem("trajectories") != undefined ? JSON.parse(localStorage.getItem("trajectories")) : false, text: "Show trajectories", value: this.performs.keyframeApp.trajectoriesActive},

        }

        const toExportTransform = {
            position: {state: localStorage.getItem("position") != undefined ? JSON.parse(localStorage.getItem("position")) : false, text: "Character position", value: this.performs.currentCharacter.model.position.x + ',' + this.performs.currentCharacter.model.position.y + ',' + this.performs.currentCharacter.model.position.z},
            rotation: {state: localStorage.getItem("rotation") != undefined ? JSON.parse(localStorage.getItem("rotation")) : false, text: "Character rotation", value: this.performs.currentCharacter.model.quaternion.x + ',' + this.performs.currentCharacter.model.quaternion.y + ',' + this.performs.currentCharacter.model.quaternion.z + ',' + this.performs.currentCharacter.model.quaternion.w},
            scale:    {state: localStorage.getItem("scale") != undefined ? JSON.parse(localStorage.getItem("scale")) : false, text: "Character scale", value: this.performs.currentCharacter.model.scale.x}
        }

        const dialog = new LX.Dialog("Export configuration", p => {
            
            p.sameLine();
            p.addButton("Select the configuration settings you want to export. ", 'More info...', (v) => {
                window.open('https://github.com/upf-gti/performs/blob/main/docs/IntegrationGuide.md', '_blank');
            }, {nameWidth: "auto"});
            p.endLine();
            let url = new URL(window.location.origin + window.location.pathname);

            let urlPanel = new LX.Panel({height:'auto'});
            urlPanel.refresh = () => {
                urlPanel.clear();
                urlPanel.sameLine();
                urlPanel.addTextArea("Iframe", url.toJSON(), null, {nameWidth: "80px", fitHeight: true, disabled:true, className: "iframe-text nobg"});              
                urlPanel.addButton(null, 'Copy', (value, event) => {
    
                    navigator.clipboard.writeText(url);
                    const bubble = document.getElementById('bubble');
                    
                    // Get the bounding rect of button                    
                    const rect = event.target.getBoundingClientRect();
                    // Set the bubble position
                    bubble.style.left = `${rect.left - 20}px`; //`${x - 25}px`;
                    bubble.style.top = `${rect.top - 35}px`; //`${y - bubble.offsetHeight - 35}px`; // Position above the mouse click
                    bubble.classList.add('show');
                    
                    setTimeout(function() {
                        bubble.classList.remove('show');
                    }, 2000); // Bubble will show for 2 seconds
                }, {icon:'Clipboard', width:"40px"})
                urlPanel.endLine();
            }
            
            let tabsPanel = new LX.Area({height: 'fit-content'});
            let tabs = tabsPanel.addTabs();

            const makeTab = ( attributes ) =>{
                const attrPanel = new LX.Panel({height:'auto'});
                const tabPanel = new LX.Panel({height:'auto'});

                // make selectAll checkbox sepparate from the rest of attributes. A refresh of attributes will not change the selectAll checkbox 
                tabPanel.addCheckbox("Select All", false, (v, e) => {
                    for(let key in attributes) {                    
                        attributes[key].state = v;
                        localStorage.setItem(key, v);               
                    }
                    attrPanel.refresh();
                },{nameWidth: "auto", className: "contrast", label:"", skipReset: true});
                tabPanel.addSeparator();

                // attributes to show 
                attrPanel.refresh = () => {
                    attrPanel.clear();               
                    for(let key in attributes) {
                        url.searchParams.delete(key);
                        attrPanel.sameLine();
                        attrPanel.addCheckbox("", attributes[key].state, (v, e) => {
                            localStorage.setItem(key, v);
                            attributes[key].state = v;
                            attrPanel.refresh();
                        },{nameWidth: "auto", className: "contrast", label:key})
                        attrPanel.addText(null, attributes[key].text, null, {disabled: true, inputClass: "nobg"});
                        attrPanel.endLine();
    
                        if ( attributes[key].state ){
                            url.searchParams.append(key, attributes[key].value);
                        }
                    }
                    
                    attrPanel.addSeparator();                
                    urlPanel.refresh();
                };
                attrPanel.refresh();
                tabPanel.attach(attrPanel.root);
                return [tabPanel, attrPanel];
            }

            // General options
            let [tabPanel,attrPanel]  = makeTab( toExport );
            tabs.add("Customization", tabPanel.root, () => attrPanel.refresh());

            // Script mode idle options
            [tabPanel,attrPanel]  = makeTab( toExportScript );
            tabs.add("Script mode", tabPanel.root, () => attrPanel.refresh());

            // Keyframe mode options
            [tabPanel,attrPanel]  = makeTab( toExportKeyframe );
            tabs.add("Keyframe mode", tabPanel.root, () => attrPanel.refresh());

            // Transforms mode options
            [tabPanel,attrPanel]  = makeTab( toExportTransform );
            tabs.add("Transforms", tabPanel.root, () => toExportTransform.refresh());
              
            p.root.appendChild(tabsPanel.root);
            urlPanel.refresh();
            p.root.appendChild(urlPanel.root);        

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

                dialog.close();
            }, {buttonClass: "accept", width: "auto"});

        }, {size: ["40%", "fit-content"], className: "resizeable", draggable: true, scroll: true });

        dialog.root.style.maxHeight = "90%";
        dialog.root.style.translate = "-50% 0%";
        dialog.root.style.top = "10%";

    }
}
PERFORMS.GUI = GUI;

export { GUI };